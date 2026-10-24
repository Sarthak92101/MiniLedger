import { Pool, types } from 'pg';
import { config } from '../config';
import { logger } from '../lib/logger';

// Return BIGINT as a JS number only when exact integer precision is preserved.
types.setTypeParser(types.builtins.INT8, (value: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error('PostgreSQL BIGINT exceeds JavaScript safe integer range');
  }
  return parsed;
});
// Return NUMERIC as a plain number (amounts are stored as paise/integers, but
// DATE columns are free-form text so this is safe here).
types.setTypeParser(types.builtins.NUMERIC, (value: string) => Number.parseFloat(value));

// Return DATE columns as the raw 'YYYY-MM-DD' string.
//
// By default `pg` parses a DATE into a JS Date at *local* midnight, which
// silently shifts the calendar day for anyone east or west of UTC. Due dates
// are calendar days, so they must never go through a timezone.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected postgres pool error', { message: err.message });
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params as never[]);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
