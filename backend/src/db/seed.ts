/**
 * Seeds the development database with a couple of demo loans so the mobile
 * app has something to show on first launch.
 *
 *   npm run seed
 */
import { pool, closePool } from './pool';
import { runMigrations } from './migrate';
import { logger } from '../lib/logger';

async function seed() {
  await runMigrations();

  const phone = '9876543210';

  const user = await pool.query(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [phone],
  );
  const userId = user.rows[0].id as string;

  const existing = await pool.query(
    'SELECT COUNT(*)::int AS count FROM loans WHERE user_id = $1',
    [userId],
  );

  if ((existing.rows[0] as { count: number }).count > 0) {
    logger.info('Loans already exist for this user — skipping seed');
    return;
  }

  const today = new Date();
  const inDays = (days: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const rows = [
    ['Amit', 150000, inDays(-12), 'Lunch money I covered'],
    ['Neha', 50000, inDays(-3), 'Movie tickets'],
    ['Rohit', 250000, inDays(9), 'Flight ticket advance'],
    ['Priya', 75000, inDays(21), null],
  ];

  for (const [friend, cents, due, note] of rows) {
    await pool.query(
      `INSERT INTO loans (user_id, friend_name, amount_cents, due_date, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, friend, cents, due, note],
    );
  }

  logger.info(`Seeded 4 loans for ${phone}`);
}

seed()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error('Seed failed', { message: (err as Error).message });
    await closePool();
    process.exit(1);
  });
