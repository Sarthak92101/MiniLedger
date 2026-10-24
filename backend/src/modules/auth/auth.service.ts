import { config } from '../../config';
import { query, queryOne, withTransaction } from '../../db/pool';
import { ApiError } from '../../lib/errors';
import { generateOtp, generateSalt, hashOtp, safeEqual } from '../../lib/otp';
import { logger } from '../../lib/logger';
import { maskPhone } from '../../lib/phone';
import { signToken } from '../../lib/jwt';

export interface User {
  id: string;
  phone: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  phone: string;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    createdAt: row.created_at.toISOString(),
  };
}

export interface RequestOtpResult {
  /** In a real deployment this would be an SMS; here the code is logged. */
  debugCode?: string;
  expiresInSeconds: number;
}

/**
 * Issue a fresh OTP for a phone number.
 *
 * Any previously unconsumed codes for that phone are invalidated so that only
 * the most recently issued code works.
 */
export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const code = generateOtp(config.otpLength);
  const salt = generateSalt();
  const codeHash = hashOtp(code, salt);
  const expiresAt = new Date(Date.now() + config.otpTtlSeconds * 1000);

  await withTransaction(async (client) => {
    // Serialize sends for this phone, so two concurrent requests cannot leave
    // two valid codes behind or make "latest code" ambiguous.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [phone]);
    await client.query(
      `UPDATE otp_codes
          SET consumed_at = NOW()
        WHERE phone = $1 AND consumed_at IS NULL`,
      [phone],
    );
    await client.query(
      `INSERT INTO otp_codes (phone, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [phone, `${salt}:${codeHash}`, expiresAt],
    );
  });

  // ------------------------------------------------------------------
  // MOCK OTP: the code is printed to the server log instead of being
  // sent over SMS. In production this line would be replaced by a
  // call to the SMS provider.
  // ------------------------------------------------------------------
  logger.info(
    `[mock-otp] phone=${maskPhone(phone)} otp=${code} expiresIn=${config.otpTtlSeconds}s`,
  );

  return {
    debugCode: config.isTest ? code : undefined,
    expiresInSeconds: config.otpTtlSeconds,
  };
}

export interface VerifyOtpResult {
  token: string;
  user: User;
}

/**
 * Verify an OTP and return a signed JWT.
 *
 * Rules:
 *  - the most recent unconsumed code for the phone must match
 *  - the code must not be expired
 *  - a code may only be used a limited number of times
 */
export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const outcome = await withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: string;
      code_hash: string;
      expires_at: Date;
      attempts: number;
    }>(
      `SELECT id, code_hash, expires_at, attempts
         FROM otp_codes
        WHERE phone = $1 AND consumed_at IS NULL
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE`,
      [phone],
    );
    const row = rows[0];
    if (!row) return 'missing' as const;

    if (row.expires_at.getTime() < Date.now()) {
      await client.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1', [row.id]);
      return 'expired' as const;
    }

    if (row.attempts >= config.otpMaxAttempts) {
      await client.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1', [row.id]);
      return 'locked' as const;
    }

    const [salt, expectedHash] = String(row.code_hash).split(':');
    if (!salt || !expectedHash) throw ApiError.internal('Corrupt OTP record');

    if (!safeEqual(expectedHash, hashOtp(code, salt))) {
      await client.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      return 'incorrect' as const;
    }

    // The row lock plus this update makes OTP consumption single-use even if
    // two verification requests arrive at exactly the same time.
    const consumed = await client.query(
      'UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL RETURNING id',
      [row.id],
    );
    return consumed.rowCount === 1 ? ('verified' as const) : ('missing' as const);
  });

  if (outcome === 'expired') {
    throw new ApiError(400, 'OTP_EXPIRED', 'OTP has expired, please request a new one');
  }
  if (outcome === 'locked') {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many incorrect attempts, request a new OTP');
  }
  if (outcome === 'incorrect') {
    throw new ApiError(400, 'INVALID_OTP', 'Incorrect OTP');
  }
  if (outcome !== 'verified') {
    throw new ApiError(400, 'INVALID_OTP', 'No active OTP for this phone number');
  }

  const user = await findOrCreateUser(phone);
  const token = signToken({ sub: user.id, phone: user.phone });

  return { token, user };
}

/** Look up a user by phone, creating one on first successful login. */
export async function findOrCreateUser(phone: string): Promise<User> {
  const existing = await queryOne<UserRow>(
    'SELECT id, phone, created_at FROM users WHERE phone = $1',
    [phone],
  );

  if (existing) return toUser(existing);

  const inserted = await queryOne<UserRow>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, phone, created_at`,
    [phone],
  );

  if (!inserted) throw ApiError.internal('Failed to create user');
  return toUser(inserted);
}

export async function getUserById(id: string): Promise<User | null> {
  const row = await queryOne<UserRow>(
    'SELECT id, phone, created_at FROM users WHERE id = $1',
    [id],
  );
  return row ? toUser(row) : null;
}
