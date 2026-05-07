// ─────────────────────────────────────────────────────────────────────────────
// Shared Attendance Status Configuration (Mobile)
// Single source of truth for all status labels, colors, and icons.
// ─────────────────────────────────────────────────────────────────────────────
import { colors } from '../theme';

/**
 * All possible attendance statuses (kebab-case, matching API response).
 */
export const ATTENDANCE_STATUSES = [
  'present', 'late', 'half-day', 'absent', 'on-leave',
  'holiday', 'weekly-off', 'missing-checkout', 'early-exit',
];

/**
 * Status labels (human-readable).
 */
export const STATUS_LABELS = {
  present: 'Present',
  late: 'Late',
  'half-day': 'Half Day',
  absent: 'Absent',
  'on-leave': 'On Leave',
  holiday: 'Holiday',
  'weekly-off': 'Weekly Off',
  'missing-checkout': 'Missing C/O',
  'early-exit': 'Early Exit',
};

/**
 * Status config with color, background, and Ionicons icon name.
 */
export const STATUS_CONFIG = {
  present:  { label: 'Present',    color: colors.success,  bg: colors.successLight, icon: 'checkmark-circle' },
  late:     { label: 'Late',       color: colors.warning,  bg: colors.warningLight, icon: 'alert-circle' },
  'half-day': { label: 'Half Day', color: '#ea580c',       bg: '#fff7ed',           icon: 'time' },
  absent:   { label: 'Absent',     color: colors.danger,   bg: colors.dangerLight,  icon: 'close-circle' },
  'on-leave': { label: 'On Leave', color: '#7c3aed',       bg: '#faf5ff',           icon: 'calendar' },
  holiday:  { label: 'Holiday',    color: '#2563eb',       bg: '#eff6ff',           icon: 'sunny' },
  'weekly-off': { label: 'Weekly Off', color: '#4f46e5',   bg: '#eef2ff',           icon: 'cafe' },
  'missing-checkout': { label: 'Missing C/O', color: '#e11d48', bg: '#fff1f2',      icon: 'warning' },
  'early-exit': { label: 'Early Exit', color: '#ec4899',   bg: '#fdf2f8',           icon: 'arrow-down-circle' },
};

const DEFAULT_STATUS = { label: 'Unknown', color: '#64748b', bg: '#f1f5f9', icon: 'ellipse' };

/**
 * Get status config for a given status string (with fallback).
 */
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || DEFAULT_STATUS;
}

/**
 * Get status color for charts/badges.
 */
export function getStatusColor(status) {
  return (STATUS_CONFIG[status]?.color) || colors.textSecondary;
}
