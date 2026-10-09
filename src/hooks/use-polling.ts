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

    let stopped = false;
    let running = false;
    let cycle = 0;
    let failures = 0;
    let timer: number | undefined;
    let activeController: AbortController | undefined;

    const clearTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (delay: number) => {
      clearTimer();
      if (!stopped && !document.hidden) {
        timer = window.setTimeout(() => void tick(), delay);
      }
    };

    const checkSession = async (signal: AbortSignal) => {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        signal,
      });
      return response.status;
    };

    async function tick() {
      if (stopped || running || document.hidden) return;
      running = true;
      const thisCycle = ++cycle;
      const controller = new AbortController();
      activeController = controller;
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
      let nextDelay = BASE_DELAY_MS;

      try {
        try {
          await poll(controller.signal);
          failures = 0;
          setIsOffline(false);
          setLastUpdated(new Date());
        } catch (error) {
          if (controller.signal.aborted && !timedOut) return;
          if (
            error instanceof PollHttpError &&
            (error.status === 401 || error.status === 403)
          ) {
            const sessionStatus = await checkSession(controller.signal);
            if (sessionStatus === 401) {
              stopped = true;
              onSessionExpired();
              return;
            }
            if (sessionStatus >= 500) throw new PollHttpError(sessionStatus);
            // A valid session with a route-level 403 is a permissions response.
            failures = 0;
            nextDelay = BASE_DELAY_MS;
          } else if (isTransientPollFailure(error) || timedOut) {
            failures += 1;
            nextDelay = pollDelay(failures);
            setIsOffline(true);
          } else {
            failures = 0;
            nextDelay = BASE_DELAY_MS;
          }
        }
      } catch {
        if (controller.signal.aborted && !timedOut) return;
        failures += 1;
        nextDelay = pollDelay(failures);
        setIsOffline(true);
      } finally {
        window.clearTimeout(timeout);
        if (thisCycle === cycle) {
          running = false;
          if (activeController === controller) activeController = undefined;
          schedule(nextDelay);
        }
      }
    }

    const pause = () => {
      clearTimer();
      if (activeController) {
        cycle += 1;
        activeController.abort();
        activeController = undefined;
        running = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) pause();
      else void tick();
    };
    const onOnline = () => {
      if (!document.hidden) void tick();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    void tick();

    return () => {
      stopped = true;
      pause();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, onSessionExpired, poll, pollKey]);

  return { isOffline, lastUpdated };
}
