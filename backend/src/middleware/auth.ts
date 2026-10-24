import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { ApiError } from '../lib/errors';

export interface AuthenticatedUser {
  id: string;
  phone: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Bearer token authentication.
 *
 * The token is issued by `POST /api/auth/otp/verify` and is a HS256 JWT with
 * the user id as the subject.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(ApiError.unauthorized('Missing Authorization: Bearer <token> header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(ApiError.unauthorized('Missing Authorization: Bearer <token> header'));
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, phone: payload.phone };
    next();
  } catch (err) {
    const message =
      (err as Error).name === 'TokenExpiredError'
        ? 'Session expired, please sign in again'
        : 'Invalid authentication token';
    next(ApiError.unauthorized(message));
  }
}
