import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const availabilitySchema = z.object({ available: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ menuItemId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  const parsed = availabilitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid menu availability" },
      { status: 400 },
    );
  }

  const { menuItemId } = await context.params;
  try {
    const result = await pool.query(
      `UPDATE "MenuItem" SET available = $4
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true
        RETURNING id, available, active`,
      [
        menuItemId,
        auth.session.tenantId,
        auth.session.restaurantId,
        parsed.data.available,
      ],
    );
    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Menu item not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ item: result.rows[0] });
  } catch {
    return NextResponse.json(
      { error: "Menu availability could not be updated" },
      { status: 503 },
    );
  }
}
