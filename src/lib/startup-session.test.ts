import test from "node:test";
import assert from "node:assert/strict";
import { checkStartupSession } from "./startup-session";

test("startup abort exits without retrying after cleanup", async () => {
  const controller = new AbortController();
  let requests = 0;
  let waits = 0;
  const resultPromise = checkStartupSession({
    signal: controller.signal,
    requestSession: (signal) => {
      requests += 1;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
    },
    wait: async () => {
      waits += 1;
    },
  });

  controller.abort();
  assert.deepEqual(await resultPromise, { kind: "aborted" });
  assert.equal(requests, 1);
  assert.equal(waits, 0);
});

test("startup still confirms unauthorized sessions before returning unauthenticated", async () => {
  const controller = new AbortController();
  let requests = 0;
  const result = await checkStartupSession({
    signal: controller.signal,
    requestSession: async () => {
      requests += 1;
      return new Response(null, { status: 401 });
    },
    wait: async () => assert.fail("401 confirmation should not retry"),
  });
  assert.deepEqual(result, { kind: "unauthenticated" });
  assert.equal(requests, 2);
});

test("startup network failures retain session and retry only while mounted", async () => {
  const controller = new AbortController();
  let requests = 0;
  let waits = 0;
  const result = await checkStartupSession({
    signal: controller.signal,
    requestSession: async () => {
      requests += 1;
      if (requests < 3) throw new TypeError("Network unavailable");
      return new Response(JSON.stringify({ user: { role: "manager" } }), { status: 200 });
    },
    wait: async () => {
      waits += 1;
    },
  });
  assert.equal(result.kind, "response");
  assert.equal(requests, 3);
  assert.equal(waits, 2);
});
