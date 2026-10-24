/**
 * Money helpers.
 *
 * All amounts are stored and computed in integer paise to avoid floating point
 * drift. The API exposes amounts as decimal numbers (e.g. 1500.50) and also as
 * a string (`amount`) for clients that need exact representation.
 */

export const MIN_AMOUNT_CENTS = 1; // ₹0.01
export const MAX_AMOUNT_CENTS = 99_999_999_99; // ₹99,999,999.99

export function toCents(input: number): number {
  const cents = parseAmountToCents(input);
  if (cents === null) {
    throw new RangeError('Amount must be a non-negative decimal with at most 2 places');
  }
  return cents;
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('Paise amount must be a safe integer');
  }
  return Math.round(cents) / 100;
}

/** Parse a user-supplied amount into paise. Returns null when invalid. */
export function parseAmountToCents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;

  const trimmed = String(value).trim();
  if (trimmed === '') return null;

  // Parse decimal digits directly. Multiplying a floating-point amount by
  // 100 can silently turn values such as 1.005 into the wrong number of paise.
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const rupees = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, '0');
  return `${sign}₹${rupees}.${remainder}`;
}
