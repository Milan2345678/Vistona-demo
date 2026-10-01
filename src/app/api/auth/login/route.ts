import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSessionToken, verifyPassword } from "@/lib/auth";
import { pool } from "@/lib/database";
import { SESSION_COOKIE } from "@/lib/tenant";

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email and password" },
      { status: 400 },
    );
  }
  if (
    !process.env.DATABASE_URL ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    return NextResponse.json(
      {
        error:
          "Sign-in is not configured. Set DATABASE_URL and a 32-character JWT_SECRET.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await pool.query(
      `SELECT id, "tenantId", "restaurantId", name, email, "passwordHash", role
         FROM "User" WHERE email = $1 AND active = true LIMIT 1`,
      [parsed.data.email.trim().toLowerCase()],
    );
    const user = result.rows[0];
    if (
      !user ||
      !(await verifyPassword(parsed.data.password, user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Email or password is incorrect" },
        { status: 401 },
      );
    }

    const role = String(user.role).toLowerCase() as
      | "manager"
      | "waiter"
      | "kitchen";
    const token = issueSessionToken({
      sub: user.id,
      tenantId: user.tenantId,
      restaurantId: user.restaurantId,
      role,
      email: user.email,
    });
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        tenantId: user.tenantId,
        restaurantId: user.restaurantId,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error: unknown) {
    const details = error as { code?: unknown; message?: unknown };
    const message =
      typeof details.message === "string" ? details.message : "Unknown error";
    console.error("Login request failed", {
      code: typeof details.code === "string" ? details.code : undefined,
      message: message
        .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[redacted database URL]")
        .replace(process.env.JWT_SECRET ?? "\0", "[redacted]")
        .slice(0, 500),
    });
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable" },
      { status: 503 },
    );
  }
}
