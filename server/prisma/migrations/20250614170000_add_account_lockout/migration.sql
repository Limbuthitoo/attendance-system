-- Add account lockout fields to employees
ALTER TABLE "employees" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN "locked_until" TIMESTAMP(3);

-- Add account lockout fields to platform_users
ALTER TABLE "platform_users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_users" ADD COLUMN "locked_until" TIMESTAMP(3);
