import { adToBs, formatBsDate } from './bs-date';

/**
 * Format a date according to the org's date_format setting.
 *
 * @param {string|Date} date - AD date string (e.g. "2026-05-11") or Date object
 * @param {string} dateFormat - 'AD' | 'BS' | 'BOTH'
 * @param {object} [options]
 * @param {'short'|'long'} [options.style='short'] - 'short' → "2083/01/28" or "May 11, 2026"; 'long' → "28 Baishakh 2083"
 * @returns {string}
 */
export function formatDate(date, dateFormat = 'AD', options = {}) {
  if (!date) return '—';
  const { style = 'short' } = options;

  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T00:00:00' : '')) : date;
  if (isNaN(d.getTime())) return '—';

  const ad = style === 'long'
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (dateFormat === 'AD') return ad;

  try {
    const bs = adToBs(d);
    const bsStr = formatBsDate(bs, style);

    if (dateFormat === 'BS') return bsStr;
    // BOTH
    return `${bsStr} / ${ad}`;
  } catch {
    // BS conversion failed (out of range), fall back to AD
    return ad;
  }
}

/**
 * Format a date + time string.
 *
 * @param {string|Date} date - Date with time
 * @param {string} dateFormat - 'AD' | 'BS' | 'BOTH'
 * @returns {string}
 */
export function formatDateTime(date, dateFormat = 'AD') {
  if (!date) return '—';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const datePart = formatDate(d, dateFormat);

  return `${datePart}, ${time}`;
}
