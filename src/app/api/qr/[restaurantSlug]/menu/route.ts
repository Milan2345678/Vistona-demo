import { NextResponse } from "next/server";
import { pool } from "@/lib/database";

export async function GET(
  _request: Request,
  context: { params: Promise<{ restaurantSlug: string }> },
) {
  const { restaurantSlug } = await context.params;
  try {
    const restaurant = await pool.query(
      `SELECT id, name, "tenantId" FROM "Restaurant" WHERE slug = $1 LIMIT 1`,
      [restaurantSlug],
    );
    if (!restaurant.rowCount)
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 },
      );

    const result = await pool.query(
      `SELECT i.id, i.name, i.description, i.price, i.vegetarian, c.name AS category
         FROM "MenuItem" i JOIN "MenuCategory" c
           ON c.id = i."categoryId" AND c."tenantId" = i."tenantId" AND c."restaurantId" = i."restaurantId"
        WHERE i."tenantId" = $1 AND i."restaurantId" = $2 AND i.available = true
        ORDER BY c."sortOrder", i.name`,
      [restaurant.rows[0].tenantId, restaurant.rows[0].id],
    );
    return NextResponse.json({
      restaurant: restaurant.rows[0],
      menu: result.rows,
    });
  } catch {
    return NextResponse.json(
      { error: "Menu is temporarily unavailable" },
      { status: 503 },
    );
  }
}
