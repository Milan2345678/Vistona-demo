import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

export async function GET() {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;

  try {
    const result = await pool.query(
      `SELECT service_request.id, service_request.type, service_request.status,
              service_request."createdAt",
              restaurant_table.number AS "tableNumber"
         FROM "TableServiceRequest" service_request
         JOIN "RestaurantTable" restaurant_table
           ON restaurant_table.id = service_request."tableId"
          AND restaurant_table."restaurantId" = service_request."restaurantId"
          AND restaurant_table."tenantId" = service_request."tenantId"
        WHERE service_request."tenantId" = $1
          AND service_request."restaurantId" = $2
          AND service_request.status = 'OPEN'
        ORDER BY service_request."createdAt"`,
      [auth.session.tenantId, auth.session.restaurantId],
    );
    return NextResponse.json({ requests: result.rows });
  } catch (error) {
    console.error("Table service requests could not be loaded", error);
    return NextResponse.json(
      { error: "Table service requests could not be loaded" },
      { status: 503 },
    );
  }
}
