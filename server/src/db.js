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
  `);

  return database;
}

module.exports = { getDB, initDB };
