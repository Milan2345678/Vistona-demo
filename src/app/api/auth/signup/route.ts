import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatedResponse } from "@/lib/auth-response";
import { hashPassword } from "@/lib/auth";
import { createScopedSlug, isUniqueViolation } from "@/lib/account-security";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/account-input";
import { pool } from "@/lib/database";

const signupSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    restaurantName: nameSchema,
    city: z.string().trim().min(2).max(80),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid restaurant owner details" },
      { status: 400 },
    );
  }
  if (
    !process.env.DATABASE_URL ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    return NextResponse.json(
      { error: "Sign-up is not configured" },
      { status: 503 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query(
      `INSERT INTO "Tenant" (name, slug) VALUES ($1, $2) RETURNING id`,
      [
        parsed.data.restaurantName,
        createScopedSlug(parsed.data.restaurantName),
      ],
    );
    const tenantId = tenant.rows[0].id as string;
    const restaurant = await client.query(
      `INSERT INTO "Restaurant" ("tenantId", name, slug, city)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        tenantId,
        parsed.data.restaurantName,
        createScopedSlug(parsed.data.restaurantName),
        parsed.data.city,
      ],
    );
    const restaurantId = restaurant.rows[0].id as string;
    const user = await client.query(
      `INSERT INTO "User" ("tenantId", "restaurantId", name, email, "passwordHash", role, active)
       VALUES ($1, $2, $3, $4, $5, 'MANAGER', true)
       RETURNING id, "tenantId", "restaurantId", name, email, role, "authVersion"`,
      [
        tenantId,
        restaurantId,
        parsed.data.name,
        parsed.data.email,
        passwordHash,
      ],
    );
    await client.query("COMMIT");
    return authenticatedResponse(user.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Account could not be created" },
      { status: 503 },
    );
  } finally {
    client.release();
  }
}
