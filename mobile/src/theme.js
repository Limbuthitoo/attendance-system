export const colors = {
  // Brand
  primary: '#1e40af',
  primaryDark: '#1e3a8a',
  primaryLight: '#dbeafe',
  primaryMuted: '#3b82f6',
  accent: '#0ea5e9',
  accentLight: '#e0f2fe',

  // Neutrals
  white: '#ffffff',
  background: '#f1f5f9',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  card: '#ffffff',

  // Typography
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',

  // Borders & Dividers
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  divider: '#e2e8f0',

  // Semantic
  success: '#059669',
  successLight: '#d1fae5',
  successMuted: '#10b981',
  warning: '#d97706',
  warningLight: '#fef3c7',
  warningMuted: '#f59e0b',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  dangerMuted: '#ef4444',

  // Extended
  purple: '#7c3aed',
  purpleLight: '#ede9fe',
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  teal: '#0d9488',
  tealLight: '#ccfbf1',

  // Header gradient stops
  headerDark: '#0f172a',
  headerMid: '#1e293b',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' },
  h4: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
};

export const shadows = {
  sm: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  md: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  lg: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};
