import { NextResponse } from "next/server";
import { pool } from "@/lib/database";

export async function GET(
  request: Request,
  context: { params: Promise<{ restaurantSlug: string }> },
) {
  const { restaurantSlug } = await context.params;
  const tableToken = new URL(request.url).searchParams.get("tableToken");
  try {
    const restaurant = await pool.query(
      `SELECT id, name, "tenantId", "gstRate", "gstInclusive",
              "logoUrl", "primaryColor", "accentColor"
         FROM "Restaurant" WHERE slug = $1 LIMIT 1`,
      [restaurantSlug],
    );
    if (!restaurant.rowCount)
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 },
      );

    let table: { number: string; status: string } | null = null;
    if (tableToken) {
      const tableResult = await pool.query(
        `SELECT number, status FROM "RestaurantTable"
          WHERE "publicQrToken" = $1 AND "tenantId" = $2 AND "restaurantId" = $3
            AND active = true`,
        [tableToken, restaurant.rows[0].tenantId, restaurant.rows[0].id],
      );
      if (!tableResult.rowCount) {
        return NextResponse.json(
          { error: "Table QR is invalid or inactive" },
          { status: 404 },
        );
      }
      table = tableResult.rows[0];
    }

    const result = await pool.query(
      `SELECT i.id, i.name, i.description, i.price, i.vegetarian, i.available,
              i."imageUrl", c.name AS category
         FROM "MenuItem" i JOIN "MenuCategory" c
           ON c.id = i."categoryId" AND c."tenantId" = i."tenantId" AND c."restaurantId" = i."restaurantId"
        WHERE i."tenantId" = $1 AND i."restaurantId" = $2 AND i.active = true
        ORDER BY c."sortOrder", i.name`,
      [restaurant.rows[0].tenantId, restaurant.rows[0].id],
    );
    return NextResponse.json({
      restaurant: {
        name: restaurant.rows[0].name,
        slug: restaurantSlug,
        logoUrl: restaurant.rows[0].logoUrl,
        primaryColor: restaurant.rows[0].primaryColor,
        accentColor: restaurant.rows[0].accentColor,
      },
      table,
      billing: {
        gstRate: Number(restaurant.rows[0].gstRate),
        gstInclusive: restaurant.rows[0].gstInclusive,
      },
      menu: result.rows.map((item) => ({ ...item, price: Number(item.price) })),
    });
  } catch {
    return NextResponse.json(
      { error: "Menu is temporarily unavailable" },
      { status: 503 },
    );
  }
}
