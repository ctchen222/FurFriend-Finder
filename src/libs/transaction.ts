import type { Pool, PoolClient } from 'pg';

export type DbExecutor = Pick<PoolClient, 'query'>;

/** Run all statements on one PostgreSQL client and always release it. */
export async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the operation's original error; the connection is released below.
    }
    throw error;
  } finally {
    client.release();
  }
}
