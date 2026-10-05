import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { z } from "zod";
import { inTransaction, pool } from "@/lib/database";
import { findOrCreateMenuCategory } from "@/lib/menu-categories";
import { isUniqueViolation } from "@/lib/account-security";
import { requireSession } from "@/lib/tenant";
import { MAX_MENU_IMPORT_ITEMS } from "@/lib/menu-csv";

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
const bulkMenuSchema = z
  .object({
    items: z.array(menuItemSchema).min(1).max(MAX_MENU_IMPORT_ITEMS),
  })
  .strict();

type MenuDish = z.infer<typeof menuItemSchema>;

async function insertMenuItem(
  client: PoolClient,
  tenantId: string,
  restaurantId: string,
  dish: MenuDish,
) {
  const categoryId = await findOrCreateMenuCategory(
    client,
    tenantId,
    restaurantId,
    dish.category,
  );
  const result = await client.query(
    `INSERT INTO "MenuItem" ("tenantId", "restaurantId", "categoryId", name,
       description, price, vegetarian, available, active, "imageUrl")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
     RETURNING id, name, description, price, vegetarian, available, active, "imageUrl", "categoryId"`,
    [
      tenantId,
      restaurantId,
      categoryId,
      dish.name,
      dish.description,
      dish.price,
      dish.vegetarian,
      dish.available,
      dish.imageUrl || null,
    ],
  );
  return { ...result.rows[0], category: dish.category };
}

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

  const body = await request.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "items" in body
  ) {
    const parsed = bulkMenuSchema.safeParse(body);
    if (!parsed.success) {
      const row = parsed.error.issues.find(
        (issue) => typeof issue.path[1] === "number",
      )?.path[1];
      return NextResponse.json(
        {
          error:
            typeof row === "number"
              ? `Invalid dish details in CSV row ${row + 2}`
              : `Import between 1 and ${MAX_MENU_IMPORT_ITEMS} valid dishes`,
        },
        { status: 400 },
      );
    }

    try {
      const items = await inTransaction(async (client) => {
        const created: Awaited<ReturnType<typeof insertMenuItem>>[] = [];
        for (const dish of parsed.data.items) {
          created.push(
            await insertMenuItem(
              client,
              auth.session!.tenantId,
              auth.session!.restaurantId,
              dish,
            ),
          );
        }
        return created;
      });
      return NextResponse.json(
        { items: items.map((item) => ({ ...item, price: Number(item.price) })) },
        { status: 201 },
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json(
          {
            error:
              "A dish name already exists in this restaurant; no dishes were imported",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Dishes could not be imported" },
        { status: 503 },
      );
    }
  }

  const parsed = menuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid dish name, category, and positive price" },
      { status: 400 },
    );
  }

  try {
    const item = await inTransaction(async (client) => {
      return insertMenuItem(
        client,
        auth.session!.tenantId,
        auth.session!.restaurantId,
        parsed.data,
      );
    });
    return NextResponse.json(
      {
        item: {
          ...item,
          price: Number(item.price),
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
