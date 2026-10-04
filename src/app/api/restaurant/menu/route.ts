import { NextResponse } from "next/server";
import { z } from "zod";
import { inTransaction, pool } from "@/lib/database";
import { findOrCreateMenuCategory } from "@/lib/menu-categories";
import { isUniqueViolation } from "@/lib/account-security";
import { requireSession } from "@/lib/tenant";

const menuItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional().default(""),
    category: z.string().trim().min(1).max(80),
    price: z.number().positive().max(100000),
    vegetarian: z.boolean().optional().default(false),
    available: z.boolean().optional().default(true),
    imageUrl: z.string().trim().url().max(2048).nullable().optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;
  try {
    const result = await pool.query(
      `SELECT i.id, i.name, i.description, i.price, i.vegetarian, i.available,
              i.active, i."imageUrl", c.id AS "categoryId", c.name AS category,
              c."sortOrder"
         FROM "MenuItem" i
         JOIN "MenuCategory" c ON c.id = i."categoryId"
          AND c."restaurantId" = i."restaurantId" AND c."tenantId" = i."tenantId"
        WHERE i."tenantId" = $1 AND i."restaurantId" = $2 AND i.active = true
        ORDER BY c."sortOrder", i.name`,
      [auth.session.tenantId, auth.session.restaurantId],
    );
    const items = result.rows.map((item) => ({
      ...item,
      price: Number(item.price),
    }));
    const categories = [
      ...new Map(
        items.map((item) => [
          item.categoryId,
          {
            id: item.categoryId,
            name: item.category,
            sortOrder: item.sortOrder,
          },
        ]),
      ).values(),
    ];
    return NextResponse.json({ items, categories });
  } catch {
    return NextResponse.json(
      { error: "Menu is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = menuItemSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid dish name, category, and positive price" },
      { status: 400 },
    );
  }

  try {
    const item = await inTransaction(async (client) => {
      const categoryId = await findOrCreateMenuCategory(
        client,
        auth.session!.tenantId,
        auth.session!.restaurantId,
        parsed.data.category,
      );
      const result = await client.query(
        `INSERT INTO "MenuItem" ("tenantId", "restaurantId", "categoryId", name,
           description, price, vegetarian, available, active, "imageUrl")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
         RETURNING id, name, description, price, vegetarian, available, active, "imageUrl", "categoryId"`,
        [
          auth.session!.tenantId,
          auth.session!.restaurantId,
          categoryId,
          parsed.data.name,
          parsed.data.description,
          parsed.data.price,
          parsed.data.vegetarian,
          parsed.data.available,
          parsed.data.imageUrl || null,
        ],
      );
      return result.rows[0];
    });
    return NextResponse.json(
      {
        item: {
          ...item,
          price: Number(item.price),
          category: parsed.data.category,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A dish with that name already exists in this restaurant" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Dish could not be created" },
      { status: 503 },
    );
  }
}
