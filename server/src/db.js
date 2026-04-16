const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'attendance.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(path.resolve(__dirname, '..', DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'General',
      designation TEXT NOT NULL DEFAULT 'Employee',
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin', 'employee')),
      phone TEXT,
      avatar TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present', 'late', 'half-day', 'absent')),
      work_hours REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('sick', 'casual', 'earned', 'unpaid', 'other')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      reviewed_by INTEGER,
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (reviewed_by) REFERENCES employees(id)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id);
    CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);

    -- NFC cards linked to employees
    CREATE TABLE IF NOT EXISTS nfc_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_uid TEXT UNIQUE NOT NULL,
      employee_id INTEGER NOT NULL,
      label TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      deactivated_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE INDEX IF NOT EXISTS idx_nfc_cards_uid ON nfc_cards(card_uid);
    CREATE INDEX IF NOT EXISTS idx_nfc_cards_employee ON nfc_cards(employee_id);

    -- NFC reader devices (optional registry)
    CREATE TABLE IF NOT EXISTS nfc_readers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      name TEXT,
      location TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- NFC tap audit log
    CREATE TABLE IF NOT EXISTS nfc_tap_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_uid TEXT NOT NULL,
      device_id TEXT,
      employee_id INTEGER,
      result TEXT NOT NULL,
      attendance_id INTEGER,
      tap_time TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (attendance_id) REFERENCES attendance(id)
    );

    CREATE INDEX IF NOT EXISTS idx_nfc_tap_log_time ON nfc_tap_log(tap_time);
    CREATE INDEX IF NOT EXISTS idx_nfc_tap_log_card ON nfc_tap_log(card_uid);

    -- Public holidays (admin-managed)
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bs_year INTEGER NOT NULL,
      bs_month INTEGER NOT NULL,
      bs_day INTEGER NOT NULL,
      bs_day_end INTEGER,
      bs_month_end INTEGER,
      name TEXT NOT NULL,
      name_np TEXT,
      ad_date TEXT,
      ad_date_end TEXT,
      women_only INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(bs_year);
    CREATE INDEX IF NOT EXISTS idx_holidays_month ON holidays(bs_year, bs_month);

    -- App releases (APK uploads for OTA update)
    CREATE TABLE IF NOT EXISTS app_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      release_notes TEXT DEFAULT '',
      is_mandatory INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (uploaded_by) REFERENCES employees(id)
    );

    -- NFC write jobs (backend queues, reader service picks up)
    CREATE TABLE IF NOT EXISTS nfc_write_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      data_to_write TEXT NOT NULL,
      device_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'cancelled')),
      result_card_uid TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    -- Office settings (key-value config)
    CREATE TABLE IF NOT EXISTS office_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default office settings if empty
  const settingsCount = database.prepare('SELECT COUNT(*) as c FROM office_settings').get().c;
  if (settingsCount === 0) {
    const defaults = {
      office_start: '09:00',
      office_end: '18:00',
      late_threshold_minutes: '30',
      half_day_hours: '4',
      full_day_hours: '8',
      min_checkout_minutes: '2',
      working_days: 'mon,tue,wed,thu,fri',
      timezone: 'Asia/Kathmandu',
      company_name: 'Archisys Innovations',
    };
    const insert = database.prepare('INSERT OR IGNORE INTO office_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaults)) {
      insert.run(k, v);
    }
  }

  // Migration: add must_change_password column for existing databases
  const cols = database.prepare("PRAGMA table_info(employees)").all();
  if (!cols.some(c => c.name === 'must_change_password')) {
    database.exec("ALTER TABLE employees ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
  }

  // Seed default holidays for 2083 if none exist
  const holidayCount = database.prepare('SELECT COUNT(*) as c FROM holidays WHERE bs_year = 2083').get().c;
  if (holidayCount === 0) {
    const insertHoliday = database.prepare(
      'INSERT INTO holidays (bs_year, bs_month, bs_day, bs_day_end, bs_month_end, name, name_np, ad_date, ad_date_end, women_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const defaultHolidays = [
      [2083, 1, 1, null, null, 'Nepali New Year', 'नेपाली नयाँ वर्ष', '2026-04-14', null, 0],
      [2083, 1, 18, null, null, 'International Labour Day', 'अन्तर्राष्ट्रिय श्रमिक दिवस', '2026-05-01', null, 0],
      [2083, 1, 18, null, null, 'Buddha Jayanti', 'बुद्ध जयन्ती', '2026-05-01', null, 0],
      [2083, 2, 15, null, null, 'Republic Day', 'गणतन्त्र दिवस', '2026-05-29', null, 0],
      [2083, 5, 22, null, null, 'Teej (Women Only)', 'तीज (महिलाहरूको लागि मात्र)', '2026-09-07', null, 1],
      [2083, 6, 3, null, null, 'Constitution Day', 'संविधान दिवस', '2026-09-19', null, 0],
      [2083, 6, 31, 5, 7, 'Dashain Festival (6 Days)', 'दशैं पर्व (६ दिन)', '2026-10-17', '2026-10-22', 0],
      [2083, 7, 22, 25, 7, 'Tihar Festival (4 Days)', 'तिहार पर्व (४ दिन)', '2026-11-08', '2026-11-11', 0],
      [2083, 10, 1, null, null, 'Maghe Sankranti', 'माघे संक्रान्ति', '2027-01-15', null, 0],
      [2083, 11, 22, null, null, 'Maha Shivaratri', 'महाशिवरात्रि', '2027-03-06', null, 0],
      [2083, 11, 30, null, null, 'Holi (Fagu Purnima)', 'फागु पूर्णिमा (होली)', '2027-03-14', null, 0],
    ];
    for (const h of defaultHolidays) {
      insertHoliday.run(...h);
    }
  }

  return database;
}

module.exports = { getDB, initDB };
