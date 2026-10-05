import { NextResponse } from "next/server";
import { pool } from "@/lib/database";

const ESTIMATED_PREPARATION_MINUTES = 30;

export async function GET(
  request: Request,
  context: { params: Promise<{ restaurantSlug: string; orderId: string }> },
) {
  const { restaurantSlug, orderId } = await context.params;
  const tableToken = new URL(request.url).searchParams.get("tableToken");
  if (!tableToken) {
    return NextResponse.json({ error: "Table QR token is required" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT o.id, o.number, o.status, o."paymentStatus", o."createdAt",
              o."totalAmount", r.name AS "restaurantName", t.number AS "tableNumber"
         FROM "Order" o
         JOIN "Restaurant" r ON r.id = o."restaurantId" AND r."tenantId" = o."tenantId"
         JOIN "RestaurantTable" t ON t.id = o."tableId"
           AND t."restaurantId" = o."restaurantId" AND t."tenantId" = o."tenantId"
        WHERE o.id = $1 AND r.slug = $2 AND t."publicQrToken" = $3
          AND o.source = 'QR'`,
      [orderId, restaurantSlug, tableToken],
    );
    const order = result.rows[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const createdAt = new Date(order.createdAt);
    return NextResponse.json({
      order: {
        id: order.id,
        number: order.number,
        status: String(order.status).toLowerCase(),
        paymentStatus: String(order.paymentStatus).toLowerCase(),
        amount: Number(order.totalAmount),
        createdAt: createdAt.toISOString(),
        estimatedReadyAt: new Date(
          createdAt.getTime() + ESTIMATED_PREPARATION_MINUTES * 60_000,
        ).toISOString(),
        estimatedPreparationMinutes: ESTIMATED_PREPARATION_MINUTES,
        restaurantName: order.restaurantName,
        tableNumber: order.tableNumber,
      },
    });
  } catch (error) {
    console.error("QR order status lookup failed", error);
    return NextResponse.json(
      { error: "Order status could not be loaded" },
      { status: 503 },
    );
  }
}
