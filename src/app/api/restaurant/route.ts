import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

export async function GET() {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  try {
    const restaurantResult = await pool.query(
      `SELECT r.id, r.name, r.slug, r.city, t.id AS "tenantId", t.name AS "tenantName"
         FROM "Restaurant" r JOIN "Tenant" t ON t.id = r."tenantId"
        WHERE r.id = $1 AND r."tenantId" = $2`,
      [auth.session.restaurantId, auth.session.tenantId],
    );
    if (!restaurantResult.rowCount)
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 },
      );

    let tables: unknown[] = [];
    let menu: unknown[] = [];
    if (["manager", "waiter"].includes(auth.session.role)) {
      const [tableResult, menuResult] = await Promise.all([
        pool.query(
          `SELECT id, number, seats, status FROM "RestaurantTable"
            WHERE "restaurantId" = $1 AND "tenantId" = $2 ORDER BY number`,
          [auth.session.restaurantId, auth.session.tenantId],
        ),
        pool.query(
          `SELECT i.id, i.name, i.description, i.price, i.vegetarian, i.available, c.name AS category
             FROM "MenuItem" i JOIN "MenuCategory" c ON c.id = i."categoryId"
              AND c."restaurantId" = i."restaurantId" AND c."tenantId" = i."tenantId"
            WHERE i."restaurantId" = $1 AND i."tenantId" = $2 ORDER BY c."sortOrder", i.name`,
          [auth.session.restaurantId, auth.session.tenantId],
        ),
      ]);
      tables = tableResult.rows;
      menu = menuResult.rows.map((item) => ({
        ...item,
        price: Number(item.price),
      }));
    }
    return NextResponse.json({
      restaurant: restaurantResult.rows[0],
      tables,
      menu,
    });
  } catch {
    return NextResponse.json(
      { error: "Restaurant data is temporarily unavailable" },
      { status: 503 },
    );
  }
}
