import {
  formatMoney,
  fromCents,
  parseAmountToCents,
  toCents,
} from '../src/lib/money';
import { normalizePhone, maskPhone } from '../src/lib/phone';
import { daysUntilDue, isOverdue, isValidIsoDate, todayIso } from '../src/lib/dates';
import { generateOtp, hashOtp, safeEqual } from '../src/lib/otp';

describe('money helpers', () => {
  it('converts rupees to paise', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.01)).toBe(1);
  });

  it('converts paise back to rupees', () => {
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(1050)).toBe(10.5);
  });

  it('parses numeric input', () => {
    expect(parseAmountToCents(12.34)).toBe(1234);
    expect(parseAmountToCents(0)).toBe(0);
  });

  it('parses string input', () => {
    expect(parseAmountToCents('12.34')).toBe(1234);
    expect(parseAmountToCents(' 12 ')).toBe(1200);
    expect(parseAmountToCents('0.05')).toBe(5);
  });

  it('rejects invalid input', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('12.345')).toBeNull();
    expect(parseAmountToCents('-5')).toBeNull();
    expect(parseAmountToCents('1e5')).toBeNull();
    expect(parseAmountToCents(Number.NaN)).toBeNull();
    expect(parseAmountToCents(null)).toBeNull();
    expect(parseAmountToCents(undefined)).toBeNull();
  });

  it('does not lose precision on tricky decimals', () => {
    // 0.1 + 0.2 style drift is avoided because we work in integer cents.
    expect(parseAmountToCents('1.15')).toBe(115);
    expect(parseAmountToCents('19.99')).toBe(1999);
    expect(parseAmountToCents('1.005')).toBeNull();
    expect(() => toCents(1.005)).toThrow(RangeError);
    expect(fromCents(toCents(0.1) + toCents(0.2))).toBe(0.3);
  });

  it('formats money for display', () => {
    expect(formatMoney(1000)).toBe('₹10.00');
    expect(formatMoney(5)).toBe('₹0.05');
    expect(formatMoney(0)).toBe('₹0.00');
    expect(formatMoney(-250)).toBe('-₹2.50');
  });
});

describe('phone helpers', () => {
  it('normalises a plain 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('98765 43210')).toBe('9876543210');
    expect(normalizePhone('98765-43210')).toBe('9876543210');
    expect(normalizePhone('(987) 654-3210')).toBe('9876543210');
  });

  it('keeps an explicit country code', () => {
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671');
  });

  it('normalises the configured country code to the same national account', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
  });

  it('strips the international 00 prefix', () => {
    expect(normalizePhone('009876543210')).toBe('9876543210');
  });

  it('rejects invalid phone numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1'.repeat(20))).toBeNull();
  });

  it('masks all but the last four digits', () => {
    expect(maskPhone('9876543210')).toBe('******3210');
  });
});

describe('date helpers', () => {
  it('formats today as YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('validates calendar dates', () => {
    expect(isValidIsoDate('2026-01-15')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2023-02-29')).toBe(false);
    expect(isValidIsoDate('15-01-2026')).toBe(false);
    expect(isValidIsoDate('2026-1-5')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('detects overdue dates relative to today', () => {
    expect(isOverdue('2020-01-01', '2026-01-01')).toBe(true);
    expect(isOverdue('2026-01-01', '2026-01-01')).toBe(false);
    expect(isOverdue('2026-01-02', '2026-01-01')).toBe(false);
  });

  it('counts days until due', () => {
    expect(daysUntilDue('2026-01-11', '2026-01-01')).toBe(10);
    expect(daysUntilDue('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysUntilDue('2025-12-27', '2026-01-01')).toBe(-5);
  });
});

describe('otp helpers', () => {
  it('generates a zero-padded numeric code of the requested length', () => {
    const code = generateOtp(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('hashes deterministically for the same salt', () => {
    const salt = 'fixed-salt';
    expect(hashOtp('123456', salt)).toBe(hashOtp('123456', salt));
    expect(hashOtp('123456', salt)).not.toBe(hashOtp('654321', salt));
  });

  it('compares hashes safely', () => {
    const a = hashOtp('123456', 'salt');
    const b = hashOtp('123456', 'salt');
    expect(safeEqual(a, b)).toBe(true);
    expect(safeEqual(a, hashOtp('000000', 'salt'))).toBe(false);
    expect(safeEqual(a, '')).toBe(false);
  });
});
