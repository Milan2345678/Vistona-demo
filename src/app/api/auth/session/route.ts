import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
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
