import { pool, closePool } from './pool';
import { migrations } from './migrations';
import { logger } from '../lib/logger';

const MIGRATION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id         TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export async function runMigrations(): Promise<void> {
  await pool.query(MIGRATION_TABLE);

  const { rows } = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      logger.debug(`Migration ${migration.id} already applied`);
      continue;
    }

    logger.info(`Applying migration ${migration.id}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Allow `npm run migrate` to execute this file directly.
if (require.main === module) {
  runMigrations()
    .then(async () => {
      logger.info('Migrations complete');
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error('Migration failed', { message: (err as Error).message });
      await closePool();
      process.exit(1);
    });
}
