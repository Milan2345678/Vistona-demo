import { NextResponse } from "next/server";
import { z } from "zod";
import { createInviteCode, hashInviteCode } from "@/lib/account-security";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const inviteSchema = z.object({ role: z.enum(["WAITER", "KITCHEN"]) }).strict();
const INVITE_LIFETIME_DAYS = 7;

export async function POST(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Role must be WAITER or KITCHEN" },
      { status: 400 },
    );
  }

  const code = createInviteCode();
  const expiresAt = new Date(
    Date.now() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
  );
  try {
    const result = await pool.query(
      `INSERT INTO "StaffInvite" ("tenantId", "restaurantId", role, "tokenHash", "createdById", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, role, "expiresAt"`,
      [
        auth.session.tenantId,
        auth.session.restaurantId,
        parsed.data.role,
        hashInviteCode(code),
        auth.session.sub,
        expiresAt,
      ],
    );
    return NextResponse.json(
      { invite: { ...result.rows[0], code } },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Invite could not be created" },
      { status: 503 },
    );
  }
}
