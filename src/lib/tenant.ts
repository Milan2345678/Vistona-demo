import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import {
  verifySessionToken,
  type AppRole,
  type SessionClaims,
} from "@/lib/auth";

export const SESSION_COOKIE = "vistona_session";

export async function getSession(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;

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
      return null;
    }
    return {
      ...claims,
      email: user.email,
      name: user.name,
      role: String(user.role).toLowerCase() as AppRole,
      version,
    };
  } catch {
    return null;
  }
}

export async function requireSession(roles?: AppRole[]) {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
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
