import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/prisma";
import { createRazorpayOrder, razorpayKeyId } from "@/lib/razorpay";

const Body = z.object({ orderId: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
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
    const rp = await createRazorpayOrder(amountPaise, order.id, { orderId: order.id });
    razorpayOrderId = rp.id;
    await prisma.payment.create({
      data: { orderId: order.id, providerOrderId: rp.id, amountPaise },
    });
  }

  return NextResponse.json({
    keyId: razorpayKeyId,
    razorpayOrderId,
    amount: amountPaise,
    currency: "INR",
  });
}
