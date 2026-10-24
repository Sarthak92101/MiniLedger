/** Shapes returned by the MiniLedger API. */

export interface User {
  id: string;
  phone: string;
  createdAt: string;
}

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

export interface FriendBreakdown {
  friendName: string;
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdueAmount: number;
  entries: number;
}

export interface Summary {
  totalLent: number;
  totalRepaid: number;
  totalOutstanding: number;
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

export type LoanFilter = 'all' | 'pending' | 'overdue' | 'repaid';

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}
