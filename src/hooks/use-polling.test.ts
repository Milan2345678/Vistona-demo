import test from "node:test";
import assert from "node:assert/strict";
import {
  isTransientPollFailure,
  pollDelay,
  PollHttpError,
  requirePollSuccess,
} from "./use-polling";

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
