import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/prisma";
import { createRazorpayOrder, razorpayKeyId } from "@/lib/razorpay";
import { requireSession } from "@/lib/tenant";

const Body = z
  .object({
    orderId: z.string().min(1),
    tableToken: z.string().min(32).max(64).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.source === "QR") {
    if (!parsed.data.tableToken || !order.tableId) {
      return NextResponse.json(
        { error: "A valid table QR is required to pay for this order" },
        { status: 403 },
      );
    }
    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: order.tableId,
        tenantId: order.tenantId,
        restaurantId: order.restaurantId,
        publicQrToken: parsed.data.tableToken,
        active: true,
      },
      select: { id: true },
    });
    if (!table) {
      return NextResponse.json(
        { error: "A valid table QR is required to pay for this order" },
        { status: 403 },
      );
    }
  } else {
    const auth = await requireSession(["manager", "waiter"]);
    if (!auth.session) return auth.response;
    if (order.tenantId !== auth.session.tenantId || order.restaurantId !== auth.session.restaurantId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
  }
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Payment is unavailable for a cancelled order" },
      { status: 409 },
    );
  }
  if (
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET ||
    !process.env.RAZORPAY_WEBHOOK_SECRET
  ) {
    return NextResponse.json(
      { error: "Online payment is not configured for this restaurant" },
      { status: 503 },
    );
  }

  // Amount is ALWAYS computed server-side from the DB, never from the client.
  const amountPaise = Math.round(Number(order.totalAmount) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 422 });
  }

  // Reuse a still-pending Razorpay order for the same amount (avoids orphans on retry)
  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, status: "PENDING", amountPaise },
    orderBy: { createdAt: "desc" },
  });

  let razorpayOrderId = existing?.providerOrderId;
  if (!razorpayOrderId) {
    try {
      const rp = await createRazorpayOrder(amountPaise, order.id, { orderId: order.id });
      razorpayOrderId = rp.id;
      await prisma.payment.create({
        data: { orderId: order.id, providerOrderId: rp.id, amountPaise },
      });
    } catch (error) {
      console.error("Razorpay order creation failed", error);
      return NextResponse.json(
        { error: "Online payment could not be started" },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    keyId: razorpayKeyId,
    razorpayOrderId,
    amount: amountPaise,
    currency: "INR",
  });
}
