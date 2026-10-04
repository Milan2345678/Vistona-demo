import { NextResponse } from "next/server";
import { z } from "zod";
import { isUniqueViolation } from "@/lib/account-security";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const updateTableSchema = z
  .object({
    number: z.string().trim().min(1).max(20).optional(),
    seats: z.number().int().min(1).max(100).optional(),
    status: z.enum(["AVAILABLE", "OCCUPIED", "BILLING"]).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = updateTableSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid table update" },
      { status: 400 },
    );
  }

  const values: unknown[] = [];
  const changes: string[] = [];
  if (parsed.data.number !== undefined) {
    values.push(parsed.data.number);
    changes.push(`number = $${values.length}`);
  }
  if (parsed.data.seats !== undefined) {
    values.push(parsed.data.seats);
    changes.push(`seats = $${values.length}`);
  }
  if (parsed.data.status !== undefined) {
    values.push(parsed.data.status);
    changes.push(`status = $${values.length}`);
  }
  if (parsed.data.active !== undefined) {
    values.push(parsed.data.active);
    changes.push(`active = $${values.length}`);
  }
  const { tableId } = await context.params;
  values.push(tableId, auth.session.tenantId, auth.session.restaurantId);

  try {
    const result = await pool.query(
      `UPDATE "RestaurantTable" SET ${changes.join(", ")}
        WHERE id = $${values.length - 2} AND "tenantId" = $${values.length - 1}
          AND "restaurantId" = $${values.length}
        RETURNING id, number, seats, status, active, "publicQrToken"`,
      values,
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    return NextResponse.json({ table: result.rows[0] });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A table with that number already exists in this restaurant" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Table could not be updated" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const { tableId } = await context.params;
  try {
    const result = await pool.query(
      `UPDATE "RestaurantTable" SET active = false
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true
        RETURNING id, number, seats, status, active, "publicQrToken"`,
      [tableId, auth.session.tenantId, auth.session.restaurantId],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    return NextResponse.json({ table: result.rows[0] });
  } catch {
    return NextResponse.json(
      { error: "Table could not be deactivated" },
      { status: 503 },
    );
  }
}
