"use client";

import { useEffect, useState } from "react";

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 12_000;

export class PollHttpError extends Error {
  constructor(readonly status: number) {
    super(`Polling request failed with status ${status}`);
  }
}

export function pollDelay(failureCount: number) {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, failureCount), MAX_DELAY_MS);
}

export function isTransientPollFailure(error: unknown) {
  if (error instanceof PollHttpError) return error.status >= 500;
  return error instanceof TypeError;
}

export async function requirePollSuccess(response: Response) {
  if (!response.ok) throw new PollHttpError(response.status);
  return response.json();
}

export type PollingRuntime = {
  isHidden: () => boolean;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timer: unknown) => void;
  addVisibilityListener: (listener: () => void) => void;
  removeVisibilityListener: (listener: () => void) => void;
  addOnlineListener: (listener: () => void) => void;
  removeOnlineListener: (listener: () => void) => void;
  checkSession: (signal: AbortSignal) => Promise<number>;
  now: () => Date;
};

type PollingControllerOptions = {
  poll: (signal: AbortSignal) => Promise<void>;
  onSessionExpired: () => void;
  onOfflineChange: (offline: boolean) => void;
  onUpdated: (updatedAt: Date) => void;
  runtime: PollingRuntime;
};

export class PollingController {
  private stopped = false;
  private running = false;
  private cycle = 0;
  private failures = 0;
  private timer: unknown;
  private activeController: AbortController | undefined;

  constructor(private readonly options: PollingControllerOptions) {}

  private clearTimer() {
    if (this.timer !== undefined) this.options.runtime.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(delay: number) {
    this.clearTimer();
    if (!this.stopped && !this.options.runtime.isHidden()) {
      this.timer = this.options.runtime.setTimeout(() => void this.tick(), delay);
    }
  }

  private readonly onVisibilityChange = () => {
    if (this.options.runtime.isHidden()) this.pause();
    else void this.tick();
  };

  private readonly onOnline = () => {
    if (!this.options.runtime.isHidden()) void this.tick();
  };

  start() {
    this.options.runtime.addVisibilityListener(this.onVisibilityChange);
    this.options.runtime.addOnlineListener(this.onOnline);
    void this.tick();
  }

  private pause() {
    this.clearTimer();
    if (this.activeController) {
      this.cycle += 1;
      this.activeController.abort();
      this.activeController = undefined;
      // Keep the running lock until the aborted operation settles. This stops
      // a resumed tab or replacement cycle from overlapping the old request.
    }
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.pause();
    this.options.runtime.removeVisibilityListener(this.onVisibilityChange);
    this.options.runtime.removeOnlineListener(this.onOnline);
  }

  private async tick() {
    if (this.stopped || this.running || this.options.runtime.isHidden()) return;
    this.running = true;
    const thisCycle = ++this.cycle;
    const controller = new AbortController();
    this.activeController = controller;
    let timedOut = false;
    const timeout = this.options.runtime.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    let nextDelay = BASE_DELAY_MS;
    const isCurrent = () => !this.stopped && thisCycle === this.cycle;

    try {
      try {
        await this.options.poll(controller.signal);
        if (!isCurrent()) return;
        if (controller.signal.aborted) {
          if (!timedOut) return;
          throw new TypeError("Polling request timed out");
        }
        this.failures = 0;
        this.options.onOfflineChange(false);
        this.options.onUpdated(this.options.runtime.now());
      } catch (error) {
        if (!isCurrent() || (controller.signal.aborted && !timedOut)) return;
        if (
          error instanceof PollHttpError &&
          (error.status === 401 || error.status === 403)
        ) {
          const sessionStatus = await this.options.runtime.checkSession(
            controller.signal,
          );
          if (!isCurrent() || (controller.signal.aborted && !timedOut)) return;
          if (sessionStatus === 401) {
            this.stopped = true;
            this.options.onSessionExpired();
            return;
          }
          if (sessionStatus >= 500) throw new PollHttpError(sessionStatus);
          // A valid session with a route-level 403 is a permissions response.
          this.failures = 0;
          nextDelay = BASE_DELAY_MS;
        } else if (isTransientPollFailure(error) || timedOut) {
          this.failures += 1;
          nextDelay = pollDelay(this.failures);
          this.options.onOfflineChange(true);
        } else {
          this.failures = 0;
          nextDelay = BASE_DELAY_MS;
        }
      }
    } catch {
      if (!isCurrent() || (controller.signal.aborted && !timedOut)) return;
      this.failures += 1;
      nextDelay = pollDelay(this.failures);
      this.options.onOfflineChange(true);
    } finally {
      this.options.runtime.clearTimeout(timeout);
      if (thisCycle === this.cycle) {
        this.running = false;
        if (this.activeController === controller) this.activeController = undefined;
        this.schedule(nextDelay);
      } else {
        // A pause invalidated this result. Once it settles, resume with a new
        // cycle only if the component is still mounted and the tab is visible.
        this.running = false;
        if (!this.stopped && !this.options.runtime.isHidden()) void this.tick();
      }
    }
  }
}

type UsePollingOptions = {
  enabled: boolean;
  pollKey: string;
  poll: (signal: AbortSignal) => Promise<void>;
  onSessionExpired: () => void;
};

export function usePolling({
  enabled,
  pollKey,
  poll,
  onSessionExpired,
}: UsePollingOptions) {
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const runtime: PollingRuntime = {
      isHidden: () => document.hidden,
      setTimeout: (callback, delay) => window.setTimeout(callback, delay),
      clearTimeout: (timer) => window.clearTimeout(timer as number),
      addVisibilityListener: (listener) =>
        document.addEventListener("visibilitychange", listener),
      removeVisibilityListener: (listener) =>
        document.removeEventListener("visibilitychange", listener),
      addOnlineListener: (listener) => window.addEventListener("online", listener),
      removeOnlineListener: (listener) =>
        window.removeEventListener("online", listener),
      checkSession: async (signal) => {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          signal,
        });
        return response.status;
      },
      now: () => new Date(),
    };
    const controller = new PollingController({
      poll,
      onSessionExpired,
      onOfflineChange: setIsOffline,
      onUpdated: setLastUpdated,
      runtime,
    });
    controller.start();
    return () => controller.stop();
  }, [enabled, onSessionExpired, poll, pollKey]);

  return { isOffline, lastUpdated };
}
