import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../src/app';

/**
 * Small helper around supertest that keeps the auth flow short in tests.
 */
export const app: Express = createApp();

export const api = () => request(app);

export interface TestUser {
  id: string;
  phone: string;
  token: string;
}

/** Registers a user through the real OTP flow and returns a bearer token. */
export async function createTestUser(phone = '9876543210'): Promise<TestUser> {
  const otpRes = await api().post('/api/auth/otp/request').send({ phone });
  const code = otpRes.body.debugCode as string;

  const verifyRes = await api()
    .post('/api/auth/otp/verify')
    .send({ phone, otp: code });

  return {
    id: verifyRes.body.user.id,
    phone: verifyRes.body.user.phone,
    token: verifyRes.body.token,
  };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/** Builds a date string relative to today (negative = in the past). */
export function relativeDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
