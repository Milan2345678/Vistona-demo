import { NextResponse } from "next/server";
import { pool } from "@/lib/database";
import { requireSession } from "@/lib/tenant";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireSession(["manager", "waiter"]);
  if (!auth.session) return auth.response;
  const { requestId } = await context.params;

  try {
    const result = await pool.query(
      `UPDATE "TableServiceRequest"
          SET status = 'DONE', "updatedAt" = NOW()
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3
          AND status = 'OPEN'
        RETURNING id`,
      [requestId, auth.session.tenantId, auth.session.restaurantId],
    );
    if (!result.rowCount) {
      return NextResponse.json({ error: "Open request not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Table service request could not be completed", error);
    return NextResponse.json(
      { error: "Table service request could not be completed" },
      { status: 503 },
    );
  }
}
