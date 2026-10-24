import { Platform } from 'react-native';

/**
 * Where the MiniLedger API lives.
 *
 * The value can be overridden at start/build time via `EXPO_PUBLIC_API_URL`.
 *
 * Defaults:
 *  - iOS simulator  -> http://localhost:3000
 *  - Android emulator -> http://10.0.2.2:3000 (the host loopback alias)
 *  - web -> http://localhost:3000
 *
 * On a physical device you must point this at your machine's LAN address,
 * e.g. http://192.168.1.10:3000
 */
const DEFAULT_PORT = 3000;

function defaultBaseUrl(): string {
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  return defaultBaseUrl();
}

export const API_BASE_URL = resolveBaseUrl();

/** Turns a server-relative path into an absolute API URL. */
export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
