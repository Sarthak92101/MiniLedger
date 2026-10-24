import crypto from 'crypto';

/**
 * OTP helpers.
 *
 * The OTP is "mock" in the sense that it is not sent over SMS — the server
 * prints it to the log instead. It is still a real, single-use, time-limited,
 * hashed credential so that the rest of the auth flow is production-shaped.
 */

export function generateOtp(length: number): string {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(length, '0');
}

export function hashOtp(code: string, salt: string): string {
  return crypto.scryptSync(code, salt, 32).toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** Constant-time comparison of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
