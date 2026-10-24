import { closePool, pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';

jest.setTimeout(30_000);

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await closePool();
});

/**
 * Wipes every table between tests so each case starts from a clean slate.
 * TRUNCATE ... CASCADE resets identities and foreign keys in one statement.
 */
export async function resetDatabase(): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE loans, otp_codes, users RESTART IDENTITY CASCADE;
  `);
}

beforeEach(async () => {
  await resetDatabase();
});
