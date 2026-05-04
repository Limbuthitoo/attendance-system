require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDB, getDB } = require('./db');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDB();
const db = getDB();

console.log('Seeding database for Archisys Innovations...\n');

// Create admin user
const adminPassword = bcrypt.hashSync('admin123', 10);
const employeePassword = bcrypt.hashSync('password123', 10);

const insertEmployee = db.prepare(`
  INSERT OR IGNORE INTO employees (employee_id, name, email, password, department, designation, role, phone)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const employees = [
  ['ARC-001', 'Admin User', 'admin@archisys.com', adminPassword, 'Management', 'System Administrator', 'admin', '9800000001'],
  ['ARC-002', 'Rajesh Sharma', 'rajesh@archisys.com', employeePassword, 'Engineering', 'Senior Developer', 'employee', '9800000002'],
  ['ARC-003', 'Sita Thapa', 'sita@archisys.com', employeePassword, 'Design', 'UI/UX Designer', 'employee', '9800000003'],
  ['ARC-004', 'Bikash Gurung', 'bikash@archisys.com', employeePassword, 'Engineering', 'Full Stack Developer', 'employee', '9800000004'],
  ['ARC-005', 'Priya Adhikari', 'priya@archisys.com', employeePassword, 'HR', 'HR Manager', 'admin', '9800000005'],
];

for (const emp of employees) {
  insertEmployee.run(...emp);
}

// Seed some attendance records for the current month
const today = new Date();
const insertAttendance = db.prepare(`
  INSERT OR IGNORE INTO attendance (employee_id, date, check_in, check_out, status, work_hours)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (let i = 1; i <= Math.min(today.getDate() - 1, 20); i++) {
  const date = new Date(today.getFullYear(), today.getMonth(), i);
  if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

  const dateStr = date.toISOString().split('T')[0];

  for (let empId = 2; empId <= 5; empId++) {
    const isLate = Math.random() > 0.8;
    const hour = isLate ? 10 : 9;
    const minute = Math.floor(Math.random() * 30);

    const checkIn = new Date(date);
    checkIn.setHours(hour, minute, 0);

    const checkOut = new Date(date);
    checkOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);

    const workHours = ((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2);

    insertAttendance.run(
      empId,
      dateStr,
      checkIn.toISOString(),
      checkOut.toISOString(),
      isLate ? 'late' : 'present',
      parseFloat(workHours)
    );
  }
}

// Seed some leave records
const insertLeave = db.prepare(`
  INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days, reason, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertLeave.run(2, 'sick', '2026-03-25', '2026-03-26', 2, 'Feeling unwell, need rest', 'pending');
insertLeave.run(3, 'casual', '2026-03-28', '2026-03-28', 1, 'Personal errand', 'pending');
insertLeave.run(4, 'earned', '2026-04-01', '2026-04-05', 5, 'Family vacation', 'approved');

console.log('✓ Created employees');
console.log('✓ Seeded attendance records');
console.log('✓ Seeded leave records');
console.log('\nAdmin login: admin@archisys.com / admin123');
console.log('Employee login: rajesh@archisys.com / password123');
console.log('\nSeed complete!');
