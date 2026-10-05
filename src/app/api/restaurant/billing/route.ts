import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const billingSchema = z.object({
  gstRate: z.number().min(0).max(28),
  gstInclusive: z.boolean(),
});

export async function GET() {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  try {
    const result = await pool.query(
      `SELECT "gstRate", "gstInclusive" FROM "Restaurant"
        WHERE id = $1 AND "tenantId" = $2`,
      [auth.session.restaurantId, auth.session.tenantId],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    return NextResponse.json({
      billing: {
        gstRate: Number(result.rows[0].gstRate),
        gstInclusive: result.rows[0].gstInclusive,
      },
    });
  } catch (error) {
    console.error("Restaurant billing settings could not be loaded", error);
    return NextResponse.json(
      { error: "Billing settings are temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  const parsed = billingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid GST settings" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE "Restaurant" SET "gstRate" = $3, "gstInclusive" = $4
        WHERE id = $1 AND "tenantId" = $2
        RETURNING "gstRate", "gstInclusive"`,
      [
        auth.session.restaurantId,
        auth.session.tenantId,
        parsed.data.gstRate.toFixed(2),
        parsed.data.gstInclusive,
      ],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    return NextResponse.json({
      billing: {
        gstRate: Number(result.rows[0].gstRate),
        gstInclusive: result.rows[0].gstInclusive,
      },
    });
  } catch (error) {
    console.error("Restaurant billing settings could not be saved", error);
    return NextResponse.json(
      { error: "Billing settings could not be saved" },
      { status: 503 },
    );
  }
}
