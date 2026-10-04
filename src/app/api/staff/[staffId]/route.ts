import { NextResponse } from "next/server";
import { z } from "zod";
import { isUniqueViolation } from "@/lib/account-security";
import { emailSchema, nameSchema } from "@/lib/account-input";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const updateStaffSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    role: z.enum(["WAITER", "KITCHEN"]).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ staffId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = updateStaffSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid staff update" },
      { status: 400 },
    );
  }

  const { staffId } = await context.params;
  const values: unknown[] = [];
  const changes: string[] = [];
  if (parsed.data.name !== undefined) {
    values.push(parsed.data.name);
    changes.push(`name = $${values.length}`);
  }
  if (parsed.data.email !== undefined) {
    values.push(parsed.data.email);
    changes.push(`email = $${values.length}`);
  }
  if (parsed.data.role !== undefined) {
    values.push(parsed.data.role);
    changes.push(`role = $${values.length}`);
  }
  if (parsed.data.active !== undefined) {
    values.push(parsed.data.active);
    changes.push(`active = $${values.length}`);
  }
  if (parsed.data.role !== undefined || parsed.data.active !== undefined) {
    changes.push(`"authVersion" = "authVersion" + 1`);
  }
  values.push(staffId, auth.session.tenantId, auth.session.restaurantId);

  try {
    const result = await pool.query(
      `UPDATE "User" SET ${changes.join(", ")}
        WHERE id = $${values.length - 2} AND "tenantId" = $${values.length - 1}
          AND "restaurantId" = $${values.length} AND role IN ('WAITER', 'KITCHEN')
        RETURNING id, name, email, role, active, "createdAt"`,
      values,
    );
    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ staff: result.rows[0] });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Staff member could not be updated" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ staffId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const { staffId } = await context.params;
  try {
    const result = await pool.query(
      `UPDATE "User" SET active = false, "authVersion" = "authVersion" + 1
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3
          AND role IN ('WAITER', 'KITCHEN')
        RETURNING id, name, email, role, active`,
      [staffId, auth.session.tenantId, auth.session.restaurantId],
    );
    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ staff: result.rows[0] });
  } catch {
    return NextResponse.json(
      { error: "Staff member could not be deactivated" },
      { status: 503 },
    );
  }
}
