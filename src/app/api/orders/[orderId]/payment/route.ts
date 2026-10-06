import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inTransaction } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const paymentSchema = z.object({ method: z.enum(["CASH", "UPI"]) });

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;

  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Select cash or UPI payment" }, { status: 400 });
  }
  const { orderId } = await context.params;

  try {
    const result = await inTransaction(async (client) => {
      const found = await client.query(
        `SELECT id, status, "paymentStatus", "totalAmount"
           FROM "Order"
          WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3
          FOR UPDATE`,
        [orderId, auth.session.tenantId, auth.session.restaurantId],
      );
      if (!found.rowCount) return { kind: "not_found" as const };
      const order = found.rows[0];
      if (order.paymentStatus === "PAID") return { kind: "already_paid" as const };
      if (order.paymentStatus === "REFUNDED" || order.status === "CANCELLED") {
        return { kind: "invalid_order" as const };
      }

      const amountPaise = Math.round(Number(order.totalAmount) * 100);
      await client.query(
        `INSERT INTO "Payment" ("orderId", provider, method, "providerOrderId",
           "amountPaise", currency, status, "updatedAt")
         VALUES ($1, 'MANUAL', $2, $3, $4, 'INR', 'PAID', NOW())`,
        [orderId, parsed.data.method, `manual_${randomUUID()}`, amountPaise],
      );
      await client.query(
        `UPDATE "Order" SET "paymentStatus" = 'PAID', "updatedAt" = NOW()
          WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
        [orderId, auth.session.tenantId, auth.session.restaurantId],
      );
      return { kind: "ok" as const, amount: Number(order.totalAmount) };
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (result.kind === "already_paid") {
      return NextResponse.json({ error: "This order is already paid" }, { status: 409 });
    }
    if (result.kind === "invalid_order") {
      return NextResponse.json({ error: "Payment cannot be recorded for this order" }, { status: 409 });
    }
    return NextResponse.json({
      payment: { status: "paid", method: parsed.data.method, amount: result.amount },
    });
  } catch (error) {
    console.error("Manual order payment could not be recorded", error);
    return NextResponse.json(
      { error: "Payment could not be recorded" },
      { status: 503 },
    );
  }
}
