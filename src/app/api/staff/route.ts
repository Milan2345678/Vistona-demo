import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/account-security";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/account-input";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const createStaffSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["WAITER", "KITCHEN"]),
  })
  .strict();

export async function GET() {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, active, "createdAt"
         FROM "User"
        WHERE "tenantId" = $1 AND "restaurantId" = $2 AND role IN ('WAITER', 'KITCHEN')
        ORDER BY "createdAt", name`,
      [auth.session.tenantId, auth.session.restaurantId],
    );
    return NextResponse.json({ staff: result.rows });
  } catch {
    return NextResponse.json(
      { error: "Staff list is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = createStaffSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid staff details" },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const result = await pool.query(
      `INSERT INTO "User" ("tenantId", "restaurantId", name, email, "passwordHash", role, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, email, role, active, "createdAt"`,
      [
        auth.session.tenantId,
        auth.session.restaurantId,
        parsed.data.name,
        parsed.data.email,
        passwordHash,
        parsed.data.role,
      ],
    );
    return NextResponse.json({ staff: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Staff account could not be created" },
      { status: 503 },
    );
  }
}
