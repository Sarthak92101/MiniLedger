/**
 * Client-side validation and formatting.
 *
 * The rules mirror the server's Zod schemas so the user gets instant feedback
 * instead of a round-trip that ends in a 400.
 */

/** Money is displayed without trailing zeros: 1500, 1500.5, 12.75 */
export function formatMoney(amount: number, currency = 'INR'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : `${currency} `;
  const fixed = Math.abs(amount).toFixed(2);
  const trimmed = fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${amount < 0 ? '-' : ''}${symbol}${trimmed}`;
}

export function formatMoneyPrecise(amount: number, currency = 'INR'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

/** `2026-01-15` -> `15 Jan 2026` */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Phone number is required';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6) return 'Enter a valid phone number';
  if (digits.length > 15) return 'Phone number is too long';
  if (!/^[+()\-\s\d]+$/.test(trimmed)) return 'Phone number can only contain digits';
  return null;
}

export function validateOtp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter the OTP';
  if (!/^\d{4,8}$/.test(trimmed)) return 'OTP must be 4-8 digits';
  return null;
}

export function validateFriendName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Friend name is required';
  if (trimmed.length > 120) return 'Friend name is too long';
  return null;
}

export function validateAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Amount is required';
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(trimmed)) {
    return 'Enter a valid amount (max 2 decimal places)';
  }
  const parsed = Number(trimmed);
  if (parsed <= 0) return 'Amount must be greater than 0';
  if (parsed > 99_999_999.99) return 'Amount is too large';
  return null;
}

export function validateDueDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Due date is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Use the format YYYY-MM-DD';
  const [year, month, day] = trimmed.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return 'That date does not exist';
  }
  return null;
}

export function validateNote(value: string): string | null {
  if (value.trim().length > 500) return 'Note is too long (max 500 characters)';
  return null;
}
