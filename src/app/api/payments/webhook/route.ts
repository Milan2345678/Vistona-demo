import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { markPaid } from "@/lib/payments";

export const runtime = "nodejs";

// Source of truth: handles users who close the tab after paying.
// Dashboard -> Settings -> Webhooks: URL = https://<domain>/api/payments/webhook,
// secret = RAZORPAY_WEBHOOK_SECRET, event = payment.captured
// (keep Payment Capture = Automatic in dashboard, else you only get payment.authorized).
export async function POST(req: Request) {
  const raw = await req.text(); // must be the RAW body for HMAC
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!sig || !verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  const event = JSON.parse(raw);

  if (event.event === "payment.captured") {
    const p = event.payload.payment.entity;
    const result = await markPaid(p.order_id, p.id, p.amount);
    if (!result.ok && result.reason === "amount_mismatch") {
      console.error("[razorpay] amount mismatch", p.id, p.order_id);
    } else if (!result.ok && result.reason === "already_paid_another_method") {
      console.error(
        "[razorpay] captured payment conflicts with a recorded counter payment",
        p.id,
        p.order_id,
      );
    }
  }
  // payment.failed is intentionally ignored: the customer can retry on the same
  // Razorpay order and succeed, so a failed attempt isn't a terminal state.

  return NextResponse.json({ ok: true }); // always 200 once signature is valid
}
