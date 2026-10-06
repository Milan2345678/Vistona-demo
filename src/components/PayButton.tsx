"use client";

import { useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

export default function PayButton({
  orderId,
  tableToken,
  label = "Pay now",
  onPaid,
}: {
  orderId: string;
  tableToken?: string;
  label?: string;
  onPaid?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...(tableToken ? { tableToken } : {}) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not start payment");

      const rzp = new window.Razorpay({
        key: d.keyId,
        amount: d.amount,
        currency: d.currency,
        order_id: d.razorpayOrderId,
        name: "Vistona",
        description: `Order ${orderId}`,
        theme: { color: "#e23744" },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const v = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resp),
          });
          if (v.ok) onPaid?.();
          else setError("Payment received but verification failed. Contact staff.");
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.on("payment.failed", (e: { error?: { description?: string } }) => {
        setError(e.error?.description ?? "Payment failed");
        setLoading(false);
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button
        onClick={pay}
        disabled={loading}
        className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Processing…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}
