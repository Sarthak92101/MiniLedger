import { API_BASE_URL } from '../config';
import { ApiErrorBody, Loan, LoanFilter, Summary, User } from './types';

/** Error thrown for any non-2xx API response. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'UNKNOWN') {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Set for multipart uploads — the body is passed straight to fetch. */
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, formData, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiRequestError(
      0,
      `Cannot reach the MiniLedger API at ${API_BASE_URL}. Is the backend running?`,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      errorBody?.error?.code ?? 'UNKNOWN',
    );
  }

  return payload as T;
}

export const api = {
  requestOtp(phone: string) {
    return request<{ phone: string; expiresInSeconds: number }>('/api/auth/otp/request', {
      method: 'POST',
      body: { phone },
    });
  },

  verifyOtp(phone: string, otp: string) {
    return request<{ token: string; user: User }>('/api/auth/otp/verify', {
      method: 'POST',
      body: { phone, otp },
    });
  },

  me(token: string) {
    return request<{ user: User }>('/api/auth/me', { token });
  },

  listLoans(token: string, filter: LoanFilter = 'all', signal?: AbortSignal) {
    const query = filter === 'all' ? '' : `?status=${filter}`;
    return request<{ loans: Loan[]; count: number }>(`/api/loans${query}`, { token, signal });
  },

  createLoan(
    token: string,
    input: {
      friendName: string;
      amount: number | string;
      dueDate: string;
      note?: string | null;
      receiptUrl?: string | null;
    },
  ) {
    return request<{ loan: Loan }>('/api/loans', {
      method: 'POST',
      token,
      body: input,
    });
  },

  markRepaid(token: string, loanId: string) {
    return request<{ loan: Loan }>(`/api/loans/${loanId}/repay`, {
      method: 'PATCH',
      token,
      body: {},
    });
  },

  markUnrepaid(token: string, loanId: string) {
    return request<{ loan: Loan }>(`/api/loans/${loanId}/unrepay`, {
      method: 'PATCH',
      token,
      body: {},
    });
  },

  deleteLoan(token: string, loanId: string) {
    return request<void>(`/api/loans/${loanId}`, { method: 'DELETE', token });
  },

  summary(token: string, signal?: AbortSignal) {
    return request<{ summary: Summary }>('/api/summary', { token, signal });
  },

  /** Uploads a receipt image and returns the URL to attach to a loan. */
  async uploadReceipt(token: string, file: { uri: string; name: string; type: string }) {
    const formData = new FormData();
    // React Native's FormData accepts this shape for file uploads.
    formData.append('receipt', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);

    return request<{ receiptUrl: string; filename: string; size: number }>(
      '/api/uploads/receipt',
      { method: 'POST', token, formData },
    );
  },
};
