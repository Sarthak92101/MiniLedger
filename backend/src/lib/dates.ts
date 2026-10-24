/**
 * Date helpers.
 *
 * Due dates are calendar days (no time component). Everything here works in
 * UTC to keep the server deterministic regardless of the machine timezone.
 */

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Today as a `YYYY-MM-DD` string in UTC. */
export function todayIso(now: Date = new Date()): string {
  return startOfUtcDay(now).toISOString().slice(0, 10);
}

/**
 * A due date is overdue when it is strictly before today and the loan has
 * not been repaid.
 */
export function isOverdue(dueDateIso: string, today: string = todayIso()): boolean {
  return dueDateIso < today;
}

/** Whole days between today and the due date (negative when already late). */
export function daysUntilDue(dueDateIso: string, today: string = todayIso()): number {
  const due = Date.parse(`${dueDateIso}T00:00:00.000Z`);
  const base = Date.parse(`${today}T00:00:00.000Z`);
  return Math.round((due - base) / 86_400_000);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when the string is a real calendar date in `YYYY-MM-DD` form. */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Reject things like 2024-02-31 which Date happily rolls over.
  return parsed.toISOString().slice(0, 10) === value;
}
