import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { passwordSchema } from "@/lib/account-input";
import { pool } from "@/lib/database";
import { requireSession, SESSION_COOKIE } from "@/lib/tenant";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const parsed = changePasswordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid password details" },
      { status: 400 },
    );
  }

  try {
    const result = await pool.query(
      `SELECT "passwordHash" FROM "User"
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true`,
      [auth.session.sub, auth.session.tenantId, auth.session.restaurantId],
    );
    const user = result.rows[0];
    if (
      !user ||
      !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }
    const passwordHash = await hashPassword(parsed.data.newPassword);
    await pool.query(
      `UPDATE "User" SET "passwordHash" = $4, "authVersion" = "authVersion" + 1
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true`,
      [
        auth.session.sub,
        auth.session.tenantId,
        auth.session.restaurantId,
        passwordHash,
      ],
    );
    const response = NextResponse.json({
      ok: true,
      reauthenticationRequired: true,
    });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Password could not be changed" },
      { status: 503 },
    );
  }
}
