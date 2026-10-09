import test from "node:test";
import assert from "node:assert/strict";
import {
  isTransientPollFailure,
  pollDelay,
  PollHttpError,
  PollingController,
  requirePollSuccess,
  type PollingRuntime,
} from "./use-polling";

class FakeRuntime implements PollingRuntime {
  hidden = false;
  private nextTimer = 0;
  private timers = new Map<number, { callback: () => void; delay: number }>();
  private visibilityListeners = new Set<() => void>();
  private onlineListeners = new Set<() => void>();

  isHidden = () => this.hidden;
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.nextTimer;
    this.timers.set(id, { callback, delay });
    return id;
  };
  clearTimeout = (timer: unknown) => {
    this.timers.delete(timer as number);
  };
  addVisibilityListener = (listener: () => void) => {
    this.visibilityListeners.add(listener);
  };
  removeVisibilityListener = (listener: () => void) => {
    this.visibilityListeners.delete(listener);
  };
  addOnlineListener = (listener: () => void) => {
    this.onlineListeners.add(listener);
  };
  removeOnlineListener = (listener: () => void) => {
    this.onlineListeners.delete(listener);
  };
  checkSession = async () => 200;
  now = () => new Date(1000);

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    for (const listener of this.visibilityListeners) listener();
  }

  online() {
    for (const listener of this.onlineListeners) listener();
  }

  fireTimer(delay: number) {
    const timer = [...this.timers.entries()].find(([, item]) => item.delay === delay);
    assert.ok(timer, `expected a timer with delay ${delay}`);
    this.timers.delete(timer[0]);
    timer[1].callback();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function makeController(
  runtime: FakeRuntime,
  poll: (signal: AbortSignal) => Promise<void>,
  updates: { offline: boolean[]; updated: Date[]; expired: number[] } = {
    offline: [],
    updated: [],
    expired: [],
  },
) {
  const controller = new PollingController({
    poll,
    runtime,
    onOfflineChange: (offline) => updates.offline.push(offline),
    onUpdated: (date) => updates.updated.push(date),
    onSessionExpired: () => updates.expired.push(1),
  });
  return { controller, updates };
}

test("poll delays back off and stop at 30 seconds", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map(pollDelay),
    [5000, 10000, 20000, 30000, 30000, 30000],
  );
});

test("poll failure classification keeps network and gateway failures transient", () => {
  assert.equal(isTransientPollFailure(new TypeError("Failed to fetch")), true);
  assert.equal(isTransientPollFailure(new PollHttpError(502)), true);
  assert.equal(isTransientPollFailure(new PollHttpError(503)), true);
  assert.equal(isTransientPollFailure(new PollHttpError(504)), true);
  assert.equal(isTransientPollFailure(new PollHttpError(401)), false);
  assert.equal(isTransientPollFailure(new Error("AbortError")), false);
});

test("poll responses return JSON or preserve their HTTP status", async () => {
  assert.deepEqual(
    await requirePollSuccess(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ),
    { ok: true },
  );
  await assert.rejects(
    requirePollSuccess(new Response("{}", { status: 503 })),
    (error: unknown) =>
      error instanceof PollHttpError && error.status === 503,
  );
});

test("a poll resolving after abort cannot update state and does not overlap resume", async () => {
  const runtime = new FakeRuntime();
  const first = deferred<void>();
  const second = deferred<void>();
  const signals: AbortSignal[] = [];
  const { controller, updates } = makeController(runtime, (signal) => {
    signals.push(signal);
    return signals.length === 1 ? first.promise : second.promise;
  });
  controller.start();
  await flushMicrotasks();
  runtime.setHidden(true);
  runtime.setHidden(false);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, true);
  first.resolve();
  await flushMicrotasks();
  assert.equal(signals.length, 2);
  assert.deepEqual(updates.updated, []);
  second.resolve();
  await flushMicrotasks();
  assert.equal(updates.updated.length, 1);
  controller.stop();
});

test("an older poll resolving after a newer controller cannot overwrite it", async () => {
  const runtime = new FakeRuntime();
  const older = deferred<void>();
  const newer = deferred<void>();
  const updates = { offline: [] as boolean[], updated: [] as Date[], expired: [] as number[] };
  const oldController = makeController(runtime, () => older.promise, updates).controller;
  const newController = makeController(runtime, () => newer.promise, updates).controller;
  oldController.start();
  await flushMicrotasks();
  oldController.stop();
  newController.start();
  await flushMicrotasks();
  newer.resolve();
  await flushMicrotasks();
  older.resolve();
  await flushMicrotasks();
  assert.equal(updates.updated.length, 1);
  newController.stop();
});

test("unmount during a pending request suppresses updates and logout", async () => {
  const runtime = new FakeRuntime();
  const pending = deferred<void>();
  const { controller, updates } = makeController(runtime, () => pending.promise);
  controller.start();
  await flushMicrotasks();
  controller.stop();
  pending.resolve();
  await flushMicrotasks();
  assert.deepEqual(updates.updated, []);
  assert.deepEqual(updates.offline, []);
  assert.deepEqual(updates.expired, []);
});

test("abort during service-request fetch preserves the last good data", async () => {
  const runtime = new FakeRuntime();
  const serviceRequest = deferred<void>();
  let serviceRequests = ["last-good"];
  const { controller, updates } = makeController(runtime, async (signal) => {
    await serviceRequest.promise;
    if (signal.aborted) return;
    serviceRequests = ["stale-response"];
  });
  controller.start();
  await flushMicrotasks();
  runtime.setHidden(true);
  serviceRequest.resolve();
  await flushMicrotasks();
  assert.deepEqual(serviceRequests, ["last-good"]);
  assert.deepEqual(updates.updated, []);
  assert.deepEqual(updates.offline, []);
  controller.stop();
});

test("a transient network error keeps last-good data and the session", async () => {
  const runtime = new FakeRuntime();
  const data = ["last-good"];
  const { controller, updates } = makeController(runtime, async () => {
    throw new TypeError("Failed to fetch");
  });
  controller.start();
  await flushMicrotasks();
  assert.deepEqual(data, ["last-good"]);
  assert.deepEqual(updates.offline, [true]);
  assert.deepEqual(updates.expired, []);
  controller.stop();
});

test("successful recovery clears the stale indicator", async () => {
  const runtime = new FakeRuntime();
  let calls = 0;
  const { controller, updates } = makeController(runtime, async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("Failed to fetch");
  });
  controller.start();
  await flushMicrotasks();
  runtime.fireTimer(10_000);
  await flushMicrotasks();
  assert.deepEqual(updates.offline, [true, false]);
  assert.equal(updates.updated.length, 1);
  controller.stop();
});

test("polling cycles never overlap", async () => {
  const runtime = new FakeRuntime();
  const pending = deferred<void>();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const { controller } = makeController(runtime, async () => {
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (calls === 1) await pending.promise;
    active -= 1;
  });
  controller.start();
  await flushMicrotasks();
  runtime.online();
  runtime.online();
  assert.equal(calls, 1);
  pending.resolve();
  await flushMicrotasks();
  runtime.fireTimer(5000);
  await flushMicrotasks();
  assert.equal(calls, 2);
  assert.equal(maxActive, 1);
  controller.stop();
});
