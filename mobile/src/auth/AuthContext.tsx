import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiRequestError } from '../api/client';
import { User } from '../api/types';

const TOKEN_KEY = 'miniledger.token';

interface AuthState {
  user: User | null;
  token: string | null;
  /** True while the stored token is being restored on app start. */
  isRestoring: boolean;
  isSubmitting: boolean;
  error: string | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously stored session on cold start.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored || cancelled) return;

        const { user: me } = await api.me(stored);
        if (cancelled) return;
        setToken(stored);
        setUser(me);
      } catch (err) {
        // Only discard a credential the API explicitly rejected. A temporary
        // network/server failure must not destroy a valid saved session.
        if (err instanceof ApiRequestError && err.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.requestOtp(phone);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send the OTP');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.verifyOtp(phone, otp);
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      setToken(result.token);
      setUser(result.user);
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not verify the OTP');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isRestoring,
      isSubmitting,
      error,
      requestOtp,
      verifyOtp,
      logout,
      clearError,
    }),
    [user, token, isRestoring, isSubmitting, error, requestOtp, verifyOtp, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>');
  return ctx;
}
