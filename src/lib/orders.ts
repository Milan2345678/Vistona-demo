import { inTransaction, pool } from "@/lib/database";
import type { PoolClient } from "pg";

export type OrderInputLine = { menuItemId: string; quantity: number };

export class OrderValidationError extends Error {}

type OrderScope = {
  tenantId: string;
  restaurantId: string;
  userId: string | null;
  source: "QR" | "WAITER" | "POS";
  tableId?: string | null;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderInputLine[];
};

async function fetchOrder(
  client: PoolClient,
  orderId: string,
  tenantId: string,
  restaurantId: string,
) {
  const orderResult = await client.query(
    `SELECT o.id, o.number, o.source, o.status, o."paymentStatus", o.notes,
            o."totalAmount", o."createdAt",
            o."customerName", o."customerPhone",
            t.number AS "tableNumber", u.name AS "waiterName"
       FROM "Order" o
       LEFT JOIN "RestaurantTable" t ON t.id = o."tableId" AND t."tenantId" = o."tenantId"
       LEFT JOIN "User" u ON u.id = o."userId" AND u."tenantId" = o."tenantId"
      WHERE o.id = $1 AND o."tenantId" = $2 AND o."restaurantId" = $3`,
    [orderId, tenantId, restaurantId],
  );
  const order = orderResult.rows[0];
  if (!order) return null;

  const itemResult = await client.query(
    `SELECT "menuItemId", "itemName", quantity, "unitPrice"
       FROM "OrderItem"
      WHERE "orderId" = $1 AND "tenantId" = $2 AND "restaurantId" = $3
      ORDER BY id`,
    [orderId, tenantId, restaurantId],
  );
  return {
    ...order,
    amount: Number(order.totalAmount),
    source: String(order.source).toLowerCase(),
    status: String(order.status).toLowerCase(),
    paymentStatus: String(order.paymentStatus).toLowerCase(),
    items: itemResult.rows.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.itemName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
  };
}

export async function createOrder(input: OrderScope) {
  if (!input.items.length || input.items.length > 50) {
    throw new OrderValidationError(
      "An order must contain between 1 and 50 menu items",
    );
  }

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(
      item.menuItemId,
      (quantities.get(item.menuItemId) ?? 0) + item.quantity,
    );
  }
  for (const quantity of quantities.values()) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new OrderValidationError(
        "Item quantities must be between 1 and 99",
      );
    }
  }

  return inTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
      input.restaurantId,
    ]);

    if (input.tableId) {
      const table = await client.query(
        `SELECT id FROM "RestaurantTable"
          WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 AND active = true`,
        [input.tableId, input.tenantId, input.restaurantId],
      );
      if (!table.rowCount)
        throw new OrderValidationError("Table not found for this restaurant");
    }

    const menuResult = await client.query(
      `SELECT id, name, price::text AS price
         FROM "MenuItem"
        WHERE id = ANY($1::text[]) AND "tenantId" = $2 AND "restaurantId" = $3
          AND available = true AND active = true`,
      [[...quantities.keys()], input.tenantId, input.restaurantId],
    );
    if (menuResult.rowCount !== quantities.size) {
      throw new OrderValidationError("One or more menu items are unavailable");
    }

    const menuById = new Map<string, { name: string; price: string }>(
      menuResult.rows.map((item) => [
        item.id,
        { name: item.name, price: item.price },
      ]),
    );
    const lines = [...quantities].map(([menuItemId, quantity]) => {
      const item = menuById.get(menuItemId)!;
      return {
        menuItemId,
        itemName: item.name as string,
        quantity,
        unitPrice: item.price as string,
      };
    });
    const totalCents = lines.reduce(
      (sum, line) =>
        sum + Math.round(Number(line.unitPrice) * 100) * line.quantity,
      0,
    );
    const lastNumber = await client.query(
      `SELECT COALESCE(MAX(number), 1000)::int AS number FROM "Order"
        WHERE "tenantId" = $1 AND "restaurantId" = $2`,
      [input.tenantId, input.restaurantId],
    );
    const number = Number(lastNumber.rows[0].number) + 1;
    const orderResult = await client.query(
      `INSERT INTO "Order" (number, "tenantId", "restaurantId", "tableId", "userId", source, status, notes, "customerName", "customerPhone", "totalAmount", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'NEW', $7, $8, $9, $10, NOW())
       RETURNING id`,
      [
        number,
        input.tenantId,
        input.restaurantId,
        input.tableId ?? null,
        input.userId,
        input.source,
        input.notes ?? "",
        input.customerName ?? null,
        input.customerPhone ?? null,
        (totalCents / 100).toFixed(2),
      ],
    );
    const orderId = orderResult.rows[0].id as string;

    for (const line of lines) {
      await client.query(
        `INSERT INTO "OrderItem" ("tenantId", "restaurantId", "orderId", "menuItemId", "itemName", quantity, "unitPrice")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.tenantId,
          input.restaurantId,
          orderId,
          line.menuItemId,
          line.itemName,
          line.quantity,
          line.unitPrice,
        ],
      );
    }

    const ticket = await client.query(
      `INSERT INTO "KotTicket" ("tenantId", "restaurantId", "orderId", status, "updatedAt")
       VALUES ($1, $2, $3, 'NEW', NOW()) RETURNING id`,
      [input.tenantId, input.restaurantId, orderId],
    );
    await client.query(
      `INSERT INTO "KotEvent" ("tenantId", "restaurantId", "ticketId", "actorId", status, note)
       VALUES ($1, $2, $3, $4, 'NEW', 'Order received')`,
      [input.tenantId, input.restaurantId, ticket.rows[0].id, input.userId],
    );

    if (input.tableId) {
      await client.query(
        `UPDATE "RestaurantTable" SET status = 'OCCUPIED'
          WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
        [input.tableId, input.tenantId, input.restaurantId],
      );
    }

    return fetchOrder(client, orderId, input.tenantId, input.restaurantId);
  });
}

export async function listOrders(
  tenantId: string,
  restaurantId: string,
  since?: Date,
) {
  const result = await pool.query(
    `SELECT id FROM "Order"
      WHERE "tenantId" = $1 AND "restaurantId" = $2 AND ($3::timestamptz IS NULL OR "updatedAt" > $3)
      ORDER BY "createdAt" DESC LIMIT 100`,
    [tenantId, restaurantId, since ?? null],
  );
  const orders = await Promise.all(
    result.rows.map((row) =>
      fetchOrder(pool as unknown as PoolClient, row.id, tenantId, restaurantId),
    ),
  );
  return orders.filter((order) => order !== null);
}

const allowedTransitions: Record<string, string[]> = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED"],
  SERVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function transitionOrder(
  orderId: string,
  tenantId: string,
  restaurantId: string,
  actorId: string,
  role: string,
  nextStatus: string,
) {
  return inTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, status FROM "Order"
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3 FOR UPDATE`,
      [orderId, tenantId, restaurantId],
    );
    if (!found.rowCount) return { kind: "not_found" as const };

    const currentStatus = found.rows[0].status as string;
    const managerCanCancel = role === "manager" && nextStatus === "CANCELLED";
    if (
      !allowedTransitions[currentStatus]?.includes(nextStatus) ||
      (nextStatus === "CANCELLED" && !managerCanCancel)
    ) {
      return { kind: "invalid_transition" as const, currentStatus };
    }
    if (
      ["PREPARING", "READY"].includes(nextStatus) &&
      !["manager", "kitchen"].includes(role)
    ) {
      return { kind: "forbidden" as const };
    }
    if (nextStatus === "SERVED" && !["manager", "waiter"].includes(role)) {
      return { kind: "forbidden" as const };
    }
    if (nextStatus === "COMPLETED" && role !== "manager") {
      return { kind: "forbidden" as const };
    }

    await client.query(
      `UPDATE "Order" SET status = $4, "updatedAt" = NOW()
        WHERE id = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
      [orderId, tenantId, restaurantId, nextStatus],
    );
    await client.query(
      `UPDATE "KotTicket" SET status = $4, "updatedAt" = NOW()
        WHERE "orderId" = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
      [orderId, tenantId, restaurantId, nextStatus],
    );
    await client.query(
      `INSERT INTO "KotEvent" ("tenantId", "restaurantId", "ticketId", "actorId", status)
       SELECT "tenantId", "restaurantId", id, $4, $5 FROM "KotTicket"
        WHERE "orderId" = $1 AND "tenantId" = $2 AND "restaurantId" = $3`,
      [orderId, tenantId, restaurantId, actorId, nextStatus],
    );
    if (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") {
      await client.query(
        `UPDATE "RestaurantTable" SET status = 'AVAILABLE'
          WHERE id = (SELECT "tableId" FROM "Order" WHERE id = $1)
            AND "tenantId" = $2 AND "restaurantId" = $3`,
        [orderId, tenantId, restaurantId],
      );
    } else if (nextStatus === "SERVED") {
      await client.query(
        `UPDATE "RestaurantTable" SET status = 'BILLING'
          WHERE id = (SELECT "tableId" FROM "Order" WHERE id = $1)
            AND "tenantId" = $2 AND "restaurantId" = $3`,
        [orderId, tenantId, restaurantId],
      );
    }
    return {
      kind: "ok" as const,
      order: await fetchOrder(client, orderId, tenantId, restaurantId),
    };
  });
}
