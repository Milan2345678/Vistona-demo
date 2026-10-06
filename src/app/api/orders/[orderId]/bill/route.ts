import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { createBillPdf } from "@/lib/bill-pdf";
import { requireSession } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;
  const { orderId } = await context.params;

  try {
    const result = await pool.query(
      `      SELECT o.id, o.number, o.source, o.status, o."paymentStatus", o."totalAmount",
              o."subtotalAmount", o."taxRate", o."taxAmount", o."createdAt",
              o."customerName", o."customerPhone", o.notes, r.name AS "restaurantName",
              r.city, t.number AS "tableNumber"
         FROM "Order" o
         JOIN "Restaurant" r ON r.id = o."restaurantId" AND r."tenantId" = o."tenantId"
         LEFT JOIN "RestaurantTable" t ON t.id = o."tableId"
           AND t."restaurantId" = o."restaurantId" AND t."tenantId" = o."tenantId"
        WHERE o.id = $1 AND o."tenantId" = $2 AND o."restaurantId" = $3`,
      [orderId, auth.session.tenantId, auth.session.restaurantId],
    );
    const order = result.rows[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const [items, payments] = await Promise.all([
      pool.query(
        `SELECT "itemName", quantity, "unitPrice" FROM "OrderItem"
          WHERE "orderId" = $1 AND "tenantId" = $2 AND "restaurantId" = $3
          ORDER BY id`,
        [orderId, auth.session.tenantId, auth.session.restaurantId],
      ),
      pool.query(
        `SELECT method FROM "Payment" WHERE "orderId" = $1 AND status = 'PAID'
          ORDER BY "createdAt" DESC LIMIT 1`,
        [orderId],
      ),
    ]);
    const lines = [
      order.restaurantName,
      `${order.city} | TAX INVOICE / RECEIPT`,
      `Invoice: ${order.number} | Order: ${String(order.source ?? "").toLowerCase()}`,
      `Date: ${new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      `Table: ${order.tableNumber ?? "Walk-in / takeaway"}`,
      `Customer: ${order.customerName || "Guest"}`,
      `Mobile: ${order.customerPhone || "-"}`,
      ...(order.notes ? [`Instructions: ${order.notes}`] : []),
      "-----------------------------------------------",
      ...items.rows.map((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return `${String(item.itemName).slice(0, 24)} x${quantity} @ INR ${unitPrice.toFixed(2)} = INR ${(unitPrice * quantity).toFixed(2)}`;
      }),
      "-----------------------------------------------",
      `Taxable value: INR ${Number(order.subtotalAmount).toFixed(2)}`,
      `GST (${Number(order.taxRate).toFixed(2)}%): INR ${Number(order.taxAmount).toFixed(2)}`,
      `Total: INR ${Number(order.totalAmount).toFixed(2)}`,
      `Payment: ${String(order.paymentStatus).toLowerCase()}${payments.rows[0] ? ` (${String(payments.rows[0].method).toLowerCase()})` : ""}`,
      `Order status: ${String(order.status).toLowerCase()}`,
      "Thank you for dining with us.",
    ];
    const pdf = createBillPdf(lines);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vistona-invoice-${order.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Order bill could not be generated", error);
    return NextResponse.json({ error: "Bill could not be generated" }, { status: 503 });
  }
}
