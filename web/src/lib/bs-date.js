// Bikram Sambat (BS) to/from AD conversion utility
// Verified against nepali-date-converter library and hamropatro.com

// BS month days for years 2070-2090
// Source: nepali-date-converter (verified against hamropatro.com)
// Each entry: [Baisakh, Jestha, Ashadh, Shrawan, Bhadra, Ashwin, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra]
const BS_CALENDAR_DATA = {
  2070: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2073: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2074: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
};

// Reference point: BS 2070/01/01 = AD 2013/04/14
const BS_REF = { year: 2070, month: 1, day: 1 };
const AD_REF = new Date(2013, 3, 14); // April 14, 2013

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

const BS_MONTHS_NP = [
  'बैशाख', 'जेष्ठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKDAYS_SHORT_NP = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'];

const NP_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/**
 * Convert a number to Nepali (Devanagari) digits
 */
export function toNepaliNumeral(num) {
  return String(num).replace(/[0-9]/g, d => NP_DIGITS[d]);
}

/**
 * Get total days in a BS year
 */
function getBsYearDays(year) {
  const months = BS_CALENDAR_DATA[year];
  if (!months) return 365;
  return months.reduce((a, b) => a + b, 0);
}

/**
 * Get days in a specific BS month
 */
export function getBsMonthDays(year, month) {
  const months = BS_CALENDAR_DATA[year];
  if (!months || month < 1 || month > 12) return 30;
  return months[month - 1];
}

/**
 * Convert AD date to BS date
 * @param {Date|string} adDate - AD date (Date object or 'YYYY-MM-DD' string)
 * @returns {{ year: number, month: number, day: number }}
 */
export function adToBs(adDate) {
  const date = typeof adDate === 'string' ? new Date(adDate + 'T00:00:00') : new Date(adDate);
  
  // Calculate days difference from reference
  const diffTime = date.getTime() - AD_REF.getTime();
  let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let bsYear = BS_REF.year;
  let bsMonth = BS_REF.month;
  let bsDay = BS_REF.day;

  // Move forward day by day
  while (diffDays > 0) {
    const daysInMonth = getBsMonthDays(bsYear, bsMonth);
    const daysRemaining = daysInMonth - bsDay;

    if (diffDays <= daysRemaining) {
      bsDay += diffDays;
      diffDays = 0;
    } else {
      diffDays -= (daysRemaining + 1);
      bsMonth++;
      bsDay = 1;
      if (bsMonth > 12) {
        bsMonth = 1;
        bsYear++;
      }
    }
  }

  // Handle negative (past dates before reference)
  while (diffDays < 0) {
    bsDay += diffDays;
    while (bsDay <= 0) {
      bsMonth--;
      if (bsMonth <= 0) {
        bsMonth = 12;
        bsYear--;
      }
      bsDay += getBsMonthDays(bsYear, bsMonth);
    }
    diffDays = 0;
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

/**
 * Convert BS date to AD date
 * @param {number} bsYear
 * @param {number} bsMonth (1-12)
 * @param {number} bsDay
 * @returns {Date}
 */
export function bsToAd(bsYear, bsMonth, bsDay) {
  let totalDays = 0;

  // Count days from reference BS date to target
  // First: days from ref year/month/day to end of ref month
  let y = BS_REF.year;
  let m = BS_REF.month;
  let d = BS_REF.day;

  // If target is same as reference
  if (y === bsYear && m === bsMonth && d === bsDay) {
    return new Date(AD_REF);
  }

  // Move from reference to target
  // Count remaining days in ref month
  totalDays += getBsMonthDays(y, m) - d;
  m++;
  if (m > 12) { m = 1; y++; }

  // Count complete months
  while (y < bsYear || (y === bsYear && m < bsMonth)) {
    totalDays += getBsMonthDays(y, m);
    m++;
    if (m > 12) { m = 1; y++; }
  }

  // Add target day
  totalDays += bsDay;

  const result = new Date(AD_REF);
  result.setDate(result.getDate() + totalDays);
  return result;
}

/**
 * Format BS date as string
 */
export function formatBsDate(bsDate, format = 'long') {
  if (format === 'short') {
    return `${bsDate.year}/${String(bsDate.month).padStart(2, '0')}/${String(bsDate.day).padStart(2, '0')}`;
  }
  return `${bsDate.day} ${BS_MONTHS[bsDate.month - 1]} ${bsDate.year}`;
}

/**
 * Get the day of week (0=Sun...6=Sat) for a BS date
 */
export function getBsDayOfWeek(bsYear, bsMonth, bsDay) {
  const ad = bsToAd(bsYear, bsMonth, bsDay);
  return ad.getDay();
}

/**
 * Get today's BS date
 */
export function getTodayBs() {
  return adToBs(new Date());
}

/**
 * Convert AD date string (YYYY-MM-DD) to BS for display
 */
export function adStringToBsString(adDateStr) {
  const bs = adToBs(adDateStr);
  return formatBsDate(bs, 'short');
}

export { BS_MONTHS, BS_MONTHS_NP, WEEKDAYS_SHORT, WEEKDAYS_SHORT_NP, BS_CALENDAR_DATA };
