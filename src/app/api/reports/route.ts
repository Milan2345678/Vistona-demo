import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

const periods = new Set(["today", "week", "month"]);

export async function GET(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  const period = new URL(request.url).searchParams.get("period") ?? "today";
  if (!periods.has(period)) {
    return NextResponse.json({ error: "Invalid report period" }, { status: 400 });
  }
  const dateTrunc = period === "today" ? "day" : period;

  try {
    const result = await pool.query(
      `WITH bounds AS (
         SELECT
           date_trunc($3, NOW() AT TIME ZONE 'Asia/Kolkata')
             AT TIME ZONE 'Asia/Kolkata' AS starts_at
       ),
       scoped AS (
         SELECT o.*
           FROM "Order" o CROSS JOIN bounds b
          WHERE o."tenantId" = $1 AND o."restaurantId" = $2
            AND o."createdAt" >= b.starts_at
            AND o.status <> 'CANCELLED'
       )
       SELECT
         COUNT(*)::int AS "orderCount",
         COUNT(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "paidCount",
         COUNT(*) FILTER (WHERE "paymentStatus" = 'PENDING')::int AS "pendingCount",
         COALESCE(SUM("totalAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::text AS "paidTotal",
         COALESCE(SUM("taxAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::text AS "taxTotal",
         COALESCE(AVG("totalAmount") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::text AS "averagePaidOrder",
         COALESCE(SUM("totalAmount") FILTER (WHERE "paymentStatus" = 'PENDING'), 0)::text AS "pendingTotal"
       FROM scoped`,
      [auth.session.tenantId, auth.session.restaurantId, dateTrunc],
    );
    const hourly = await pool.query(
      `WITH bounds AS (
         SELECT date_trunc($3, NOW() AT TIME ZONE 'Asia/Kolkata')
           AT TIME ZONE 'Asia/Kolkata' AS starts_at
       )
       SELECT to_char(o."createdAt" AT TIME ZONE 'Asia/Kolkata', 'HH24:00') AS hour,
              COUNT(*)::int AS orders,
              COALESCE(SUM(o."totalAmount") FILTER (WHERE o."paymentStatus" = 'PAID'), 0)::text AS sales
         FROM "Order" o CROSS JOIN bounds b
        WHERE o."tenantId" = $1 AND o."restaurantId" = $2
          AND o."createdAt" >= b.starts_at AND o.status <> 'CANCELLED'
        GROUP BY hour ORDER BY hour`,
      [auth.session.tenantId, auth.session.restaurantId, dateTrunc],
    );
    const topItems = await pool.query(
      `WITH bounds AS (
         SELECT date_trunc($3, NOW() AT TIME ZONE 'Asia/Kolkata')
           AT TIME ZONE 'Asia/Kolkata' AS starts_at
       )
       SELECT i."itemName" AS name, SUM(i.quantity)::int AS quantity,
              SUM(i.quantity * i."unitPrice")::text AS sales
         FROM "OrderItem" i
         JOIN "Order" o ON o.id = i."orderId" AND o."tenantId" = i."tenantId"
           AND o."restaurantId" = i."restaurantId"
         CROSS JOIN bounds b
        WHERE o."tenantId" = $1 AND o."restaurantId" = $2
          AND o."createdAt" >= b.starts_at AND o.status <> 'CANCELLED'
        GROUP BY i."itemName" ORDER BY SUM(i.quantity) DESC, name LIMIT 5`,
      [auth.session.tenantId, auth.session.restaurantId, dateTrunc],
    );

    return NextResponse.json({
      period,
      summary: Object.fromEntries(
        Object.entries(result.rows[0]).map(([key, value]) => [
          key,
          typeof value === "string" ? Number(value) : value,
        ]),
      ),
      hourly: hourly.rows.map((row) => ({
        hour: row.hour,
        orders: Number(row.orders),
        sales: Number(row.sales),
      })),
      topItems: topItems.rows.map((row) => ({
        name: row.name,
        quantity: Number(row.quantity),
        sales: Number(row.sales),
      })),
    });
  } catch (error) {
    console.error("Sales report could not be loaded", error);
    return NextResponse.json(
      { error: "Sales report is temporarily unavailable" },
      { status: 503 },
    );
  }
}
