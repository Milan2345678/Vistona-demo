import { NextResponse } from "next/server";
import { z } from "zod";
import { transitionOrder } from "@/lib/orders";
import { requireSession } from "@/lib/tenant";

const statusSchema = z.object({
  status: z.enum(["PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireSession(["manager", "waiter", "kitchen"]);
  if (!auth.session) return auth.response;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid order status" },
      { status: 400 },
    );
  if (parsed.data.status === "CANCELLED" && auth.session.role !== "manager") {
    return NextResponse.json(
      { error: "Only managers can cancel orders" },
      { status: 403 },
    );
  }

  const { orderId } = await context.params;
  try {
    const result = await transitionOrder(
      orderId,
      auth.session.tenantId,
      auth.session.restaurantId,
      auth.session.sub,
      auth.session.role,
      parsed.data.status,
    );
    if (result.kind === "not_found")
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (result.kind === "forbidden")
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    if (result.kind === "invalid_transition") {
      return NextResponse.json(
        {
          error: `Cannot move order from ${result.currentStatus} to ${parsed.data.status}`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ order: result.order });
  } catch {
    return NextResponse.json(
      { error: "Order status could not be updated" },
      { status: 503 },
    );
  }
}
