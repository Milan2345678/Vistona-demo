import { NextResponse } from "next/server";
import { z } from "zod";
import { inTransaction } from "@/lib/database";
import { findOrCreateMenuCategory } from "@/lib/menu-categories";
import { isUniqueViolation } from "@/lib/account-security";
import { requireSession } from "@/lib/tenant";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    price: z.number().positive().max(100000).optional(),
    vegetarian: z.boolean().optional(),
    available: z.boolean().optional(),
    imageUrl: z.string().trim().url().max(2048).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

class MenuItemNotFoundError extends Error {}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ menuItemId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dish update" }, { status: 400 });
  }
  const { menuItemId } = await context.params;

  try {
    const item = await inTransaction(async (client) => {
      const values: unknown[] = [];
      const changes: string[] = [];
      for (const field of [
        "name",
        "description",
        "price",
        "vegetarian",
        "available",
        "imageUrl",
      ] as const) {
        const value = parsed.data[field];
        if (value !== undefined) {
          values.push(value);
          const column = field === "imageUrl" ? '"imageUrl"' : field;
          changes.push(`${column} = $${values.length}`);
        }
      }
      if (parsed.data.category !== undefined) {
        const categoryId = await findOrCreateMenuCategory(
          client,
          auth.session!.tenantId,
          auth.session!.restaurantId,
          parsed.data.category,
        );
        values.push(categoryId);
        changes.push(`"categoryId" = $${values.length}`);
      }
      values.push(
        menuItemId,
        auth.session!.tenantId,
        auth.session!.restaurantId,
      );
      const result = await client.query(
        `UPDATE "MenuItem" SET ${changes.join(", ")}
          WHERE id = $${values.length - 2} AND "tenantId" = $${values.length - 1}
            AND "restaurantId" = $${values.length} AND active = true
          RETURNING id, name, description, price, vegetarian, available, active, "imageUrl", "categoryId"`,
        values,
      );
      if (!result.rowCount) throw new MenuItemNotFoundError();
      const category = await client.query(
        `SELECT name FROM "MenuCategory" WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
        [
          result.rows[0].categoryId,
          auth.session!.tenantId,
          auth.session!.restaurantId,
        ],
      );
      return { ...result.rows[0], category: category.rows[0]?.name };
    });
    return NextResponse.json({ item: { ...item, price: Number(item.price) } });
  } catch (error) {
    if (error instanceof MenuItemNotFoundError) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A dish with that name already exists in this restaurant" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Dish could not be updated" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ menuItemId: string }> },
) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const { menuItemId } = await context.params;
  try {
    const result = await inTransaction(async (client) => {
      const item = await client.query(
        `UPDATE "MenuItem" SET active = false, available = false
          WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true
          RETURNING id, name, description, price, vegetarian, available, active, "imageUrl", "categoryId"`,
        [menuItemId, auth.session!.tenantId, auth.session!.restaurantId],
      );
      if (!item.rowCount) return null;
      const category = await client.query(
        `SELECT name FROM "MenuCategory" WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
        [
          item.rows[0].categoryId,
          auth.session!.tenantId,
          auth.session!.restaurantId,
        ],
      );
      return { ...item.rows[0], category: category.rows[0]?.name };
    });
    if (!result)
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    return NextResponse.json({
      item: { ...result, price: Number(result.price) },
    });
  } catch {
    return NextResponse.json(
      { error: "Dish could not be removed" },
      { status: 503 },
    );
  }
}
