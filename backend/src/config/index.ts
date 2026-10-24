import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

if (nodeEnv === 'production') {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be explicitly configured in production');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('dev-')) {
    throw new Error('Production requires a JWT_SECRET of at least 32 characters');
  }
  // This project deliberately uses a log-only OTP for local demonstrations.
  // Do not accidentally deploy it as a real phone authentication service.
  throw new Error('Mock OTP is enabled in this build; configure an SMS provider before production');
}

const port = int('PORT', 3000);
if (port > 65_535) throw new Error('PORT must be between 1 and 65535');

const otpLength = int('OTP_LENGTH', 6);
if (otpLength < 4 || otpLength > 8) throw new Error('OTP_LENGTH must be between 4 and 8');

const otpTtlSeconds = int('OTP_TTL_SECONDS', 300);
if (otpTtlSeconds > 3_600) throw new Error('OTP_TTL_SECONDS cannot exceed 3600');

const otpMaxAttempts = int('OTP_MAX_ATTEMPTS', 5);
if (otpMaxAttempts > 10) throw new Error('OTP_MAX_ATTEMPTS cannot exceed 10');

export const config = {
  env: nodeEnv,
  isTest: nodeEnv === 'test',
  port,
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: required(
    'DATABASE_URL',
    'postgres://postgres:postgres@localhost:5432/miniledger',
  ),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  otpLength,
  otpTtlSeconds,
  otpMaxAttempts,
  maxUploadBytes: int('MAX_UPLOAD_BYTES', 5 * 1024 * 1024),
  uploadDir: process.env.UPLOAD_DIR ?? path.resolve(__dirname, '../../uploads'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'test' ? 'silent' : 'info'),
} as const;

export type AppConfig = typeof config;
