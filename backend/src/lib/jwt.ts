import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * JWT helpers. The token is a standard HS256 JWT carrying the user id as the
 * subject. Kept in one place so signing/verification stay symmetric.
 */

export interface TokenPayload {
  sub: string;
  phone: string;
}

export function signToken(payload: TokenPayload): string {
  // `sub` is already part of the payload — passing it again via options
  // makes jsonwebtoken throw.
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;

  if (!decoded.sub || typeof decoded.phone !== 'string') {
    throw new Error('Malformed token payload');
  }

  return { sub: decoded.sub, phone: decoded.phone };
}
