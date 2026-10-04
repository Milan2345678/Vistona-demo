import { NextResponse } from "next/server";
import { issueSessionToken, type AppRole } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/tenant";

type AuthenticatedUser = {
  id: string;
  tenantId: string;
  restaurantId: string;
  name: string;
  email: string;
  role: string;
  authVersion?: number;
};

export function authenticatedResponse(user: AuthenticatedUser) {
  const role = user.role.toLowerCase() as AppRole;
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      tenantId: user.tenantId,
      restaurantId: user.restaurantId,
      active: true,
    },
  });
  response.cookies.set(
    SESSION_COOKIE,
    issueSessionToken({
      sub: user.id,
      tenantId: user.tenantId,
      restaurantId: user.restaurantId,
      role,
      email: user.email,
      name: user.name,
      version: user.authVersion ?? 0,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  );
  return response;
}
