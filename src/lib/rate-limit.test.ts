import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRateLimiter } from "./rate-limit";

test("in-memory auth rate limits expire after their fixed window", () => {
  let now = 1000;
  const limiter = new InMemoryRateLimiter(2, 5000, () => now);
  assert.equal(limiter.consume("hashed-key"), null);
  assert.equal(limiter.consume("hashed-key"), null);
  assert.equal(limiter.consume("hashed-key"), 5);
  now += 5000;
  assert.equal(limiter.consume("hashed-key"), null);
});
