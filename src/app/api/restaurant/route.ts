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
    let menuAvailable = true;
    if (["manager", "waiter"].includes(auth.session.role)) {
      const managerView = auth.session.role === "manager";
      const tableColumns = managerView
        ? `id, number, seats, status, active, "publicQrToken"`
        : `id, number, seats, status, active`;
      const activeFilter = managerView ? "" : "AND active = true";
      const [tableResult, menuResult] = await Promise.all([
        pool.query(
          `SELECT ${tableColumns} FROM "RestaurantTable"
            WHERE "restaurantId" = $1 AND "tenantId" = $2 ${activeFilter}
            ORDER BY number`,
          [auth.session.restaurantId, auth.session.tenantId],
        ),
        pool
          .query(
            `SELECT i.id, i.name, i.description, i.price, i.vegetarian, i.available,
              i."imageUrl", c.name AS category
             FROM "MenuItem" i JOIN "MenuCategory" c ON c.id = i."categoryId"
              AND c."restaurantId" = i."restaurantId" AND c."tenantId" = i."tenantId"
            WHERE i."restaurantId" = $1 AND i."tenantId" = $2 AND i.active = true
            ORDER BY c."sortOrder", i.name`,
              [auth.session.restaurantId, auth.session.tenantId],
          )
          .catch((error: unknown) => {
            console.error("Restaurant menu query failed", error);
            return null;
          }),
      ]);
      tables = tableResult.rows;
      menu = (menuResult?.rows ?? []).map((item) => ({
        ...item,
        price: Number(item.price),
      }));
      menuAvailable = menuResult !== null;
    }
    return NextResponse.json({
      restaurant: restaurantResult.rows[0],
      tables,
      menu,
      menuAvailable,
    });
  } catch {
    return NextResponse.json(
      { error: "Restaurant data is temporarily unavailable" },
      { status: 503 },
    );
  }
}
