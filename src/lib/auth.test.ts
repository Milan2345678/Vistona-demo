import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  issueSessionToken,
  verifyPassword,
  verifySessionToken,
  ensureTenantAccess,
  type SessionClaims,
} from "./auth";

process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";

test("hashPassword and verifyPassword work for a password", async () => {
  const password = "manager123";
  const hashed = await hashPassword(password);

  assert.notEqual(hashed, password);
  assert.equal(await verifyPassword(password, hashed), true);
  assert.equal(await verifyPassword("wrong-password", hashed), false);
});

test("session tokens carry tenant and role context", async () => {
  const claims: SessionClaims = {
    sub: "user-1",
    tenantId: "anndham",
    restaurantId: "rest-1",
    role: "manager",
    email: "manager@anndham.com",
  };

  const token = issueSessionToken(claims);
  const verified = verifySessionToken(token);

  assert.ok(verified);
  assert.equal(verified?.tenantId, "anndham");
  assert.equal(verified?.role, "manager");
});

test("session verification fails closed without a configured secret", () => {
  const claims: SessionClaims = {
    sub: "user-1",
    tenantId: "tenant-1",
    restaurantId: "restaurant-1",
    role: "manager",
    email: "manager@example.test",
  };
  const token = issueSessionToken(claims);
  const configuredSecret = process.env.JWT_SECRET;

  delete process.env.JWT_SECRET;
  assert.equal(verifySessionToken(token), null);
  process.env.JWT_SECRET = configuredSecret;
});

test("tenant access enforcement blocks cross-tenant operations", () => {
  const claims: SessionClaims = {
    sub: "user-2",
    tenantId: "anndham",
    restaurantId: "rest-1",
    role: "waiter",
    email: "waiter@anndham.com",
  };

  assert.doesNotThrow(() => ensureTenantAccess(claims, "anndham"));
  assert.throws(() => ensureTenantAccess(claims, "harbor-bay"));
});
