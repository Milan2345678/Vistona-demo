import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  hashPassword,
  issueSessionToken,
  verifyPassword,
  verifySessionToken,
  ensureTenantAccess,
  type SessionClaims,
} from "./auth";
import { resolveSessionForToken } from "./tenant";

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

async function withCapturedWarnings<T>(operation: () => Promise<T>) {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    return { result: await operation(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function expiredToken() {
  const payload = Buffer.from(
    JSON.stringify({
      sub: "private-user-id",
      tenantId: "tenant-1",
      restaurantId: "restaurant-1",
      role: "manager",
      email: "private@example.test",
      exp: Math.floor(Date.now() / 1000) - 1,
    }),
  ).toString("base64url");
  const signature = createHmac(
    "sha256",
    process.env.JWT_SECRET as string,
  ).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

test("session failures warn once with only a reason code", async () => {
  const claims: SessionClaims = {
    sub: "private-user-id",
    tenantId: "tenant-1",
    restaurantId: "restaurant-1",
    role: "manager",
    email: "private@example.test",
    version: 1,
  };
  const validToken = issueSessionToken(claims);
  const user = {
    tenantId: claims.tenantId,
    restaurantId: claims.restaurantId,
    name: "Private Name",
    email: claims.email,
    role: "MANAGER",
    active: true,
    authVersion: 1,
  };
  const cases: {
    token?: string;
    rows?: typeof user[];
    reject?: boolean;
    reason: string;
  }[] = [
    { reason: "no_cookie" },
    { token: "private-token", reason: "bad_signature" },
    { token: expiredToken(), reason: "expired" },
    { token: validToken, rows: [], reason: "user_missing" },
    {
      token: validToken,
      rows: [{ ...user, active: false }],
      reason: "inactive",
    },
    {
      token: validToken,
      rows: [{ ...user, tenantId: "other-tenant" }],
      reason: "tenant_mismatch",
    },
    {
      token: validToken,
      rows: [{ ...user, restaurantId: "other-restaurant" }],
      reason: "restaurant_mismatch",
    },
    {
      token: validToken,
      rows: [{ ...user, authVersion: 2 }],
      reason: "auth_version_mismatch",
    },
    { token: validToken, reject: true, reason: "db_unavailable" },
  ];

  for (const scenario of cases) {
    const captured = await withCapturedWarnings(() =>
      resolveSessionForToken(scenario.token, async () => {
        if (scenario.reject) throw new Error("private database detail");
        return { rows: scenario.rows ?? [user] };
      }),
    );
    assert.equal(captured.warnings.length, 1);
    assert.deepEqual(captured.warnings[0], ["[session]", { reason: scenario.reason }]);
    const output = JSON.stringify(captured.warnings);
    for (const sensitive of [
      scenario.token,
      claims.email,
      claims.sub,
      "private database detail",
      process.env.JWT_SECRET,
    ]) {
      if (sensitive) assert.equal(output.includes(sensitive), false);
    }
    assert.equal(
      captured.result.status,
      scenario.reason === "db_unavailable" ? "unavailable" : "invalid",
    );
  }
});
