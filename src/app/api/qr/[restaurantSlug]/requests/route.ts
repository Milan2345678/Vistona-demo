import { NextResponse } from "next/server";
import { z } from "zod";
import { inTransaction, pool } from "@/lib/database";

const requestSchema = z
  .object({
    tableToken: z.string().trim().min(32).max(64),
    type: z.enum(["BILL", "WATER"]),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ restaurantSlug: string }> },
) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table service request" }, { status: 400 });
  }
  const { restaurantSlug } = await context.params;

  try {
    const restaurantResult = await pool.query(
      `SELECT id, "tenantId" FROM "Restaurant" WHERE slug = $1`,
      [restaurantSlug],
    );
    const restaurant = restaurantResult.rows[0];
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const tableResult = await pool.query(
      `SELECT id FROM "RestaurantTable"
        WHERE "publicQrToken" = $1 AND "restaurantId" = $2
          AND "tenantId" = $3 AND active = true`,
      [parsed.data.tableToken, restaurant.id, restaurant.tenantId],
    );
    const table = tableResult.rows[0];
    if (!table) {
      return NextResponse.json({ error: "Table QR is invalid or inactive" }, { status: 404 });
    }

    const serviceRequest = await inTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
        table.id,
      ]);
      const existing = await client.query(
        `SELECT id FROM "TableServiceRequest"
          WHERE "tableId" = $1 AND type = $2 AND status = 'OPEN' LIMIT 1`,
        [table.id, parsed.data.type],
      );
      if (existing.rowCount) {
        return { id: existing.rows[0].id, repeated: true };
      }

      const created = await client.query(
        `INSERT INTO "TableServiceRequest" ("tenantId", "restaurantId", "tableId", type)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          restaurant.tenantId,
          restaurant.id,
          table.id,
          parsed.data.type,
        ],
      );
      return { id: created.rows[0].id, repeated: false };
    });

    return NextResponse.json(
      { request: { id: serviceRequest.id, type: parsed.data.type, status: "OPEN" } },
      { status: serviceRequest.repeated ? 200 : 201 },
    );
  } catch (error) {
    console.error("QR table service request failed", error);
    return NextResponse.json(
      { error: "Your request could not be sent to the restaurant" },
      { status: 503 },
    );
  }
}
