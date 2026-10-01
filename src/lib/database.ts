import { Pool, type PoolClient } from "pg";

const globalForPool = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
}

export const pool = globalForPool.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalForPool.pgPool = pool;

export async function inTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
