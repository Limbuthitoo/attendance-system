// ─────────────────────────────────────────────────────────────────────────────
// Legacy Migration: SQLite → PostgreSQL
//
// Migrates all data from the old SQLite database into the new Prisma/PG schema.
// Creates one Organization + one Branch + maps all existing data.
//
// Usage:
//   LEGACY_DB_PATH=../data/attendance.db \
//   LEGACY_ORG_NAME="Archisys Innovations" \
//   LEGACY_ORG_SLUG="archisys" \
//   node src/scripts/migrate-sqlite.js
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  const dbPath = process.env.LEGACY_DB_PATH;
  const orgName = process.env.LEGACY_ORG_NAME || 'My Organization';
  const orgSlug = process.env.LEGACY_ORG_SLUG || 'my-org';

  if (!dbPath) {
    console.error('LEGACY_DB_PATH is required. Point it to the old SQLite database file.');
    process.exit(1);
  }

  const resolvedPath = path.resolve(dbPath);
  console.log(`📦 Opening legacy SQLite database: ${resolvedPath}`);
  const sqlite = new Database(resolvedPath, { readonly: true });
  sqlite.pragma('foreign_keys = OFF');

  // ID mappings: old integer ID → new UUID
  const empMap = new Map();   // old employee.id → new UUID
  const attMap = new Map();   // old attendance.id → new UUID

  try {
    // ── 1. Create Organization ──────────────────────────────────────────
    console.log(`\n1️⃣  Creating organization: ${orgName} (${orgSlug})`);
    let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: orgName,
          slug: orgSlug,
          subscriptionPlan: 'ENTERPRISE',
          subscriptionStatus: 'ACTIVE',
          maxEmployees: 500,
          maxBranches: 20,
          maxDevices: 50,
        },
      });
    }
    const orgId = org.id;
    console.log(`   Org ID: ${orgId}`);

    // ── 2. Create default Branch ────────────────────────────────────────
    console.log('\n2️⃣  Creating default branch');
    let branch = await prisma.branch.findFirst({ where: { orgId, code: 'HQ' } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          orgId,
          name: 'Headquarters',
          code: 'HQ',
          timezone: 'Asia/Kathmandu',
          country: 'Nepal',
        },
      });
    }
    const branchId = branch.id;

    // ── 3. Create default Shift from office_settings ────────────────────
    console.log('\n3️⃣  Creating default shift from legacy settings');
    const settingsRows = sqlite.prepare('SELECT key, value FROM office_settings').all();
    const legacySettings = {};
    for (const row of settingsRows) legacySettings[row.key] = row.value;

    let shift = await prisma.shift.findFirst({ where: { orgId, isDefault: true } });
    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          orgId,
          branchId,
          name: 'Regular',
          startTime: legacySettings.office_start || '09:00',
          endTime: legacySettings.office_end || '18:00',
          lateThresholdMinutes: parseInt(legacySettings.late_threshold_minutes) || 30,
          halfDayHours: parseFloat(legacySettings.half_day_hours) || 4,
          fullDayHours: parseFloat(legacySettings.full_day_hours) || 8,
          minCheckoutMinutes: parseInt(legacySettings.min_checkout_minutes) || 2,
          isDefault: true,
        },
      });
    }

    // ── 4. Create default Work Schedule ─────────────────────────────────
    console.log('4️⃣  Creating default work schedule');
    const workingDays = (legacySettings.working_days || 'mon,tue,wed,thu,fri').split(',').map((d) => d.trim());
    let schedule = await prisma.workSchedule.findFirst({ where: { orgId } });
    if (!schedule) {
      schedule = await prisma.workSchedule.create({
        data: {
          orgId,
          name: `${workingDays.length}-Day Week`,
          workingDays,
          effectiveFrom: new Date('2024-01-01'),
        },
      });
    }

    // ── 5. Migrate org settings ─────────────────────────────────────────
    console.log('\n5️⃣  Migrating org settings');
    for (const [key, value] of Object.entries(legacySettings)) {
      await prisma.orgSetting.upsert({
        where: { orgId_key: { orgId, key } },
        create: { orgId, key, value: String(value) },
        update: { value: String(value) },
      });
    }
    console.log(`   ${Object.keys(legacySettings).length} settings migrated`);

    // ── 6. Get system roles ─────────────────────────────────────────────
    const adminRole = await prisma.role.findFirst({ where: { name: 'org_admin', orgId: null } });
    const employeeRole = await prisma.role.findFirst({ where: { name: 'employee', orgId: null } });

    if (!adminRole || !employeeRole) {
      console.error('System roles not found. Run "npm run db:seed" first.');
      process.exit(1);
    }

    // ── 7. Migrate Employees ────────────────────────────────────────────
    console.log('\n6️⃣  Migrating employees');
    const employees = sqlite.prepare('SELECT * FROM employees').all();

    for (const emp of employees) {
      const existing = await prisma.employee.findFirst({
        where: { orgId, email: emp.email },
      });

      let newEmp;
      if (existing) {
        newEmp = existing;
      } else {
        newEmp = await prisma.employee.create({
          data: {
            orgId,
            employeeCode: emp.employee_id,
            name: emp.name,
            email: emp.email,
            password: emp.password, // already bcrypt hashed
            department: emp.department || 'General',
            designation: emp.designation || 'Employee',
            phone: emp.phone || null,
            avatarUrl: emp.avatar || null,
            mustChangePassword: emp.must_change_password === 1,
            isActive: emp.is_active === 1,
          },
        });

        // Assign role
        const roleId = emp.role === 'admin' ? adminRole.id : employeeRole.id;
        await prisma.employeeRole.create({
          data: { employeeId: newEmp.id, roleId, grantedBy: null },
        });

        // Assign to default branch/shift/schedule
        await prisma.employeeAssignment.create({
          data: {
            employeeId: newEmp.id,
            branchId,
            shiftId: shift.id,
            workScheduleId: schedule.id,
            effectiveFrom: new Date(emp.created_at || '2024-01-01'),
            isCurrent: true,
          },
        });
      }

      empMap.set(emp.id, newEmp.id);
    }
    console.log(`   ${employees.length} employees migrated`);

    // ── 8. Migrate Attendance ───────────────────────────────────────────
    console.log('\n7️⃣  Migrating attendance records');
    const attendance = sqlite.prepare('SELECT * FROM attendance').all();
    let attCount = 0;

    for (const att of attendance) {
      const employeeId = empMap.get(att.employee_id);
      if (!employeeId) continue;

      const statusMap = { present: 'PRESENT', late: 'LATE', 'half-day': 'HALF_DAY', absent: 'ABSENT' };
      const sourceFromNotes = att.notes?.includes('[NFC]') ? 'NFC' : 'MANUAL';

      try {
        const newAtt = await prisma.attendance.create({
          data: {
            orgId,
            employeeId,
            branchId,
            date: new Date(att.date),
            checkIn: att.check_in ? new Date(att.check_in) : null,
            checkOut: att.check_out ? new Date(att.check_out) : null,
            status: statusMap[att.status] || 'PRESENT',
            source: sourceFromNotes,
            workHours: att.work_hours || 0,
            notes: att.notes || null,
          },
        });
        attMap.set(att.id, newAtt.id);
        attCount++;
      } catch (err) {
        // Skip duplicates
        if (err.code !== 'P2002') console.warn(`  ⚠ Attendance skip: ${err.message}`);
      }
    }
    console.log(`   ${attCount} attendance records migrated`);

    // ── 9. Migrate Leaves ───────────────────────────────────────────────
    console.log('\n8️⃣  Migrating leaves');
    const leaves = sqlite.prepare('SELECT * FROM leaves').all();
    let leaveCount = 0;

    for (const leave of leaves) {
      const employeeId = empMap.get(leave.employee_id);
      if (!employeeId) continue;

      const typeMap = { sick: 'SICK', casual: 'CASUAL', earned: 'EARNED', unpaid: 'UNPAID', other: 'OTHER' };
      const statusMap = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };

      try {
        await prisma.leave.create({
          data: {
            orgId,
            employeeId,
            leaveType: typeMap[leave.leave_type] || 'OTHER',
            startDate: new Date(leave.start_date),
            endDate: new Date(leave.end_date),
            days: leave.days || 1,
            reason: leave.reason || '',
            status: statusMap[leave.status] || 'PENDING',
            reviewedBy: leave.reviewed_by ? empMap.get(leave.reviewed_by) || null : null,
            reviewNote: leave.review_note || null,
          },
        });
        leaveCount++;
      } catch (err) {
        console.warn(`  ⚠ Leave skip: ${err.message}`);
      }
    }
    console.log(`   ${leaveCount} leaves migrated`);

    // ── 10. Migrate NFC Cards → Employee Credentials ────────────────────
    console.log('\n9️⃣  Migrating NFC cards to employee credentials');
    const nfcCards = sqlite.prepare('SELECT * FROM nfc_cards').all();
    let cardCount = 0;

    for (const card of nfcCards) {
      const employeeId = empMap.get(card.employee_id);
      if (!employeeId) continue;

      try {
        await prisma.employeeCredential.create({
          data: {
            orgId,
            employeeId,
            credentialType: 'NFC_CARD',
            credentialData: card.card_uid,
            label: card.label || null,
            isActive: card.is_active === 1,
            assignedAt: new Date(card.assigned_at || Date.now()),
            deactivatedAt: card.deactivated_at ? new Date(card.deactivated_at) : null,
          },
        });
        cardCount++;
      } catch (err) {
        if (err.code !== 'P2002') console.warn(`  ⚠ NFC card skip: ${err.message}`);
      }
    }
    console.log(`   ${cardCount} NFC cards migrated as credentials`);

    // ── 11. Migrate NFC Readers → Devices ───────────────────────────────
    console.log('\n🔟 Migrating NFC readers to devices');
    const readers = sqlite.prepare('SELECT * FROM nfc_readers').all();

    for (const reader of readers) {
      const apiKey = `dev_${crypto.randomBytes(32).toString('hex')}`;
      const apiKeyHash = await bcrypt.hash(apiKey, 12);

      try {
        await prisma.device.create({
          data: {
            orgId,
            branchId,
            deviceType: 'NFC_READER',
            deviceSerial: reader.device_id,
            name: reader.name || null,
            location: reader.location || null,
            apiKeyHash,
            isActive: reader.is_active === 1,
          },
        });
        console.log(`   Device "${reader.name || reader.device_id}" — new API key: ${apiKey}`);
      } catch (err) {
        if (err.code !== 'P2002') console.warn(`  ⚠ Reader skip: ${err.message}`);
      }
    }

    // ── 12. Migrate Holidays ────────────────────────────────────────────
    console.log('\n1️⃣1️⃣ Migrating holidays');
    const holidays = sqlite.prepare('SELECT * FROM holidays').all();

    for (const h of holidays) {
      try {
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
          },
        });
      } catch (err) {
        console.warn(`  ⚠ Holiday skip: ${err.message}`);
      }
    }
    console.log(`   ${holidays.length} holidays migrated`);

    // ── 13. Migrate Notices ─────────────────────────────────────────────
    console.log('\n1️⃣2️⃣ Migrating notices');
    const notices = sqlite.prepare('SELECT * FROM notices').all();

    for (const n of notices) {
      const publisherId = empMap.get(n.published_by);
      if (!publisherId) continue;

      const typeMap = { general: 'GENERAL', official: 'OFFICIAL', event: 'EVENT', urgent: 'URGENT' };

      try {
        await prisma.notice.create({
          data: {
            orgId,
            title: n.title,
            body: n.body,
            type: typeMap[n.type] || 'GENERAL',
            target: n.target || 'all',
            publishedBy: publisherId,
          },
        });
      } catch (err) {
        console.warn(`  ⚠ Notice skip: ${err.message}`);
      }
    }
    console.log(`   ${notices.length} notices migrated`);

    // ── 14. Set up default leave quotas ─────────────────────────────────
    console.log('\n1️⃣3️⃣ Creating default leave quotas');
    const currentYear = new Date().getFullYear();
    const quotaDefaults = [
      { leaveType: 'SICK', totalDays: parseInt(legacySettings.quota_sick) || 12 },
      { leaveType: 'CASUAL', totalDays: parseInt(legacySettings.quota_casual) || 12 },
      { leaveType: 'EARNED', totalDays: parseInt(legacySettings.quota_earned) || 15 },
      { leaveType: 'UNPAID', totalDays: 0 },
      { leaveType: 'OTHER', totalDays: 0 },
    ];

    for (const q of quotaDefaults) {
      const existing = await prisma.leaveQuota.findFirst({
        where: { orgId, employeeId: null, leaveType: q.leaveType, year: currentYear },
      });
      if (!existing) {
        await prisma.leaveQuota.create({
          data: { orgId, employeeId: null, leaveType: q.leaveType, year: currentYear, totalDays: q.totalDays },
        });
      } else {
        await prisma.leaveQuota.update({ where: { id: existing.id }, data: { totalDays: q.totalDays } });
      }
    }

    // ── 15. Enable core modules ─────────────────────────────────────────
    console.log('\n1️⃣4️⃣ Enabling core modules');
    const coreModules = ['attendance', 'leave', 'device', 'notice', 'holiday'];
    for (const code of coreModules) {
      const mod = await prisma.module.findUnique({ where: { code } });
      if (mod) {
        await prisma.orgModule.upsert({
          where: { orgId_moduleId: { orgId, moduleId: mod.id } },
          create: { orgId, moduleId: mod.id },
          update: {},
        });
      }
    }

    console.log('\n✅ Migration complete!');
    console.log(`   Organization: ${orgName} (${orgSlug})`);
    console.log(`   Employees: ${employees.length}`);
    console.log(`   Attendance records: ${attCount}`);
    console.log(`   Leaves: ${leaveCount}`);
    console.log(`   NFC credentials: ${cardCount}`);
    console.log(`   Holidays: ${holidays.length}`);
    console.log(`   Notices: ${notices.length}`);
    console.log('\n⚠  IMPORTANT: New API keys were generated for migrated NFC readers.');
    console.log('   Update each NFC reader device with its new API key and device serial header.');

  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    throw err;
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

migrate().catch(() => process.exit(1));
