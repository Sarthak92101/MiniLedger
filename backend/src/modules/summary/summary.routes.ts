import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { getSummary } from './summary.service';

export const summaryRouter = Router();

summaryRouter.use(requireAuth);

/**
 * GET /api/summary
 *
 * Returns the aggregate position of the user:
 *  - totalLent       — sum of every loan ever recorded
 *  - totalRepaid     — sum of the loans that have been repaid
 *  - totalOutstanding— totalLent - totalRepaid
 *  - overdueAmount   — outstanding money whose due date has already passed
 */
summaryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const summary = await getSummary(req.user!.id);
    res.status(200).json({ summary });
  }),
);
