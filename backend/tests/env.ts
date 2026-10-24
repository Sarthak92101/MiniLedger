import path from 'path';

/**
 * Loaded by Jest via `setupFiles`, which runs before any test module is
 * imported. Setting the environment here guarantees the database pool picks
 * up the test database rather than the development one from `.env`.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://miniledger:miniledger@localhost:5432/miniledger_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.LOG_LEVEL = 'silent';
process.env.OTP_TTL_SECONDS = process.env.OTP_TTL_SECONDS ?? '300';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(__dirname, '../uploads-test');
