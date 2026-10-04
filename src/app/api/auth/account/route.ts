import { NextResponse } from "next/server";
import { z } from "zod";
import { nameSchema } from "@/lib/account-input";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const updateSchema = z.object({ name: nameSchema }).strict();

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.active, r.name AS "restaurantName"
         FROM "User" u
         JOIN "Restaurant" r ON r.id = u."restaurantId" AND r."tenantId" = u."tenantId"
        WHERE u.id = $1 AND u."tenantId" = $2 AND u."restaurantId" = $3`,
      [auth.session.sub, auth.session.tenantId, auth.session.restaurantId],
    );
    if (!result.rowCount)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ account: result.rows[0] });
  } catch {
    return NextResponse.json(
      { error: "Account is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid account name" },
      { status: 400 },
    );
  }
  try {
    const result = await pool.query(
      `UPDATE "User" SET name = $4
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true
        RETURNING id, name, email, role, active`,
      [
        auth.session.sub,
        auth.session.tenantId,
        auth.session.restaurantId,
        parsed.data.name,
      ],
    );
    if (!result.rowCount)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ account: result.rows[0] });
  } catch {
    return NextResponse.json(
      { error: "Account could not be updated" },
      { status: 503 },
    );
  }
}
