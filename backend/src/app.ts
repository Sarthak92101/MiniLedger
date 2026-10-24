import express, { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { authRouter } from './modules/auth/auth.routes';
import { loansRouter } from './modules/loans/loans.routes';
import { summaryRouter } from './modules/summary/summary.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { installAsyncErrorHandling } from './lib/promiseErrors';

/**
 * Builds the Express application. Kept separate from `index.ts` so tests can
 * mount the app without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Must run before any route is registered.
  installAsyncErrorHandling();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!config.isTest) {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'miniledger', env: config.env });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/loans', loansRouter);
  app.use('/api/summary', summaryRouter);
  app.use('/api/uploads', uploadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

