import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  verifySessionToken,
  type AppRole,
  type SessionClaims,
} from "@/lib/auth";

export const SESSION_COOKIE = "vistona_session";

export async function getSession(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
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
