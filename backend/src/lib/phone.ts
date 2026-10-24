/**
 * Phone number normalisation.
 *
 * Users type phone numbers in many shapes ("+91 98765 43210", "09876543210",
 * "9876543210"). MiniLedger is phone-OTP based, so we normalise to E.164-ish
 * form without the configured default country code: local numbers and their
 * +91 forms resolve to the same account. Other explicit country codes remain
 * prefixed with `+`.
 *
 * The country code is configurable via DEFAULT_COUNTRY_CODE so that the same
 * code works for other locales without changing the client.
 */

export const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? '91';
const DEFAULT_COUNTRY_DIGITS = DEFAULT_COUNTRY_CODE.replace(/\D/g, '');

const MAX_DIGITS = 15;

export function normalizePhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // Reject anything that is not a phone-ish character set.
  if (!/^[+()\-\s\d]+$/.test(trimmed)) return null;

  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (digits === '') return null;

  // International prefix "00" -> strip.
  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // National trunk prefix.
  if (!hasPlus && digits.startsWith('0') && digits.length > 10) {
    digits = digits.replace(/^0+/, '');
  }

  if (
    DEFAULT_COUNTRY_DIGITS &&
    digits.startsWith(DEFAULT_COUNTRY_DIGITS) &&
    digits.length === DEFAULT_COUNTRY_DIGITS.length + 10
  ) {
    return digits.slice(DEFAULT_COUNTRY_DIGITS.length);
  }

  if (digits.length < 6 || digits.length > MAX_DIGITS) return null;

  return hasPlus ? `+${digits}` : digits;
}

/** Display formatting for logs: keep the last 4 digits visible only. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***';
  return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}
