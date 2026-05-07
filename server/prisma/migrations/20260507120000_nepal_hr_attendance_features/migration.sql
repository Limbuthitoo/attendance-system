-- Nepal HR Attendance Features Migration
-- Adds: ShiftType, breakMinutes, attendance locking, late/early tracking,
-- attendance corrections (regularization), penalty policies, EARLY_EXIT status

-- 1. Add ShiftType enum
CREATE TYPE "ShiftType" AS ENUM ('FIXED', 'FLEXIBLE', 'NIGHT');

-- 2. Add new fields to shifts table
ALTER TABLE "shifts" ADD COLUMN "shift_type" "ShiftType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "shifts" ADD COLUMN "break_minutes" INTEGER NOT NULL DEFAULT 0;

-- 3. Add new fields to attendance table
ALTER TABLE "attendance" ADD COLUMN "break_minutes" INTEGER DEFAULT 0;
ALTER TABLE "attendance" ADD COLUMN "late_minutes" INTEGER DEFAULT 0;
ALTER TABLE "attendance" ADD COLUMN "early_exit_minutes" INTEGER DEFAULT 0;
ALTER TABLE "attendance" ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- 4. Add EARLY_EXIT to AttendanceStatus enum
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'EARLY_EXIT';

-- 5. Add CorrectionType enum
CREATE TYPE "CorrectionType" AS ENUM ('MISSED_CHECKIN', 'MISSED_CHECKOUT', 'WRONG_TIME', 'OTHER');

-- 6. Add CorrectionStatus enum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 7. Create attendance_corrections table
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_id" UUID,
    "date" DATE NOT NULL,
    "correction_type" "CorrectionType" NOT NULL,
    "requested_check_in" TIMESTAMP(3),
    "requested_check_out" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- 8. Create attendance_penalty_policies table
CREATE TABLE "attendance_penalty_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "max_late_per_month" INTEGER NOT NULL DEFAULT 3,
    "late_penalty_type" TEXT NOT NULL DEFAULT 'half_day_deduction',
    "max_early_exit_per_month" INTEGER NOT NULL DEFAULT 3,
    "early_exit_penalty_type" TEXT NOT NULL DEFAULT 'half_day_deduction',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_penalty_policies_pkey" PRIMARY KEY ("id")
);

-- 9. Add new columns to payroll_summaries
ALTER TABLE "payroll_summaries" ADD COLUMN "weekly_off_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_summaries" ADD COLUMN "early_exit_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payroll_summaries" ADD COLUMN "penalty_days" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- 10. Add indexes and constraints
CREATE INDEX "attendance_corrections_org_id_status_idx" ON "attendance_corrections"("org_id", "status");
CREATE INDEX "attendance_corrections_employee_id_date_idx" ON "attendance_corrections"("employee_id", "date");
CREATE UNIQUE INDEX "attendance_penalty_policies_org_id_key" ON "attendance_penalty_policies"("org_id");

-- 11. Add foreign keys
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_penalty_policies" ADD CONSTRAINT "attendance_penalty_policies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
