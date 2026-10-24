/**
 * Tiny structured logger. Keeps output readable in a terminal while still
 * being greppable. Silenced entirely under NODE_ENV=test.
 */

type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const COLORS: Record<Exclude<Level, 'silent'>, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

const RESET = '\x1b[0m';

let threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info;

export function setLogLevel(level: Level) {
  threshold = LEVELS[level];
}

function emit(level: Exclude<Level, 'silent'>, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < threshold) return;

  const stamp = new Date().toISOString();
  const tag = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`;
  const extra = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  // eslint-disable-next-line no-console
  console.log(`${stamp} ${tag} ${message}${extra}`);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};

export type Logger = typeof logger;
