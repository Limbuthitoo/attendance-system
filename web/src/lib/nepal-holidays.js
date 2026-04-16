// Archisys Innovations — Official Public Holiday Schedule for FY 2083 BS
// Verified against hamropatro.com (https://www.hamropatro.com/calendar/2083)
// Notes:
// - Saturdays are weekly holidays
// - Holidays falling on weekends shall not be substituted unless otherwise notified
// - Festival dates verified from hamropatro.com calendar grid

const HOLIDAYS_2083 = [
  // 1. Nepali New Year — Baisakh 1 (Apr 14, 2026)
  { month: 1, day: 1, name: 'Nepali New Year', nameNp: 'नेपाली नयाँ वर्ष' },

  // 2. Buddha Jayanti / International Labour Day — Baisakh 18 (May 1, 2026)
  { month: 1, day: 18, name: 'Buddha Jayanti / Labour Day', nameNp: 'बुद्ध जयन्ती / श्रमिक दिवस' },

  // 3. Republic Day — Jestha 15 (May 29, 2026)
  { month: 2, day: 15, name: 'Republic Day', nameNp: 'गणतन्त्र दिवस' },

  // 4. Teej (Women Only) — Bhadra 22 (Sep 7, 2026)
  { month: 5, day: 22, name: 'Teej (Women Only)', nameNp: 'तीज (महिलाहरूको लागि मात्र)' },

  // 5. Constitution Day — Ashwin 3 (Sep 19, 2026)
  { month: 6, day: 3, name: 'Constitution Day', nameNp: 'संविधान दिवस' },

  // 5. Dashain Festival (6 Days) — Ashwin 31 to Kartik 5
  //    Fulpati (Ashwin 31 = Oct 17), Maha Ashtami (Kartik 1 = Oct 18),
  //    Maha Navami (Kartik 3 = Oct 20), Vijaya Dashami (Kartik 4 = Oct 21),
  //    Ekadashi (Kartik 5 = Oct 22)
  { month: 6, day: 31, name: 'Dashain — Fulpati', nameNp: 'दशैं — फूलपाती' },
  { month: 7, day: 1, name: 'Dashain — Maha Ashtami', nameNp: 'दशैं — महाअष्टमी' },
  { month: 7, day: 2, name: 'Dashain — Day 3', nameNp: 'दशैं — तेस्रो दिन' },
  { month: 7, day: 3, name: 'Dashain — Maha Navami', nameNp: 'दशैं — महानवमी' },
  { month: 7, day: 4, name: 'Dashain — Vijaya Dashami', nameNp: 'दशैं — विजया दशमी' },
  { month: 7, day: 5, name: 'Dashain — Ekadashi', nameNp: 'दशैं — एकादशी' },

  // 6. Tihar Festival (4 Days) — Kartik 22 to Kartik 25 (Nov 8-11, 2026)
  //    Verified: Kartik 22=Laxmi Puja/Kukur Tihar, 23=Gai Puja, 24=Mha Puja/Govardhan, 25=Bhai Tika
  { month: 7, day: 22, name: 'Tihar — Laxmi Puja', nameNp: 'तिहार — लक्ष्मी पूजा' },
  { month: 7, day: 23, name: 'Tihar — Gai Puja', nameNp: 'तिहार — गाई पूजा' },
  { month: 7, day: 24, name: 'Tihar — Mha Puja / Govardhan', nameNp: 'तिहार — म्ह पूजा / गोवर्धन' },
  { month: 7, day: 25, name: 'Tihar — Bhai Tika', nameNp: 'तिहार — भाइ टीका' },

  // 7. Maghe Sankranti — Magh 1 (Jan 15, 2027)
  { month: 10, day: 1, name: 'Maghe Sankranti', nameNp: 'माघे संक्रान्ति' },

  // 8. Maha Shivaratri — Falgun 22 (Mar 6, 2027)
  { month: 11, day: 22, name: 'Maha Shivaratri', nameNp: 'महाशिवरात्रि' },

  // 9. Holi (Fagu Purnima) — Falgun 30 (Mar 14, 2027) — Purnima day per hamropatro
  { month: 11, day: 30, name: 'Holi (Fagu Purnima)', nameNp: 'फागु पूर्णिमा (होली)' },
];

/**
 * Get holidays for a specific BS month
 */
export function getHolidaysForMonth(year, month) {
  if (year !== 2083) return [];
  return HOLIDAYS_2083.filter(h => h.month === month);
}

/**
 * Get holiday for a specific BS date (if any)
 */
export function getHolidayForDate(year, month, day) {
  if (year !== 2083) return null;
  return HOLIDAYS_2083.find(h => h.month === month && h.day === day) || null;
}

/**
 * Check if a BS date is a holiday
 */
export function isHoliday(year, month, day) {
  return getHolidayForDate(year, month, day) !== null;
}

/**
 * Get all holidays for a BS year
 */
export function getAllHolidays(year) {
  if (year !== 2083) return [];
  return HOLIDAYS_2083;
}

export default HOLIDAYS_2083;
