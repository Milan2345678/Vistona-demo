import type { PoolClient } from "pg";

export async function findOrCreateMenuCategory(
  client: PoolClient,
  tenantId: string,
  restaurantId: string,
  name: string,
) {
  const existing = await client.query(
    `SELECT id FROM "MenuCategory"
      WHERE "tenantId" = $1 AND "restaurantId" = $2 AND LOWER(name) = LOWER($3)
      LIMIT 1`,
    [tenantId, restaurantId, name],
  );
  if (existing.rowCount) return existing.rows[0].id as string;

  const result = await client.query(
    `INSERT INTO "MenuCategory" ("tenantId", "restaurantId", name, "sortOrder")
     VALUES ($1, $2, $3,
       (SELECT COALESCE(MAX("sortOrder"), -1) + 1 FROM "MenuCategory"
         WHERE "tenantId" = $1 AND "restaurantId" = $2))
     RETURNING id`,
    [tenantId, restaurantId, name],
  );
  return result.rows[0].id as string;
}
