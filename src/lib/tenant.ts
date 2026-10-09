import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import {
  verifySessionTokenWithReason,
  type AppRole,
  type SessionClaims,
} from "@/lib/auth";

export const SESSION_COOKIE = "vistona_session";

export type SessionResult =
  | { status: "ok"; session: SessionClaims }
  | { status: "invalid" }
  | { status: "unavailable" };

export type SessionFailureReason =
  | "no_cookie"
  | "bad_signature"
  | "expired"
  | "user_missing"
  | "inactive"
  | "tenant_mismatch"
  | "restaurant_mismatch"
  | "auth_version_mismatch"
  | "db_unavailable";

type SessionUserRow = {
  tenantId: string;
  restaurantId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  authVersion: number | string;
};

type SessionUserQuery = (userId: string) => Promise<{ rows: SessionUserRow[] }>;

function invalidSession(reason: Exclude<SessionFailureReason, "db_unavailable">): SessionResult {
  console.warn("[session]", { reason });
  return { status: "invalid" };
}

export async function resolveSessionForToken(
  token: string | undefined,
  queryUser: SessionUserQuery = async (userId) =>
    pool.query(
      `SELECT "tenantId", "restaurantId", name, email, role, active, "authVersion"
         FROM "User" WHERE id = $1 LIMIT 1`,
      [userId],
    ),
): Promise<SessionResult> {
  if (!token) return invalidSession("no_cookie");
  const verification = verifySessionTokenWithReason(token);
  const claims = verification.claims;
  if (!claims) return invalidSession(verification.reason);

  try {
    const result = await queryUser(claims.sub);
    const user = result.rows[0];
    const version = Number(user?.authVersion);
    if (!user) return invalidSession("user_missing");
    if (!user.active) return invalidSession("inactive");
    if (user.tenantId !== claims.tenantId)
      return invalidSession("tenant_mismatch");
    if (user.restaurantId !== claims.restaurantId)
      return invalidSession("restaurant_mismatch");
    if (version !== (claims.version ?? 0))
      return invalidSession("auth_version_mismatch");
    return {
      status: "ok",
      session: {
        ...claims,
        email: user.email,
        name: user.name,
        role: String(user.role).toLowerCase() as AppRole,
        version,
      },
    };
  } catch {
    console.warn("[session]", { reason: "db_unavailable" });
    return { status: "unavailable" };
  }
}

export async function resolveSession(): Promise<SessionResult> {
  const cookieStore = await cookies();
  return resolveSessionForToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function getSession(): Promise<SessionClaims | null> {
  const result = await resolveSession();
  return result.status === "ok" ? result.session : null;
}

export async function requireSession(roles?: AppRole[]) {
  const result = await resolveSession();
  if (result.status === "unavailable") {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      ),
    };
  }
  if (result.status === "invalid") {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  const session = result.session;
  if (roles && !roles.includes(session.role)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      ),
    };
  }
  return { session, response: null };
}
