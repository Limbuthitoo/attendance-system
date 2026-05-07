// ─────────────────────────────────────────────────────────────────────────────
// Shared Attendance Status Configuration
// Single source of truth for all status labels, colors, and styles.
// ─────────────────────────────────────────────────────────────────────────────

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
  'missing-checkout': 'Missing Checkout',
  'early-exit': 'Early Exit',
};

/**
 * Status badge styles (Tailwind classes).
 */
export const STATUS_BADGE_STYLES = {
  present: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  'half-day': 'bg-orange-100 text-orange-700',
  absent: 'bg-red-100 text-red-700',
  'on-leave': 'bg-purple-100 text-purple-700',
  holiday: 'bg-blue-100 text-blue-700',
  'weekly-off': 'bg-indigo-100 text-indigo-700',
  'missing-checkout': 'bg-rose-100 text-rose-700',
  'early-exit': 'bg-pink-100 text-pink-700',
};

/**
 * Extended status config (colors, borders, dots) for rich UI.
 */
export const STATUS_COLORS = {
  present:  { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500' },
  late:     { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-500' },
  'half-day': { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  absent:   { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200', dot: 'bg-red-500' },
  'on-leave': { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dot: 'bg-purple-500' },
  holiday:  { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200', dot: 'bg-blue-500' },
  'weekly-off': { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'missing-checkout': { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
  'early-exit': { color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', dot: 'bg-pink-500' },
};

/**
 * Render a status badge label for any status string.
 */
export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
}

/**
 * Get badge class for a status.
 */
export function getStatusBadgeClass(status) {
  return STATUS_BADGE_STYLES[status] || 'bg-slate-100 text-slate-700';
}
