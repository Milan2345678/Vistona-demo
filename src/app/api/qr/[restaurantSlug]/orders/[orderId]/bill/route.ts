import { pool } from "@/lib/database";
import { createBillPdf } from "@/lib/bill-pdf";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ restaurantSlug: string; orderId: string }> },
) {
  const { restaurantSlug, orderId } = await context.params;
  const tableToken = new URL(request.url).searchParams.get("tableToken");
  if (!tableToken) {
    return Response.json({ error: "Table QR token is required" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT o.id, o.number, o.status, o."paymentStatus", o."totalAmount",
              o."createdAt", o."customerName", o."customerPhone", o.notes,
              o."tenantId", o."restaurantId",
              r.name AS "restaurantName", r.city, t.number AS "tableNumber"
         FROM "Order" o
         JOIN "Restaurant" r ON r.id = o."restaurantId"
          AND r."tenantId" = o."tenantId"
         JOIN "RestaurantTable" t ON t.id = o."tableId"
          AND t."restaurantId" = o."restaurantId" AND t."tenantId" = o."tenantId"
        WHERE o.id = $1 AND r.slug = $2 AND t."publicQrToken" = $3
          AND o.source = 'QR'`,
      [orderId, restaurantSlug, tableToken],
    );
    const order = result.rows[0];
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    const itemResult = await pool.query(
      `SELECT "itemName", quantity, "unitPrice"
         FROM "OrderItem"
        WHERE "orderId" = $1 AND "tenantId" = $2 AND "restaurantId" = $3
        ORDER BY id`,
      [order.id, order.tenantId, order.restaurantId],
    );
    const billLines = [
      order.restaurantName,
      `${order.city} | BILL / ORDER RECEIPT`,
      `Order #${order.number} | Table ${order.tableNumber}`,
      `Date: ${new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      `Customer: ${order.customerName || "Guest"}`,
      `Mobile: ${order.customerPhone || "-"}`,
      ...(order.notes ? [`Instructions: ${order.notes}`] : []),
      "-----------------------------------------------",
      ...itemResult.rows.map((item) => {
        const name = String(item.itemName).slice(0, 28);
        const quantity = Number(item.quantity);
        const amount = Number(item.unitPrice) * quantity;
        return `${name} x${quantity}  INR ${amount.toFixed(2)}`;
      }),
      "-----------------------------------------------",
      `Total: INR ${Number(order.totalAmount).toFixed(2)}`,
      `Payment: ${String(order.paymentStatus).toLowerCase()}`,
      `Order status: ${String(order.status).toLowerCase()}`,
      "Thank you for dining with us.",
    ];
    const pdf = createBillPdf(billLines);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vistona-order-${order.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("QR bill could not be generated", error);
    return Response.json({ error: "Bill could not be downloaded" }, { status: 503 });
  }
}
