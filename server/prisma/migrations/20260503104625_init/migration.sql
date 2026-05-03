-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'PLATFORM_SUPPORT');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('NFC_READER', 'FINGERPRINT', 'QR_TERMINAL', 'FACE_RECOGNITION');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('NFC_CARD', 'FINGERPRINT', 'QR_CODE', 'FACE_ID', 'PIN');

-- CreateEnum
CREATE TYPE "DeviceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'REJECTED', 'UNKNOWN', 'HEARTBEAT');

-- CreateEnum
CREATE TYPE "WriteJobStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'NFC', 'FINGERPRINT', 'QR_CODE', 'FACE_ID', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('SICK', 'CASUAL', 'EARNED', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('GENERAL', 'OFFICIAL', 'EVENT', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NOTICE', 'LEAVE', 'DESIGN_TASK', 'SYSTEM', 'CHECKOUT_REMINDER');

-- CreateEnum
CREATE TYPE "DesignTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "subscription_plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
    "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trial_ends_at" TIMESTAMP(3),
    "max_employees" INTEGER NOT NULL DEFAULT 50,
    "max_branches" INTEGER NOT NULL DEFAULT 5,
    "max_devices" INTEGER NOT NULL DEFAULT 10,
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Nepal',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofence_radius" INTEGER,
    "geofence_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_modules" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "config" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "enabled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'General',
    "designation" TEXT NOT NULL DEFAULT 'Employee',
    "phone" TEXT,
    "avatar_url" TEXT,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "org_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_roles" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "branch_id" UUID,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID,

    CONSTRAINT "employee_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "late_threshold_minutes" INTEGER NOT NULL DEFAULT 30,
    "half_day_hours" DECIMAL(4,2) NOT NULL DEFAULT 4,
    "full_day_hours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "min_checkout_minutes" INTEGER NOT NULL DEFAULT 2,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "working_days" JSONB NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_assignments" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "work_schedule_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID,
    "device_type" "DeviceType" NOT NULL,
    "device_serial" TEXT NOT NULL,
    "name" TEXT,
    "location" TEXT,
    "api_key_hash" TEXT NOT NULL,
    "firmware_version" TEXT,
    "last_heartbeat_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_credentials" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "credential_type" "CredentialType" NOT NULL,
    "credential_data" TEXT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "employee_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "branch_id" UUID,
    "device_id" UUID NOT NULL,
    "credential_type" "CredentialType",
    "credential_data" TEXT,
    "employee_id" UUID,
    "event_type" "DeviceEventType" NOT NULL,
    "result" TEXT NOT NULL,
    "attendance_id" UUID,
    "event_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "device_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_write_jobs" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "device_id" UUID,
    "data_to_write" TEXT NOT NULL,
    "status" "WriteJobStatus" NOT NULL DEFAULT 'PENDING',
    "result_data" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "device_write_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID,
    "date" DATE NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "work_hours" DECIMAL(5,2) DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "bs_year" INTEGER NOT NULL,
    "bs_month" INTEGER NOT NULL,
    "bs_day" INTEGER NOT NULL,
    "bs_day_end" INTEGER,
    "bs_month_end" INTEGER,
    "name" TEXT NOT NULL,
    "name_np" TEXT,
    "ad_date" DATE,
    "ad_date_end" DATE,
    "women_only" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_settings" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_quotas" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID,
    "leave_type" "LeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "total_days" INTEGER NOT NULL,
    "used_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL DEFAULT 'GENERAL',
    "target" TEXT NOT NULL DEFAULT 'all',
    "published_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'NOTICE',
    "reference_type" TEXT,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_cleared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "device_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_releases" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "release_notes" TEXT NOT NULL DEFAULT '',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_tasks" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_date" DATE,
    "bs_year" INTEGER NOT NULL DEFAULT 2083,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'festival',
    "status" "DesignTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" UUID,
    "notification_sent" BOOLEAN NOT NULL DEFAULT false,
    "notification_date" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "actor_id" TEXT,
    "actor_type" TEXT NOT NULL DEFAULT 'employee',
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_policies" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "overtime_after_hours" DECIMAL(4,2) NOT NULL,
    "max_overtime_hours_daily" DECIMAL(4,2) NOT NULL DEFAULT 4,
    "overtime_rate_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    "weekend_rate_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 2.0,
    "holiday_rate_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 2.0,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtime_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_records" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "regular_hours" DECIMAL(5,2) NOT NULL,
    "overtime_hours" DECIMAL(5,2) NOT NULL,
    "rate_multiplier" DECIMAL(3,2) NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_summaries" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "total_work_days" INTEGER NOT NULL,
    "present_days" INTEGER NOT NULL,
    "absent_days" INTEGER NOT NULL,
    "late_days" INTEGER NOT NULL,
    "half_days" INTEGER NOT NULL,
    "leave_days" INTEGER NOT NULL,
    "holiday_days" INTEGER NOT NULL,
    "total_work_hours" DECIMAL(7,2) NOT NULL,
    "overtime_hours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "effective_days" DECIMAL(5,2) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "branches_org_id_code_key" ON "branches"("org_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "modules_code_key" ON "modules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "org_modules_org_id_module_id_key" ON "org_modules"("org_id", "module_id");

-- CreateIndex
CREATE INDEX "employees_org_id_is_active_idx" ON "employees"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_org_id_email_key" ON "employees"("org_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_org_id_employee_code_key" ON "employees"("org_id", "employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_org_id_name_key" ON "roles"("org_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_roles_employee_id_role_id_branch_id_key" ON "employee_roles"("employee_id", "role_id", "branch_id");

-- CreateIndex
CREATE INDEX "employee_assignments_employee_id_is_current_idx" ON "employee_assignments"("employee_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_serial_key" ON "devices"("device_serial");

-- CreateIndex
CREATE INDEX "devices_org_id_device_type_idx" ON "devices"("org_id", "device_type");

-- CreateIndex
CREATE INDEX "employee_credentials_employee_id_idx" ON "employee_credentials"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_credentials_credential_type_credential_data_key" ON "employee_credentials"("credential_type", "credential_data");

-- CreateIndex
CREATE INDEX "device_events_device_id_event_time_idx" ON "device_events"("device_id", "event_time");

-- CreateIndex
CREATE INDEX "device_events_org_id_event_time_idx" ON "device_events"("org_id", "event_time");

-- CreateIndex
CREATE INDEX "device_events_employee_id_event_time_idx" ON "device_events"("employee_id", "event_time");

-- CreateIndex
CREATE INDEX "attendance_org_id_date_idx" ON "attendance"("org_id", "date");

-- CreateIndex
CREATE INDEX "attendance_employee_id_date_idx" ON "attendance"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employee_id_date_key" ON "attendance"("employee_id", "date");

-- CreateIndex
CREATE INDEX "leaves_org_id_status_idx" ON "leaves"("org_id", "status");

-- CreateIndex
CREATE INDEX "leaves_employee_id_status_idx" ON "leaves"("employee_id", "status");

-- CreateIndex
CREATE INDEX "holidays_org_id_bs_year_idx" ON "holidays"("org_id", "bs_year");

-- CreateIndex
CREATE INDEX "holidays_org_id_bs_year_bs_month_idx" ON "holidays"("org_id", "bs_year", "bs_month");

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_org_id_key_key" ON "org_settings"("org_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "leave_quotas_org_id_employee_id_leave_type_year_key" ON "leave_quotas"("org_id", "employee_id", "leave_type", "year");

-- CreateIndex
CREATE INDEX "notices_org_id_created_at_idx" ON "notices"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_employee_id_is_read_is_cleared_idx" ON "notifications"("employee_id", "is_read", "is_cleared");

-- CreateIndex
CREATE INDEX "notifications_org_id_created_at_idx" ON "notifications"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_employee_id_token_key" ON "push_tokens"("employee_id", "token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_employee_id_idx" ON "refresh_tokens"("employee_id");

-- CreateIndex
CREATE INDEX "design_tasks_org_id_bs_year_idx" ON "design_tasks"("org_id", "bs_year");

-- CreateIndex
CREATE INDEX "design_tasks_assigned_to_idx" ON "design_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_created_at_idx" ON "audit_logs"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_resource_resource_id_idx" ON "audit_logs"("org_id", "resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "overtime_records_org_id_date_idx" ON "overtime_records"("org_id", "date");

-- CreateIndex
CREATE INDEX "overtime_records_employee_id_status_idx" ON "overtime_records"("employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_records_employee_id_date_key" ON "overtime_records"("employee_id", "date");

-- CreateIndex
CREATE INDEX "payroll_summaries_org_id_year_month_idx" ON "payroll_summaries"("org_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_summaries_org_id_employee_id_year_month_key" ON "payroll_summaries"("org_id", "employee_id", "year", "month");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_modules" ADD CONSTRAINT "org_modules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_modules" ADD CONSTRAINT "org_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_credentials" ADD CONSTRAINT "employee_credentials_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_write_jobs" ADD CONSTRAINT "device_write_jobs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_quotas" ADD CONSTRAINT "leave_quotas_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_quotas" ADD CONSTRAINT "leave_quotas_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_tasks" ADD CONSTRAINT "design_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_policies" ADD CONSTRAINT "overtime_policies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "overtime_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_records" ADD CONSTRAINT "overtime_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_summaries" ADD CONSTRAINT "payroll_summaries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_summaries" ADD CONSTRAINT "payroll_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
