import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/database";
import { createOrder, OrderValidationError } from "@/lib/orders";

const qrOrderSchema = z
  .object({
    tableToken: z.string().trim().min(32).max(64),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1).max(64),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ restaurantSlug: string }> },
) {
  const parsed = qrOrderSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid order details" },
      { status: 400 },
    );
  const { restaurantSlug } = await context.params;

  try {
    const restaurantResult = await pool.query(
      `SELECT r.id, r."tenantId" FROM "Restaurant" r WHERE r.slug = $1 LIMIT 1`,
      [restaurantSlug],
    );
    const restaurant = restaurantResult.rows[0];
    if (!restaurant)
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 },
      );

    const tableResult = await pool.query(
      `SELECT id FROM "RestaurantTable"
        WHERE "publicQrToken" = $1 AND "tenantId" = $2 AND "restaurantId" = $3
          AND active = true`,
      [parsed.data.tableToken, restaurant.tenantId, restaurant.id],
    );
    if (!tableResult.rowCount)
      return NextResponse.json(
        { error: "Table QR is invalid or inactive" },
        { status: 404 },
      );

    const order = await createOrder({
      tenantId: restaurant.tenantId,
      restaurantId: restaurant.id,
      userId: null,
      source: "QR",
      tableId: tableResult.rows[0].id,
      notes: parsed.data.notes,
      items: parsed.data.items,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Order could not be created" },
      { status: 503 },
    );
  }
}
