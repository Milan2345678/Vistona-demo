import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import {
  verifySessionToken,
  type AppRole,
  type SessionClaims,
} from "@/lib/auth";

export const SESSION_COOKIE = "vistona_session";

export type SessionResult =
  | { status: "ok"; session: SessionClaims }
  | { status: "invalid" }
  | { status: "unavailable" };

function logDatabaseError(error: unknown) {
  const dbError = error as { code?: unknown; message?: unknown };
  console.error("[db]", {
    code: typeof dbError?.code === "string" ? dbError.code : undefined,
    message:
      typeof dbError?.message === "string" ? dbError.message : undefined,
  });
}

export async function resolveSession(): Promise<SessionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { status: "invalid" };
  const claims = verifySessionToken(token);
  if (!claims) return { status: "invalid" };

  try {
    const result = await pool.query(
      `SELECT "tenantId", "restaurantId", name, email, role, active, "authVersion"
         FROM "User" WHERE id = $1 LIMIT 1`,
      [claims.sub],
    );
    const user = result.rows[0];
    const version = Number(user?.authVersion);
    if (
      !user ||
      !user.active ||
      user.tenantId !== claims.tenantId ||
      user.restaurantId !== claims.restaurantId ||
      version !== (claims.version ?? 0)
    ) {
      return { status: "invalid" };
    }
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
  } catch (error) {
    logDatabaseError(error);
    return { status: "unavailable" };
  }
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
