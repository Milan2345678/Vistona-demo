import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const statusSchema = z.object({
  status: z.enum(["AVAILABLE", "OCCUPIED", "BILLING"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid table status" },
      { status: 400 },
    );
  }

  const { tableId } = await context.params;
  try {
    const result = await pool.query(
      `UPDATE "RestaurantTable" SET status = $4
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3
        RETURNING id, number, seats, status`,
      [
        tableId,
        auth.session.tenantId,
        auth.session.restaurantId,
        parsed.data.status,
      ],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
    return NextResponse.json({ table: result.rows[0] });
  } catch {
    return NextResponse.json(
      { error: "Table status could not be updated" },
      { status: 503 },
    );
  }
}
