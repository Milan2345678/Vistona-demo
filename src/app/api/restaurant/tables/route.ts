import { NextResponse } from "next/server";
import { z } from "zod";
import { isUniqueViolation } from "@/lib/account-security";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const createTableSchema = z
  .object({
    number: z.string().trim().min(1).max(20),
    seats: z.number().int().min(1).max(100),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;
  const parsed = createTableSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a table number and a seat count between 1 and 100" },
      { status: 400 },
    );
  }

  try {
    const result = await pool.query(
      `INSERT INTO "RestaurantTable" ("tenantId", "restaurantId", number, seats)
       VALUES ($1, $2, $3, $4)
       RETURNING id, number, seats, status, active, "publicQrToken"`,
      [
        auth.session.tenantId,
        auth.session.restaurantId,
        parsed.data.number,
        parsed.data.seats,
      ],
    );
    return NextResponse.json({ table: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A table with that number already exists in this restaurant" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Table could not be created" },
      { status: 503 },
    );
  }
}
