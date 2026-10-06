import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/tenant";

export async function GET() {
  const result = await resolveSession();
  if (result.status === "unavailable") {
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
  if (result.status === "invalid")
    return NextResponse.json({ user: null }, { status: 401 });
  const session = result.session;
  return NextResponse.json({
    user: {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
      tenantId: session.tenantId,
      restaurantId: session.restaurantId,
      active: true,
    },
  });
}
