import fs from 'fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { queryOne } from '../../db/pool';
import { ApiError } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { validate } from '../../middleware/validate';
import { rateLimitByIp } from '../../middleware/rateLimit';
import { receiptUpload, receiptUrlFor, hasValidReceiptSignature } from './upload.middleware';

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

uploadsRouter.get(
  '/receipt/:filename',
  validate(
    z.object({ filename: z.string().regex(/^[0-9a-f-]{36}\.(?:jpg|png|webp|heic)$/i) }),
    'params',
  ),
  asyncHandler(async (req, res, next) => {
    const filename = req.params.filename!;
    const receipt = await queryOne<{ filename: string }>(
      'SELECT filename FROM receipt_uploads WHERE filename = $1 AND user_id = $2',
      [filename, req.user!.id],
    );
    if (!receipt) throw ApiError.notFound('Receipt not found');

    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filename, { root: config.uploadDir }, (err) => {
      if (err) next(err);
    });
  }),
);

/**
 * POST /api/uploads/receipt
 * Multipart form with a single `receipt` field.
 *
 * Returns a URL that can be passed straight back as `receiptUrl` when
 * creating a loan.
 */
uploadsRouter.post(
  '/receipt',
  rateLimitByIp('receipt-upload', 20, 60 * 60 * 1000),
  receiptUpload.single('receipt'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded. Send multipart/form-data with a "receipt" field.',
        },
      });
      return;
    }

    if (!(await hasValidReceiptSignature(req.file.path, req.file.mimetype))) {
      await fs.unlink(req.file.path);
      res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'The uploaded file contents do not match a supported image type',
        },
      });
      return;
    }

    try {
      await queryOne(
        `INSERT INTO receipt_uploads (filename, user_id)
         VALUES ($1, $2) RETURNING filename`,
        [req.file.filename, req.user!.id],
      );
    } catch (err) {
      await fs.unlink(req.file.path).catch(() => undefined);
      throw err;
    }

    res.status(201).json({
      receiptUrl: receiptUrlFor(req.file.filename),
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  }),
);
