import { prisma } from "@/prisma"; // adjust to your prisma client export

/**
 * Idempotent: verify route and webhook can both call this safely.
 * Pass amountPaise (from webhook) to cross-check against what we created.
 */
export async function markPaid(
  providerOrderId: string,
  providerPaymentId: string,
  amountPaise?: number
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { providerOrderId } });
    if (!payment) return { ok: false as const, reason: "not_found" };
    if (payment.status === "PAID") return { ok: true as const, already: true };
    if (amountPaise !== undefined && amountPaise !== payment.amountPaise) {
      return { ok: false as const, reason: "amount_mismatch" };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", providerPaymentId },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "PAID" },
    });
    return { ok: true as const, already: false };
  });
}
