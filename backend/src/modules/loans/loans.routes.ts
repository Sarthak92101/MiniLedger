import { Request, Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { ApiError } from '../../lib/errors';
import { MAX_AMOUNT_CENTS, MIN_AMOUNT_CENTS, parseAmountToCents } from '../../lib/money';
import { isValidIsoDate } from '../../lib/dates';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  createLoan,
  deleteLoan,
  getLoanOrThrow,
  listLoans,
  markLoanPending,
  markLoanRepaid,
} from './loans.service';

/** Params are validated by the `validate` middleware before the handler runs. */
function loanId(req: Request): string {
  return req.params.id as string;
}

export const loansRouter = Router();

loansRouter.use(requireAuth);

const amountSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const cents = parseAmountToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount must be a positive number' });
      return z.NEVER;
    }
    if (cents < MIN_AMOUNT_CENTS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount must be greater than 0' });
      return z.NEVER;
    }
    if (cents > MAX_AMOUNT_CENTS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount is too large' });
      return z.NEVER;
    }
    return cents;
  });

const createLoanSchema = z.object({
  friendName: z
    .string({ required_error: 'friendName is required' })
    .trim()
    .min(1, 'friendName is required')
    .max(120, 'friendName must be at most 120 characters'),
  amount: amountSchema,
  dueDate: z
    .string({ required_error: 'dueDate is required' })
    .refine(isValidIsoDate, 'dueDate must be a valid date in YYYY-MM-DD format'),
  note: z.string().trim().max(500, 'note must be at most 500 characters').optional().nullable(),
  receiptUrl: z
    .string()
    .trim()
    .regex(/^\/api\/uploads\/receipt\/[0-9a-f-]{36}\.(?:jpg|png|webp|heic)$/i, 'receiptUrl must be a MiniLedger receipt path')
    .optional()
    .nullable(),
});

const listLoansSchema = z.object({
  status: z.enum(['all', 'pending', 'repaid', 'overdue']).default('all'),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const uuidSchema = z.string().uuid('id must be a valid UUID');

const repaySchema = z.object({
  repaidAt: z
    .string()
    .datetime({ message: 'repaidAt must be an ISO datetime' })
    .optional(),
});

/**
 * POST /api/loans
 * Body: { friendName, amount, dueDate, note?, receiptUrl? }
 */
loansRouter.post(
  '/',
  validate(createLoanSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      friendName: string;
      amount: number;
      dueDate: string;
      note?: string | null;
      receiptUrl?: string | null;
    };

    const loan = await createLoan(req.user!.id, {
      friendName: body.friendName,
      amountCents: body.amount,
      dueDate: body.dueDate,
      note: body.note ?? null,
      receiptUrl: body.receiptUrl ?? null,
    });

    res.status(201).json({ loan });
  }),
);

/**
 * GET /api/loans
 * Query: ?status=pending|repaid|overdue|all&search=amit&limit=50&offset=0
 */
loansRouter.get(
  '/',
  validate(listLoansSchema, 'query'),
  asyncHandler(async (req, res) => {
    const filters = req.query as unknown as {
      status: 'all' | 'pending' | 'repaid' | 'overdue';
      search?: string;
      limit: number;
      offset: number;
    };

    const loans = await listLoans(req.user!.id, filters);
    res.status(200).json({ loans, count: loans.length });
  }),
);

/**
 * GET /api/loans/:id
 */
loansRouter.get(
  '/:id',
  validate(z.object({ id: uuidSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const loan = await getLoanOrThrow(req.user!.id, loanId(req));
    res.status(200).json({ loan });
  }),
);

/**
 * PATCH /api/loans/:id/repay
 * Marks the loan as repaid. Idempotent.
 */
loansRouter.patch(
  '/:id/repay',
  validate(z.object({ id: uuidSchema }), 'params'),
  validate(repaySchema),
  asyncHandler(async (req, res) => {
    const { repaidAt } = req.body as { repaidAt?: string };
    const loan = await markLoanRepaid(req.user!.id, loanId(req), repaidAt);
    res.status(200).json({ loan });
  }),
);

/**
 * PATCH /api/loans/:id/unrepay
 * Re-opens a repaid loan (undo).
 */
loansRouter.patch(
  '/:id/unrepay',
  validate(z.object({ id: uuidSchema }), 'params'),
  asyncHandler(async (req, res) => {
    const loan = await markLoanPending(req.user!.id, loanId(req));
    res.status(200).json({ loan });
  }),
);

/**
 * DELETE /api/loans/:id
 */
loansRouter.delete(
  '/:id',
  validate(z.object({ id: uuidSchema }), 'params'),
  asyncHandler(async (req, res) => {
    await deleteLoan(req.user!.id, loanId(req));
    res.status(204).send();
  }),
);

/**
 * Guard against a malformed UUID reaching the service layer.
 *
 * Express calls param callbacks with `(req, res, next, value, name)` — the
 * value is the *fourth* argument.
 */
loansRouter.param('id', (_req, _res, next, value: string) => {
  if (!uuidSchema.safeParse(value).success) {
    next(ApiError.badRequest('id must be a valid UUID'));
    return;
  }
  next();
});
