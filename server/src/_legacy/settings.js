const { getDB } = require('./db');

// Cached settings with 60s TTL
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

function getOfficeSettings() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) return cache;

  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM office_settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  cache = settings;
  cacheTime = now;
  return settings;
}

function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

/**
 * Get the current date/time in the configured office timezone.
 * Returns a Date-like object but the hours/minutes are in the office timezone.
 */
function getNowInTimezone() {
  const s = getOfficeSettings();
  const tz = s.timezone || 'UTC';
  const now = new Date();
  // Format in the target timezone to extract components
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour'),
    minutes: get('minute'),
    seconds: get('second'),
    // ISO date string in office timezone
    dateString: `${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}`,
    // Full ISO-like timestamp (for storage)
    isoString: now.toISOString(),
  };
}

/**
 * Get today's date string (YYYY-MM-DD) in the configured office timezone.
 */
function getTodayDate() {
  return getNowInTimezone().dateString;
}

// Parse "HH:MM" + late_threshold_minutes to determine if a given time is late
// Now uses the office timezone to evaluate the check-in hour
function isLateCheckIn(checkInDate) {
  const s = getOfficeSettings();
  const [startH, startM] = (s.office_start || '09:00').split(':').map(Number);
  const threshold = parseInt(s.late_threshold_minutes) || 30;

  const lateMinute = startM + threshold;
  const lateH = startH + Math.floor(lateMinute / 60);
  const lateM = lateMinute % 60;

  // Convert check-in time to office timezone
  const tz = s.timezone || 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(checkInDate);

  const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

  return h > lateH || (h === lateH && m > lateM);
}

function getHalfDayHours() {
  const s = getOfficeSettings();
  return parseFloat(s.half_day_hours) || 4;
}

function getMinCheckoutMinutes() {
  const s = getOfficeSettings();
  return parseInt(s.min_checkout_minutes) || 2;
}

module.exports = { getOfficeSettings, invalidateCache, isLateCheckIn, getHalfDayHours, getMinCheckoutMinutes, getNowInTimezone, getTodayDate };
