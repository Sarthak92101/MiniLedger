import { Router } from 'express';
import { z } from 'zod';
import { normalizePhone } from '../../lib/phone';
import { ApiError } from '../../lib/errors';
import { requestOtp, verifyOtp, getUserById } from './auth.service';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { rateLimitByIp } from '../../middleware/rateLimit';

const requestOtpSchema = z.object({
  phone: z
    .string({ required_error: 'phone is required' })
    .min(6, 'phone must be at least 6 characters')
    .max(20, 'phone must be at most 20 characters'),
});

const verifyOtpSchema = z.object({
  phone: z
    .string({ required_error: 'phone is required' })
    .min(6, 'phone must be at least 6 characters')
    .max(20, 'phone must be at most 20 characters'),
  otp: z
    .string({ required_error: 'otp is required' })
    .regex(/^\d{4,8}$/, 'otp must be 4-8 digits'),
});

export const authRouter = Router();

/**
 * POST /api/auth/otp/request
 * Body: { phone }
 * The OTP is printed to the server log (mock SMS).
 */
authRouter.post(
  '/otp/request',
  rateLimitByIp('otp-request', 5, 10 * 60 * 1000),
  asyncHandler(async (req, res) => {
    const parsed = requestOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid request body', parsed.error.flatten());
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      throw ApiError.badRequest('phone is not a valid phone number');
    }

    const result = await requestOtp(phone);

    res.status(200).json({
      message: 'OTP sent. Check the server logs for the mock code.',
      phone,
      expiresInSeconds: result.expiresInSeconds,
      // Only surfaced in test mode so the mobile client cannot cheat in prod.
      ...(result.debugCode ? { debugCode: result.debugCode } : {}),
    });
  }),
);

/**
 * POST /api/auth/otp/verify
 * Body: { phone, otp }
 * Returns: { token, user }
 */
authRouter.post(
  '/otp/verify',
  rateLimitByIp('otp-verify', 20, 10 * 60 * 1000),
  asyncHandler(async (req, res) => {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid request body', parsed.error.flatten());
    }

    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      throw ApiError.badRequest('phone is not a valid phone number');
    }

    const result = await verifyOtp(phone, parsed.data.otp);

    res.status(200).json(result);
  }),
);

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user!.id);
    if (!user) throw ApiError.unauthorized('User no longer exists');
    res.status(200).json({ user });
  }),
);
