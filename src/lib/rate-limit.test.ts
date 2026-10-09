import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryRateLimiter, authRateLimitIdentity } from "./rate-limit";

test("failed login results increment the matching failure limit", () => {
  const limiter = new InMemoryRateLimiter(2, 5000, () => 1000);
  const first = limiter.begin("login:user");
  assert.equal(first.retryAfter, null);
  first.finish(false);
  const second = limiter.begin("login:user");
  assert.equal(second.retryAfter, null);
  second.finish(false);
  assert.equal(limiter.begin("login:user").retryAfter, 5);
});

test("successful login results do not accumulate failed-login penalties", () => {
  const limiter = new InMemoryRateLimiter(2, 5000, () => 1000);
  for (let i = 0; i < 20; i += 1) {
    const attempt = limiter.begin("login:user");
    assert.equal(attempt.retryAfter, null);
    attempt.finish(true);
  }
  assert.equal(limiter.begin("login:user").retryAfter, null);
});

test("repeated login failures reach the configured limit", () => {
  const limiter = new InMemoryRateLimiter(3, 15_000, () => 1000);
  for (let i = 0; i < 3; i += 1) {
    const attempt = limiter.begin("login:user");
    assert.equal(attempt.retryAfter, null);
    attempt.finish(false);
  }
  assert.equal(limiter.begin("login:user").retryAfter, 15);
});

test("expired entries are removed when the cleanup interval has elapsed", () => {
  let now = 1000;
  const limiter = new InMemoryRateLimiter(2, 5000, () => now);
  limiter.consume("old");
  assert.equal(limiter.size, 1);
  now += 60_000;
  limiter.consume("new");
  assert.equal(limiter.size, 1);
});

test("capacity stays bounded and evicts the least recently used entry", () => {
  const limiter = new InMemoryRateLimiter(2, 5000, () => 1000, 2);
  limiter.consume("first");
  limiter.consume("second");
  limiter.consume("first"); // Refresh first in the LRU order.
  limiter.consume("third");
  assert.equal(limiter.size, 2);
  assert.equal(limiter.consume("second"), null); // It was evicted.
});

test("forwarding headers cannot select the rate-limit identity", () => {
  // The identity API accepts only email and scope, never a Request or headers.
  assert.equal(authRateLimitIdentity.length, 2);
  assert.equal(
    authRateLimitIdentity("  Person@Example.com ", "login"),
    authRateLimitIdentity("person@example.com", "login"),
  );
});

test("signup and join share account-creation throttling", () => {
  const limiter = new InMemoryRateLimiter(2, 5000, () => 1000);
  const signupKey = authRateLimitIdentity("person@example.com", "account-creation");
  const joinKey = authRateLimitIdentity(" PERSON@example.com ", "account-creation");
  assert.equal(signupKey, joinKey);
  assert.equal(limiter.consume(signupKey), null);
  assert.equal(limiter.consume(joinKey), null);
  assert.equal(limiter.consume(joinKey), 5);
});

test("independent limiter instances do not share state", () => {
  const first = new InMemoryRateLimiter(1, 5000, () => 1000);
  const second = new InMemoryRateLimiter(1, 5000, () => 1000);
  first.consume("same-key");
  assert.equal(second.consume("same-key"), null);
});
