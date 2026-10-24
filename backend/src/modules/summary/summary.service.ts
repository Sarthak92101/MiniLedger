import { query } from '../../db/pool';
import { fromCents } from '../../lib/money';
import { todayIso } from '../../lib/dates';

export interface Summary {
  /** Total value of every loan ever created. */
  totalLent: number;
  /** Total value of loans that have been repaid. */
  totalRepaid: number;
  /** totalLent - totalRepaid — money still owed to you. */
  totalOutstanding: number;
  /** Portion of the outstanding balance whose due date has already passed. */
  overdueAmount: number;
  currency: string;
  counts: {
    total: number;
    pending: number;
    repaid: number;
    overdue: number;
  };
  byFriend: FriendBreakdown[];
}

export interface FriendBreakdown {
  friendName: string;
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdueAmount: number;
  entries: number;
}

interface TotalsRow {
  total_lent_cents: number;
  total_repaid_cents: number;
  overdue_cents: number;
  total_count: number;
  pending_count: number;
  repaid_count: number;
  overdue_count: number;
}

interface FriendRow {
  friend_name: string;
  total_lent_cents: number;
  total_repaid_cents: number;
  overdue_cents: number;
  entries: number;
}

/**
 * Aggregate summary for a user.
 *
 * Every amount is computed with a single scan of the user's loans so the
 * numbers always agree with the list screen.
 */
export async function getSummary(userId: string, currency = 'INR'): Promise<Summary> {
  const today = todayIso();

  const [totals] = await query<TotalsRow>(
    `SELECT
        COALESCE(SUM(amount_cents), 0)::BIGINT                       AS total_lent_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'repaid'), 0)::BIGINT
                                                                     AS total_repaid_cents,
        COALESCE(SUM(amount_cents) FILTER (
          WHERE status = 'pending' AND due_date < $2), 0)::BIGINT    AS overdue_cents,
        COUNT(*)::BIGINT                                            AS total_count,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT           AS pending_count,
        COUNT(*) FILTER (WHERE status = 'repaid')::BIGINT            AS repaid_count,
        COUNT(*) FILTER (
          WHERE status = 'pending' AND due_date < $2)::BIGINT        AS overdue_count
      FROM loans
     WHERE user_id = $1`,
    [userId, today],
  );

  const totalLentCents = Number(totals?.total_lent_cents ?? 0);
  const totalRepaidCents = Number(totals?.total_repaid_cents ?? 0);
  const overdueCents = Number(totals?.overdue_cents ?? 0);

  const friendRows = await query<FriendRow>(
    `SELECT
        friend_name,
        COALESCE(SUM(amount_cents), 0)::BIGINT                    AS total_lent_cents,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'repaid'), 0)::BIGINT
                                                                  AS total_repaid_cents,
        COALESCE(SUM(amount_cents) FILTER (
          WHERE status = 'pending' AND due_date < $2), 0)::BIGINT   AS overdue_cents,
        COUNT(*)::BIGINT                                           AS entries
      FROM loans
     WHERE user_id = $1
     GROUP BY friend_name
     ORDER BY COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'), 0) DESC`,
    [userId, today],
  );

  const byFriend: FriendBreakdown[] = friendRows.map((row) => {
    const lent = Number(row.total_lent_cents);
    const repaid = Number(row.total_repaid_cents);
    return {
      friendName: row.friend_name,
      totalLent: fromCents(lent),
      totalRepaid: fromCents(repaid),
      outstanding: fromCents(lent - repaid),
      overdueAmount: fromCents(Number(row.overdue_cents)),
      entries: Number(row.entries),
    };
  });

  return {
    totalLent: fromCents(totalLentCents),
    totalRepaid: fromCents(totalRepaidCents),
    totalOutstanding: fromCents(totalLentCents - totalRepaidCents),
    overdueAmount: fromCents(overdueCents),
    currency,
    counts: {
      total: Number(totals?.total_count ?? 0),
      pending: Number(totals?.pending_count ?? 0),
      repaid: Number(totals?.repaid_count ?? 0),
      overdue: Number(totals?.overdue_count ?? 0),
    },
    byFriend,
  };
}
