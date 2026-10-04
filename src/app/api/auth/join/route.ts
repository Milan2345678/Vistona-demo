import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedResponse } from "@/lib/auth-response";
import { hashPassword } from "@/lib/auth";
import { hashInviteCode, isUniqueViolation } from "@/lib/account-security";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/account-input";
import { pool } from "@/lib/database";

const joinSchema = z
  .object({
    inviteCode: z.string().trim().min(16).max(64),
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export async function POST(request: Request) {
  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid account or invite details" },
      { status: 400 },
    );
  }
  if (
    !process.env.DATABASE_URL ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    return NextResponse.json(
      { error: "Account creation is not configured" },
      { status: 503 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inviteResult = await client.query(
      `SELECT id, "tenantId", "restaurantId", role
         FROM "StaffInvite"
        WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > NOW()
        FOR UPDATE`,
      [hashInviteCode(parsed.data.inviteCode)],
    );
    const invite = inviteResult.rows[0];
    if (!invite || !["WAITER", "KITCHEN"].includes(String(invite.role))) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Invite is invalid, expired, or already used" },
        { status: 400 },
      );
    }

    const user = await client.query(
      `INSERT INTO "User" ("tenantId", "restaurantId", name, email, "passwordHash", role, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, "tenantId", "restaurantId", name, email, role, "authVersion"`,
      [
        invite.tenantId,
        invite.restaurantId,
        parsed.data.name,
        parsed.data.email,
        passwordHash,
        invite.role,
      ],
    );
    await client.query(
      `UPDATE "StaffInvite" SET "usedAt" = NOW() WHERE id = $1`,
      [invite.id],
    );
    await client.query("COMMIT");
    return authenticatedResponse(user.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Account could not be created" },
      { status: 503 },
    );
  } finally {
    client.release();
  }
}
