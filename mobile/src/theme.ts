/**
 * Design tokens for MiniLedger.
 *
 * Kept in one place so the whole app shares the same spacing, colour and
 * typography rhythm.
 */

export const colors = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F4',

  primary: '#3B5BDB',
  primaryDark: '#2F49A8',
  primarySoft: '#E7ECFD',

  text: '#14181F',
  textMuted: '#67707E',
  textInverse: '#FFFFFF',

  border: '#DFE3EA',
  divider: '#EBEEF3',

  success: '#1F9D55',
  successSoft: '#E4F5EB',

  danger: '#D64545',
  dangerSoft: '#FDE9E9',

  warning: '#C77700',
  warningSoft: '#FFF3E0',

  overdue: '#C92A2A',
  overdueSoft: '#FDECEC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0B1220',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
