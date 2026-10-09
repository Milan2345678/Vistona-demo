import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const hexColor = /^#[0-9a-fA-F]{6}$/;
const brandingSchema = z
  .object({
    logoUrl: z
      .union([z.string().trim().url().max(2048), z.literal("")])
      .nullable()
      .refine(
        (value) =>
          !value ||
          new URL(value).protocol === "https:",
        "Logo URL must use HTTPS",
      ),
    primaryColor: z.union([z.string().regex(hexColor), z.literal("")]).nullable(),
    accentColor: z.union([z.string().regex(hexColor), z.literal("")]).nullable(),
  })
  .strict();

export async function GET() {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  try {
    const result = await pool.query(
      `SELECT name, "logoUrl", "primaryColor", "accentColor"
         FROM "Restaurant"
        WHERE id = $1 AND "tenantId" = $2`,
      [auth.session.restaurantId, auth.session.tenantId],
    );
    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ restaurant: result.rows[0] });
  } catch (error) {
    console.error("Restaurant branding could not be loaded", error);
    return NextResponse.json(
      { error: "Restaurant branding is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a secure logo URL and valid hex brand colors" },
      { status: 400 },
    );
  }

  try {
    const result = await pool.query(
      `UPDATE "Restaurant"
          SET "logoUrl" = $3,
              "primaryColor" = $4,
              "accentColor" = $5
        WHERE id = $1 AND "tenantId" = $2
        RETURNING name, "logoUrl", "primaryColor", "accentColor"`,
      [
        auth.session.restaurantId,
        auth.session.tenantId,
        parsed.data.logoUrl || null,
        parsed.data.primaryColor || null,
        parsed.data.accentColor || null,
      ],
    );
    if (!result.rowCount) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ restaurant: result.rows[0] });
  } catch (error) {
    console.error("Restaurant branding could not be saved", error);
    return NextResponse.json(
      { error: "Restaurant branding could not be saved" },
      { status: 503 },
    );
  }
}
