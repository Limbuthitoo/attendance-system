/**
 * Migrate data from old SQLite database to new PostgreSQL database.
 * 
 * Run from the server directory:
 *   node scripts/migrate-sqlite-to-pg.js
 * 
 * Requires: DATABASE_URL env var pointing to PostgreSQL
 */

const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const path = require('path');

const prisma = new PrismaClient();
const sqliteDb = new Database(path.join(__dirname, '..', 'data', 'attendance.db'));

// Map old integer IDs to new UUIDs
const employeeIdMap = new Map(); // oldId -> newUUID

async function main() {
  console.log('Starting SQLite → PostgreSQL migration...\n');

  // 1. Create Organization
  const settings = {};
  const settingsRows = sqliteDb.prepare('SELECT key, value FROM office_settings').all();
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  const orgName = settings.company_name || 'Archisys Innovations';
  console.log(`Creating organization: ${orgName}`);

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug: 'archisys',
      subscriptionStatus: 'ACTIVE',
      maxEmployees: 50,
      maxBranches: 5,
      maxDevices: 10,
      settings: {},
      logoUrl: settings.branding_logo || null,
      faviconUrl: settings.branding_favicon || null,
    }
  });
  const orgId = org.id;
  console.log(`  ✓ Organization created: ${orgId}\n`);

  // 2. Create Branch
  const branch = await prisma.branch.create({
    data: {
      orgId,
      name: 'Main Office',
      code: 'HQ',
      timezone: settings.timezone || 'Asia/Kathmandu',
    }
  });
  console.log(`  ✓ Branch created: ${branch.id}\n`);

  // 3. Create Shift from office settings
  const shift = await prisma.shift.create({
    data: {
      orgId,
      branchId: branch.id,
      name: 'Default Shift',
      startTime: settings.office_start || '09:00',
      endTime: settings.office_end || '18:00',
      lateThresholdMinutes: parseInt(settings.late_threshold_minutes) || 30,
      halfDayHours: parseFloat(settings.half_day_hours) || 4,
      fullDayHours: parseFloat(settings.full_day_hours) || 8,
      minCheckoutMinutes: parseInt(settings.min_checkout_minutes) || 2,
      isDefault: true,
    }
  });
  console.log(`  ✓ Shift created: ${shift.id}\n`);

  // 4. Create Work Schedule
  const workingDaysStr = settings.working_days || 'mon,tue,wed,thu,fri';
  const workSchedule = await prisma.workSchedule.create({
    data: {
      orgId,
      name: 'Default Schedule',
      workingDays: workingDaysStr.split(','),
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    }
  });
  console.log(`  ✓ Work Schedule created: ${workSchedule.id}\n`);

  // 5. Enable all modules for the org
  const modules = await prisma.module.findMany();
  for (const mod of modules) {
    await prisma.orgModule.create({
      data: { orgId, moduleId: mod.id, isActive: true }
    });
  }
  console.log(`  ✓ ${modules.length} modules enabled\n`);

  // 6. Get role IDs
  const adminRole = await prisma.role.findFirst({ where: { name: 'org_admin', isSystem: true } });
  const employeeRole = await prisma.role.findFirst({ where: { name: 'employee', isSystem: true } });

  // 7. Migrate Employees
  const employees = sqliteDb.prepare('SELECT * FROM employees').all();
  console.log(`Migrating ${employees.length} employees...`);

  for (const emp of employees) {
    const newId = randomUUID();
    employeeIdMap.set(emp.id, newId);

    await prisma.employee.create({
      data: {
        id: newId,
        orgId,
        employeeCode: emp.employee_id,
        name: emp.name,
        email: emp.email,
        password: emp.password, // already hashed
        department: emp.department,
        designation: emp.designation,
        phone: emp.phone || null,
        avatarUrl: emp.avatar || null,
        mustChangePassword: emp.must_change_password === 1,
        isActive: emp.is_active === 1,
        createdAt: new Date(emp.created_at),
      }
    });

    // Assign role
    const roleId = emp.role === 'admin' ? adminRole.id : employeeRole.id;
    await prisma.employeeRole.create({
      data: {
        employeeId: newId,
        roleId,
      }
    });

    // Assign to branch/shift/schedule
    await prisma.employeeAssignment.create({
      data: {
        employeeId: newId,
        branchId: branch.id,
        shiftId: shift.id,
        workScheduleId: workSchedule.id,
        effectiveFrom: new Date('2026-01-01'),
        isCurrent: true,
      }
    });

    console.log(`  ✓ ${emp.name} (${emp.employee_id}) → ${newId}`);
  }
  console.log('');

  // 8. Migrate Attendance
  const attendanceRows = sqliteDb.prepare('SELECT * FROM attendance').all();
  console.log(`Migrating ${attendanceRows.length} attendance records...`);

  const statusMap = {
    'present': 'PRESENT',
    'late': 'LATE',
    'half-day': 'HALF_DAY',
    'absent': 'ABSENT',
  };

  let attSuccess = 0;
  for (const att of attendanceRows) {
    const employeeId = employeeIdMap.get(att.employee_id);
    if (!employeeId) {
      console.log(`  ⚠ Skipping attendance ${att.id}: unknown employee ${att.employee_id}`);
      continue;
    }

    try {
      await prisma.attendance.create({
        data: {
          orgId,
          employeeId,
          branchId: branch.id,
          date: new Date(att.date),
          checkIn: att.check_in ? new Date(att.check_in) : null,
          checkOut: att.check_out ? new Date(att.check_out) : null,
          status: statusMap[att.status] || 'PRESENT',
          source: 'NFC',
          workHours: att.work_hours || 0,
          notes: att.notes || null,
          createdAt: new Date(att.created_at),
        }
      });
      attSuccess++;
    } catch (e) {
      console.log(`  ⚠ Skipping attendance ${att.id}: ${e.message.slice(0, 80)}`);
    }
  }
  console.log(`  ✓ ${attSuccess}/${attendanceRows.length} attendance records migrated\n`);

  // 9. Migrate Leaves
  const leaveRows = sqliteDb.prepare('SELECT * FROM leaves').all();
  console.log(`Migrating ${leaveRows.length} leave records...`);

  const leaveTypeMap = {
    'sick': 'SICK',
    'casual': 'CASUAL',
    'earned': 'EARNED',
    'unpaid': 'UNPAID',
    'other': 'OTHER',
  };
  const leaveStatusMap = {
    'pending': 'PENDING',
    'approved': 'APPROVED',
    'rejected': 'REJECTED',
  };

  for (const lv of leaveRows) {
    const employeeId = employeeIdMap.get(lv.employee_id);
    if (!employeeId) continue;

    await prisma.leave.create({
      data: {
        orgId,
        employeeId,
        leaveType: leaveTypeMap[lv.leave_type] || 'OTHER',
        startDate: new Date(lv.start_date),
        endDate: new Date(lv.end_date),
        days: lv.days,
        reason: lv.reason,
        status: leaveStatusMap[lv.status] || 'PENDING',
        reviewedBy: lv.reviewed_by ? employeeIdMap.get(lv.reviewed_by) : null,
        reviewNote: lv.review_note || null,
        createdAt: new Date(lv.created_at),
      }
    });
  }
  console.log(`  ✓ ${leaveRows.length} leaves migrated\n`);

  // 10. Migrate Holidays
  const holidayRows = sqliteDb.prepare('SELECT * FROM holidays').all();
  console.log(`Migrating ${holidayRows.length} holidays...`);

  for (const h of holidayRows) {
    await prisma.holiday.create({
      data: {
        orgId,
        bsYear: h.bs_year,
        bsMonth: h.bs_month,
        bsDay: h.bs_day,
        bsDayEnd: h.bs_day_end || null,
        bsMonthEnd: h.bs_month_end || null,
        name: h.name,
        nameNp: h.name_np || null,
        adDate: h.ad_date ? new Date(h.ad_date) : null,
        adDateEnd: h.ad_date_end ? new Date(h.ad_date_end) : null,
        womenOnly: h.women_only === 1,
      }
    });
  }
  console.log(`  ✓ ${holidayRows.length} holidays migrated\n`);

  // 11. Migrate NFC Cards → EmployeeCredentials
  const nfcCards = sqliteDb.prepare('SELECT * FROM nfc_cards').all();
  console.log(`Migrating ${nfcCards.length} NFC cards...`);

  for (const card of nfcCards) {
    const employeeId = employeeIdMap.get(card.employee_id);
    if (!employeeId) continue;

    await prisma.employeeCredential.create({
      data: {
        orgId,
        employeeId,
        credentialType: 'NFC_CARD',
        credentialData: card.card_uid,
        label: card.label || null,
        isActive: card.is_active === 1,
        assignedAt: new Date(card.assigned_at),
        deactivatedAt: card.deactivated_at ? new Date(card.deactivated_at) : null,
      }
    });
  }
  console.log(`  ✓ ${nfcCards.length} NFC cards migrated\n`);

  // 12. Migrate Notices
  const noticeRows = sqliteDb.prepare('SELECT * FROM notices').all();
  console.log(`Migrating ${noticeRows.length} notices...`);

  const noticeTypeMap = {
    'general': 'GENERAL',
    'official': 'OFFICIAL',
    'event': 'EVENT',
    'urgent': 'URGENT',
  };

  for (const n of noticeRows) {
    const publishedBy = employeeIdMap.get(n.published_by);
    if (!publishedBy) continue;

    await prisma.notice.create({
      data: {
        orgId,
        title: n.title,
        body: n.body,
        type: noticeTypeMap[n.type] || 'GENERAL',
        target: n.target || 'all',
        publishedBy,
        createdAt: new Date(n.created_at),
      }
    });
  }
  console.log(`  ✓ ${noticeRows.length} notices migrated\n`);

  // 13. Migrate Notifications
  const notifRows = sqliteDb.prepare('SELECT * FROM notifications').all();
  console.log(`Migrating ${notifRows.length} notifications...`);

  const notifTypeMap = {
    'notice': 'NOTICE',
    'leave': 'LEAVE',
    'system': 'SYSTEM',
  };

  let notifSuccess = 0;
  for (const n of notifRows) {
    const employeeId = employeeIdMap.get(n.employee_id);
    if (!employeeId) continue;

    await prisma.notification.create({
      data: {
        orgId,
        employeeId,
        title: n.title,
        body: n.body,
        type: notifTypeMap[n.type] || 'SYSTEM',
        referenceType: n.reference_type || null,
        referenceId: n.reference_id ? String(n.reference_id) : null,
        isRead: n.is_read === 1,
        isCleared: n.is_cleared === 1,
        createdAt: new Date(n.created_at),
      }
    });
    notifSuccess++;
  }
  console.log(`  ✓ ${notifSuccess} notifications migrated\n`);

  // 14. Migrate Push Tokens
  const pushRows = sqliteDb.prepare('SELECT * FROM push_tokens').all();
  console.log(`Migrating ${pushRows.length} push tokens...`);

  for (const pt of pushRows) {
    const employeeId = employeeIdMap.get(pt.employee_id);
    if (!employeeId) continue;

    try {
      await prisma.pushToken.create({
        data: {
          employeeId,
          token: pt.token,
          deviceName: pt.device_name || null,
          createdAt: new Date(pt.created_at),
        }
      });
    } catch (e) {
      // skip duplicates
    }
  }
  console.log(`  ✓ Push tokens migrated\n`);

  // 15. Save Org Settings
  console.log('Migrating org settings...');
  for (const [key, value] of Object.entries(settings)) {
    if (['company_name', 'branding_logo', 'branding_favicon'].includes(key)) continue;
    await prisma.orgSetting.create({
      data: { orgId, key, value }
    });
  }
  console.log(`  ✓ Org settings migrated\n`);

  console.log('═══════════════════════════════════════════');
  console.log('  MIGRATION COMPLETE!');
  console.log('═══════════════════════════════════════════');
  console.log(`  Organization: ${orgName} (${orgId})`);
  console.log(`  Employees: ${employees.length}`);
  console.log(`  Attendance: ${attSuccess}`);
  console.log(`  Leaves: ${leaveRows.length}`);
  console.log(`  Holidays: ${holidayRows.length}`);
  console.log(`  NFC Cards: ${nfcCards.length}`);
  console.log('═══════════════════════════════════════════');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    sqliteDb.close();
  });
