import path from 'path';
import { query, queryOne, withTransaction } from '../../db/pool';
import { ApiError } from '../../lib/errors';
import { fromCents } from '../../lib/money';
import { isOverdue, daysUntilDue, todayIso } from '../../lib/dates';

export type LoanStatus = 'pending' | 'repaid';

export interface Loan {
  id: string;
  friendName: string;
  amount: number;
  amountCents: number;
  dueDate: string;
  note: string | null;
  status: LoanStatus;
  isOverdue: boolean;
  daysUntilDue: number;
  daysOverdue: number;
  repaidAt: string | null;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LoanRow {
  id: string;
  friend_name: string;
  amount_cents: number;
  due_date: Date | string;
  note: string | null;
  status: LoanStatus;
  repaid_at: Date | null;
  receipt_path: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Normalise a DATE column to a `YYYY-MM-DD` string.
 *
 * The pg driver is configured to hand DATE columns back as strings, so this is
 * normally a no-op. The Date branch is a defensive fallback that reads
 * *local* calendar parts — which is how `pg` builds its Date objects.
 */
function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mapLoan(row: LoanRow, today: string = todayIso()): Loan {
  const dueDate = toIsoDate(row.due_date);
  const overdue = row.status === 'pending' && isOverdue(dueDate, today);
  const delta = daysUntilDue(dueDate, today);

  return {
    id: row.id,
    friendName: row.friend_name,
    amount: fromCents(row.amount_cents),
    amountCents: row.amount_cents,
    dueDate,
    note: row.note,
    status: row.status,
    isOverdue: overdue,
    daysUntilDue: delta,
    daysOverdue: overdue ? Math.abs(delta) : 0,
    repaidAt: row.repaid_at ? row.repaid_at.toISOString() : null,
    receiptUrl: row.receipt_path,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface CreateLoanInput {
  friendName: string;
  amountCents: number;
  dueDate: string;
  note?: string | null;
  receiptUrl?: string | null;
}

export async function createLoan(userId: string, input: CreateLoanInput): Promise<Loan> {
  const row = await withTransaction(async (client) => {
    if (input.receiptUrl) {
      const filename = path.basename(input.receiptUrl);
      const receipt = await client.query(
        'SELECT filename FROM receipt_uploads WHERE filename = $1 AND user_id = $2',
        [filename, userId],
      );
      if (receipt.rowCount !== 1) {
        throw ApiError.badRequest('Receipt does not belong to this user');
      }
    }

    const result = await client.query<LoanRow>(
      `INSERT INTO loans (user_id, friend_name, amount_cents, due_date, note, receipt_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, friend_name, amount_cents, due_date, note, status,
                 repaid_at, receipt_path, created_at, updated_at`,
      [
        userId,
        input.friendName,
        input.amountCents,
        input.dueDate,
        input.note ?? null,
        input.receiptUrl ?? null,
      ],
    );
    return result.rows[0] ?? null;
  });

  if (!row) throw ApiError.internal('Failed to create loan');
  return mapLoan(row);
}

export interface ListLoansFilters {
  status?: 'all' | 'pending' | 'repaid' | 'overdue';
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listLoans(
  userId: string,
  filters: ListLoansFilters = {},
): Promise<Loan[]> {
  const today = todayIso();
  const conditions: string[] = ['user_id = $1'];
  // $2 is always "today" so the ORDER BY can reference it unconditionally.
  const params: unknown[] = [userId, today];

  if (filters.status === 'pending') {
    conditions.push(`status = 'pending'`);
  } else if (filters.status === 'repaid') {
    conditions.push(`status = 'repaid'`);
  } else if (filters.status === 'overdue') {
    conditions.push(`status = 'pending' AND due_date < $2`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`friend_name ILIKE $${params.length}`);
  }

  params.push(filters.limit ?? 100);
  const limitParam = params.length;

  params.push(filters.offset ?? 0);
  const offsetParam = params.length;

  const rows = await query<LoanRow>(
    `SELECT id, friend_name, amount_cents, due_date, note, status,
            repaid_at, receipt_path, created_at, updated_at
       FROM loans
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE WHEN status = 'pending' AND due_date < $2 THEN 0 ELSE 1 END,
        due_date ASC,
        created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params,
  );

  return rows.map((row) => mapLoan(row, today));
}

export async function getLoan(userId: string, loanId: string): Promise<Loan | null> {
  const row = await queryOne<LoanRow>(
    `SELECT id, friend_name, amount_cents, due_date, note, status,
            repaid_at, receipt_path, created_at, updated_at
       FROM loans
      WHERE id = $1 AND user_id = $2`,
    [loanId, userId],
  );

  return row ? mapLoan(row) : null;
}

export async function getLoanOrThrow(userId: string, loanId: string): Promise<Loan> {
  const loan = await getLoan(userId, loanId);
  if (!loan) throw ApiError.notFound('Loan not found');
  return loan;
}

/** Mark a loan as repaid. Idempotent — re-marking keeps the original date. */
export async function markLoanRepaid(
  userId: string,
  loanId: string,
  repaidAt?: string,
): Promise<Loan> {
  const existing = await getLoan(userId, loanId);
  if (!existing) throw ApiError.notFound('Loan not found');

  const row = await queryOne<LoanRow>(
    `UPDATE loans
        SET status = 'repaid',
            repaid_at = COALESCE(repaid_at, $3),
            updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, friend_name, amount_cents, due_date, note, status,
                repaid_at, receipt_path, created_at, updated_at`,
    [loanId, userId, repaidAt ?? new Date().toISOString()],
  );

  if (!row) throw ApiError.notFound('Loan not found');
  return mapLoan(row);
}

/** Re-open a repaid loan (undo). */
export async function markLoanPending(userId: string, loanId: string): Promise<Loan> {
  const row = await queryOne<LoanRow>(
    `UPDATE loans
        SET status = 'pending', repaid_at = NULL, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, friend_name, amount_cents, due_date, note, status,
                repaid_at, receipt_path, created_at, updated_at`,
    [loanId, userId],
  );

  if (!row) throw ApiError.notFound('Loan not found');
  return mapLoan(row);
}

export async function deleteLoan(userId: string, loanId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    'DELETE FROM loans WHERE id = $1 AND user_id = $2 RETURNING id',
    [loanId, userId],
  );

  if (!row) throw ApiError.notFound('Loan not found');
}
