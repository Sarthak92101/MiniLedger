import { createApp } from './app';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { closePool } from './db/pool';
import { logger } from './lib/logger';

async function main() {
  await runMigrations();

  const app = createApp();

  const server = app.listen(config.port, config.host, () => {
    logger.info(`MiniLedger API listening on http://${config.host}:${config.port}`);
    logger.info(`Environment: ${config.env}`);
    logger.info('Mock OTP enabled — the code is printed to this log on every request');
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    // Force-exit if connections hang.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Failed to start server', { message: (err as Error).message });
  process.exit(1);
});
