import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/database";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  isExpenseDate,
} from "@/lib/expenses";
import { requireSession } from "@/lib/tenant";

const expenseSchema = z
  .object({
    amount: z.number().positive().max(10_000_000),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().max(1000).optional().default(""),
    expenseDate: z.string().refine(isExpenseDate, "Enter a valid expense date"),
    paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  })
  .strict();

function validOptionalDate(value: string | null): value is string | null {
  return value === null || isExpenseDate(value);
}

export async function GET(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  const search = new URL(request.url).searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const category = search.get("category");
  if (
    !validOptionalDate(from) ||
    !validOptionalDate(to) ||
    (from && to && from > to) ||
    (category && !EXPENSE_CATEGORIES.some((value) => value === category))
  ) {
    return NextResponse.json(
      { error: "Invalid expense filters" },
      { status: 400 },
    );
  }

  const categoryFilter = category || null;
  const filterValues = [
    auth.session.tenantId,
    auth.session.restaurantId,
    from,
    to,
    categoryFilter,
  ];
  const where = `e."tenantId" = $1 AND e."restaurantId" = $2
    AND ($3::date IS NULL OR e."expenseDate" >= $3::date)
    AND ($4::date IS NULL OR e."expenseDate" <= $4::date)
    AND ($5::text IS NULL OR e.category = $5::text)`;

  try {
    const [expensesResult, summaryResult, dailyResult, monthlyResult] =
      await Promise.all([
        pool.query(
          `SELECT e.id, e.amount, e.category, e.description,
                  e."expenseDate", e."paymentMethod", e."createdAt",
                  u.name AS "createdBy"
             FROM "Expense" e
             JOIN "User" u ON u.id = e."createdById" AND u."tenantId" = e."tenantId"
            WHERE ${where}
            ORDER BY e."expenseDate" DESC, e."createdAt" DESC
            LIMIT 500`,
          filterValues,
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count,
                  COALESCE(SUM(e.amount), 0)::text AS total,
                  COALESCE(SUM(e.amount) FILTER (
                    WHERE e."expenseDate" =
                      (SELECT (NOW() AT TIME ZONE r.timezone)::date
                         FROM "Restaurant" r
                        WHERE r.id = $2 AND r."tenantId" = $1)
                  ), 0)::text AS "todayTotal",
                  COALESCE(SUM(e.amount) FILTER (
                    WHERE date_trunc('month', e."expenseDate"::timestamp) =
                      date_trunc('month', (
                        SELECT (NOW() AT TIME ZONE r.timezone)::date
                          FROM "Restaurant" r
                         WHERE r.id = $2 AND r."tenantId" = $1
                      )::timestamp)
                  ), 0)::text AS "monthTotal"
             FROM "Expense" e
            WHERE ${where}`,
          filterValues,
        ),
        pool.query(
          `SELECT e."expenseDate"::text AS date,
                  SUM(e.amount)::text AS total
             FROM "Expense" e
            WHERE ${where}
            GROUP BY e."expenseDate"
            ORDER BY e."expenseDate" DESC
            LIMIT 7`,
          filterValues,
        ),
        pool.query(
          `SELECT to_char(e."expenseDate", 'YYYY-MM') AS month,
                  SUM(e.amount)::text AS total
             FROM "Expense" e
            WHERE ${where}
            GROUP BY date_trunc('month', e."expenseDate"::timestamp), month
            ORDER BY date_trunc('month', e."expenseDate"::timestamp) DESC
            LIMIT 6`,
          filterValues,
        ),
      ]);

    return NextResponse.json({
      expenses: expensesResult.rows.map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
        expenseDate:
          expense.expenseDate instanceof Date
            ? expense.expenseDate.toISOString().slice(0, 10)
            : expense.expenseDate,
      })),
      summary: {
        count: Number(summaryResult.rows[0].count),
        total: Number(summaryResult.rows[0].total),
        todayTotal: Number(summaryResult.rows[0].todayTotal),
        monthTotal: Number(summaryResult.rows[0].monthTotal),
      },
      daily: dailyResult.rows.map((row) => ({
        date: row.date,
        total: Number(row.total),
      })),
      monthly: monthlyResult.rows.map((row) => ({
        month: row.month,
        total: Number(row.total),
      })),
    });
  } catch (error) {
    console.error("Expenses could not be loaded", error);
    return NextResponse.json(
      { error: "Expenses are temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(["manager"]);
  if (!auth.session) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid amount, category, date, and payment method" },
      { status: 400 },
    );
  }

  try {
    const result = await pool.query(
      `INSERT INTO "Expense" (
         "tenantId", "restaurantId", "createdById", amount, category,
         description, "expenseDate", "paymentMethod"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8)
       RETURNING id, amount, category, description, "expenseDate",
                 "paymentMethod", "createdAt"`,
      [
        auth.session.tenantId,
        auth.session.restaurantId,
        auth.session.sub,
        parsed.data.amount,
        parsed.data.category,
        parsed.data.description,
        parsed.data.expenseDate,
        parsed.data.paymentMethod,
      ],
    );
    const expense = result.rows[0];
    return NextResponse.json(
      {
        expense: {
          ...expense,
          amount: Number(expense.amount),
          createdBy: auth.session.name,
          expenseDate:
            expense.expenseDate instanceof Date
              ? expense.expenseDate.toISOString().slice(0, 10)
              : expense.expenseDate,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Expense could not be created", error);
    return NextResponse.json(
      { error: "Expense could not be saved" },
      { status: 503 },
    );
  }
}
