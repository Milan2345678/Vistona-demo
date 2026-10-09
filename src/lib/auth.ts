import { createHmac, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";

export type AppRole = "manager" | "waiter" | "kitchen";

export type SessionClaims = {
  sub: string;
  tenantId: string;
  restaurantId: string;
  role: AppRole;
  email: string;
  name?: string;
  version?: number;
  exp?: number;
};

export type SessionTokenFailureReason = "bad_signature" | "expired";

export type SessionTokenVerification =
  | { claims: SessionClaims; reason: null }
  | { claims: null; reason: SessionTokenFailureReason };

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export function issueSessionToken(claims: SessionClaims) {
  const payload = Buffer.from(
    JSON.stringify({
      ...claims,
      exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  return verifySessionTokenWithReason(token).claims;
}

export function verifySessionTokenWithReason(
  token: string,
): SessionTokenVerification {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) {
    return { claims: null, reason: "bad_signature" };
  }

  try {
    const expectedSignature = signature(payload);
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return { claims: null, reason: "bad_signature" };
    }

    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionClaims;
    if (
      !claims.sub ||
      !claims.tenantId ||
      !claims.restaurantId ||
      !claims.email ||
      !["manager", "waiter", "kitchen"].includes(claims.role) ||
      typeof claims.exp !== "number"
    ) {
      return { claims: null, reason: "bad_signature" };
    }
    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      return { claims: null, reason: "expired" };
    }
    return { claims, reason: null };
  } catch {
    return { claims: null, reason: "bad_signature" };
  }
}

export function ensureTenantAccess(session: SessionClaims, tenantId: string) {
  if (session.tenantId !== tenantId) {
    throw new Error("Tenant access denied");
  }
}

export function hasRole(session: SessionClaims, allowed: AppRole[]) {
  return allowed.includes(session.role);
}
