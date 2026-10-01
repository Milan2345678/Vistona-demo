import { hashPassword } from "../src/lib/auth";
import { pool } from "../src/lib/database";

async function seed() {
  const passwordHash = await hashPassword(
    process.env.DEMO_PASSWORD ?? "demo123",
  );
  const tenantResult = await pool.query(
    `INSERT INTO "Tenant" (name, slug) VALUES ('Anndham Family Dhaba', 'anndham')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  const tenantId = tenantResult.rows[0].id as string;
  const restaurantResult = await pool.query(
    `INSERT INTO "Restaurant" ("tenantId", name, slug, city)
     VALUES ($1, 'Anndham Family Dhaba', 'anndham-family-dhaba', 'Jaipur')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city
       WHERE "Restaurant"."tenantId" = EXCLUDED."tenantId" RETURNING id`,
    [tenantId],
  );
  if (!restaurantResult.rowCount) {
    throw new Error(
      "The Anndham restaurant slug is already owned by another tenant",
    );
  }
  const restaurantId = restaurantResult.rows[0].id as string;

  for (const role of ["MANAGER", "WAITER", "KITCHEN"] as const) {
    const roleTitle = role[0] + role.slice(1).toLowerCase();
    await pool.query(
      `INSERT INTO "User" ("tenantId", "restaurantId", name, email, "passwordHash", role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET "tenantId" = EXCLUDED."tenantId", "restaurantId" = EXCLUDED."restaurantId",
         name = EXCLUDED.name, "passwordHash" = EXCLUDED."passwordHash", role = EXCLUDED.role, active = true`,
      [
        tenantId,
        restaurantId,
        `${roleTitle} Demo`,
        `${role.toLowerCase()}@vistona.local`,
        passwordHash,
        role,
      ],
    );
  }

  const tables = [2, 4, 4, 6, 2, 4, 6, 8, 4, 2, 4, 6];
  for (const [index, seats] of tables.entries()) {
    await pool.query(
      `INSERT INTO "RestaurantTable" ("tenantId", "restaurantId", number, seats)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("restaurantId", "tenantId", number) DO UPDATE SET seats = EXCLUDED.seats`,
      [tenantId, restaurantId, `T${String(index + 1).padStart(2, "0")}`, seats],
    );
  }

  const menu = [
    [
      "Starters",
      "Paneer Tikka",
      "Charred cottage cheese, peppers and house spices",
      220,
      true,
    ],
    [
      "Main Course",
      "Butter Chicken",
      "Creamy tomato curry with tandoori chicken",
      320,
      false,
    ],
    [
      "Main Course",
      "Dal Makhani",
      "Slow-cooked black lentils finished with butter",
      220,
      true,
    ],
    [
      "Main Course",
      "Kadhai Paneer",
      "Paneer, onion and peppers in a robust masala",
      280,
      true,
    ],
    [
      "Breads",
      "Butter Naan",
      "Tandoor-baked naan brushed with cultured butter",
      60,
      true,
    ],
    [
      "Breads",
      "Garlic Naan",
      "Soft naan with roasted garlic and coriander",
      80,
      true,
    ],
    [
      "Drinks",
      "Masala Chaas",
      "Chilled buttermilk with cumin and mint",
      70,
      true,
    ],
    [
      "Desserts",
      "Gulab Jamun",
      "Warm khoya dumplings with cardamom syrup",
      120,
      true,
    ],
  ] as const;

  for (const [sortOrder, categoryName] of [
    ...new Set(menu.map(([category]) => category)),
  ].entries()) {
    const categoryResult = await pool.query(
      `INSERT INTO "MenuCategory" ("tenantId", "restaurantId", name, "sortOrder") VALUES ($1, $2, $3, $4)
       ON CONFLICT ("restaurantId", "tenantId", name) DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder" RETURNING id`,
      [tenantId, restaurantId, categoryName, sortOrder],
    );
    const categoryId = categoryResult.rows[0].id as string;
    for (const [, name, description, price, vegetarian] of menu.filter(
      ([itemCategory]) => itemCategory === categoryName,
    )) {
      await pool.query(
        `INSERT INTO "MenuItem" ("tenantId", "restaurantId", "categoryId", name, description, price, vegetarian, available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("restaurantId", "tenantId", name) DO UPDATE SET "categoryId" = EXCLUDED."categoryId",
           description = EXCLUDED.description, price = EXCLUDED.price, vegetarian = EXCLUDED.vegetarian, available = EXCLUDED.available`,
        [
          tenantId,
          restaurantId,
          categoryId,
          name,
          description,
          price,
          vegetarian,
          name !== "Masala Chaas",
        ],
      );
    }
  }

  const milanTenantResult = await pool.query(
    `INSERT INTO "Tenant" (name, slug) VALUES ('Milan Restaurant', 'milan-restaurant')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  const milanTenantId = milanTenantResult.rows[0].id as string;
  const milanRestaurantResult = await pool.query(
    `INSERT INTO "Restaurant" ("tenantId", name, slug, city)
     VALUES ($1, 'Milan Restaurant', 'milan-restaurant', 'Pune')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city
       WHERE "Restaurant"."tenantId" = EXCLUDED."tenantId" RETURNING id`,
    [milanTenantId],
  );
  if (!milanRestaurantResult.rowCount) {
    throw new Error(
      "The Milan restaurant slug is already owned by another tenant",
    );
  }
  const milanRestaurantId = milanRestaurantResult.rows[0].id as string;
  await pool.query(
    `INSERT INTO "User" ("tenantId", "restaurantId", name, email, "passwordHash", role)
     VALUES ($1, $2, 'Milan Manager', 'milan@vistona.local', $3, 'MANAGER')
     ON CONFLICT (email) DO UPDATE SET "tenantId" = EXCLUDED."tenantId", "restaurantId" = EXCLUDED."restaurantId",
       name = EXCLUDED.name, "passwordHash" = EXCLUDED."passwordHash", role = EXCLUDED.role, active = true`,
    [milanTenantId, milanRestaurantId, passwordHash],
  );
  await pool.query(
    `INSERT INTO "RestaurantTable" ("tenantId", "restaurantId", number, seats)
     VALUES ($1, $2, 'M01', 4)
     ON CONFLICT ("restaurantId", "tenantId", number) DO UPDATE SET seats = EXCLUDED.seats`,
    [milanTenantId, milanRestaurantId],
  );
  const milanCategoryResult = await pool.query(
    `INSERT INTO "MenuCategory" ("tenantId", "restaurantId", name, "sortOrder")
     VALUES ($1, $2, 'Milan Specials', 0)
     ON CONFLICT ("restaurantId", "tenantId", name) DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder" RETURNING id`,
    [milanTenantId, milanRestaurantId],
  );
  await pool.query(
    `INSERT INTO "MenuItem" ("tenantId", "restaurantId", "categoryId", name, description, price, vegetarian, available)
     VALUES ($1, $2, $3, 'Milan House Thali', 'Demo item for tenant isolation checks', 250, true, true)
     ON CONFLICT ("restaurantId", "tenantId", name) DO UPDATE SET "categoryId" = EXCLUDED."categoryId",
       description = EXCLUDED.description, price = EXCLUDED.price, vegetarian = EXCLUDED.vegetarian, available = EXCLUDED.available`,
    [milanTenantId, milanRestaurantId, milanCategoryResult.rows[0].id],
  );

  console.log(
    "Seeded Anndham Family Dhaba (manager/waiter/kitchen) and Milan Restaurant (manager) for tenant-isolation checks.",
  );
  await pool.end();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});
