import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder, listOrders, OrderValidationError } from "@/lib/orders";
import { requireSession } from "@/lib/tenant";

const createSchema = z.object({
  tableId: z.string().min(1).max(64).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  source: z.enum(["WAITER", "POS"]).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
});

function logOrderError(error: unknown) {
  const dbError = error as { code?: unknown; message?: unknown };
  console.error("[orders]", {
    code: typeof dbError?.code === "string" ? dbError.code : undefined,
    message:
      typeof dbError?.message === "string" ? dbError.message : undefined,
  });
}

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const sinceValue = new URL(request.url).searchParams.get("since");
  const since = sinceValue ? new Date(sinceValue) : undefined;
  if (sinceValue && Number.isNaN(since?.getTime())) {
    return NextResponse.json(
      { error: "Invalid since timestamp" },
      { status: 400 },
    );
  }

  try {
    const orders = await listOrders(
      auth.session.tenantId,
      auth.session.restaurantId,
      since,
    );
    return NextResponse.json({ orders });
  } catch (err) {
    logOrderError(err);
    return NextResponse.json(
      { error: "Orders are temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid order details" },
      { status: 400 },
    );
  if (parsed.data.source === "POS" && auth.session.role !== "manager") {
    return NextResponse.json(
      { error: "Only managers can create POS orders" },
      { status: 403 },
    );
  }

  try {
    const order = await createOrder({
      tenantId: auth.session.tenantId,
      restaurantId: auth.session.restaurantId,
      userId: auth.session.sub,
      source: parsed.data.source ?? "WAITER",
      tableId: parsed.data.tableId,
      notes: parsed.data.notes,
      items: parsed.data.items,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logOrderError(error);
    return NextResponse.json(
      { error: "Order could not be created" },
      { status: 503 },
    );
  }
}
