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

// Parse "HH:MM" + late_threshold_minutes to determine if a given time is late
function isLateCheckIn(checkInDate) {
  const s = getOfficeSettings();
  const [startH, startM] = (s.office_start || '09:00').split(':').map(Number);
  const threshold = parseInt(s.late_threshold_minutes) || 30;

  const lateMinute = startM + threshold;
  const lateH = startH + Math.floor(lateMinute / 60);
  const lateM = lateMinute % 60;

  const h = checkInDate.getHours();
  const m = checkInDate.getMinutes();

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

module.exports = { getOfficeSettings, invalidateCache, isLateCheckIn, getHalfDayHours, getMinCheckoutMinutes };
