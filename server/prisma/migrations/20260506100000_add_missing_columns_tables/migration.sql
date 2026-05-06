-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'LOCKED', 'PAID');

-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE 'MATERNITY';
ALTER TYPE "LeaveType" ADD VALUE 'PATERNITY';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "gender" TEXT;
ALTER TABLE "employees" ADD COLUMN "employment_status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "employees" ADD COLUMN "join_date" DATE;

-- AlterTable
ALTER TABLE "leave_quotas" ALTER COLUMN "total_days" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "used_days" SET DEFAULT 0,
ALTER COLUMN "used_days" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "leaves" ADD COLUMN "is_half_day" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leaves" ALTER COLUMN "days" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "gross_salary" DECIMAL(12,2) NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "allowances" JSONB NOT NULL DEFAULT '{}',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "allowances" JSONB NOT NULL DEFAULT '{}',
    "overtime_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross_earnings" DECIMAL(12,2) NOT NULL,
    "employee_ssf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employer_ssf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unpaid_leave_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "absence_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loan_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advance_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_deductions" JSONB NOT NULL DEFAULT '{}',
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_salary" DECIMAL(12,2) NOT NULL,
    "company_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_work_days" INTEGER NOT NULL,
    "present_days" INTEGER NOT NULL,
    "absent_days" INTEGER NOT NULL,
    "unpaid_leave_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "locked_at" TIMESTAMP(3),
    "locked_by" UUID,
    "notes" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_advances" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "remaining_amount" DECIMAL(12,2) NOT NULL,
    "monthly_deduction" DECIMAL(12,2) NOT NULL,
    "start_month" INTEGER NOT NULL,
    "start_year" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policies_org_id_category_idx" ON "policies"("org_id", "category");
CREATE INDEX "salary_structures_org_id_employee_id_is_active_idx" ON "salary_structures"("org_id", "employee_id", "is_active");
CREATE INDEX "payslips_org_id_year_month_idx" ON "payslips"("org_id", "year", "month");
CREATE INDEX "payslips_org_id_status_idx" ON "payslips"("org_id", "status");
CREATE UNIQUE INDEX "payslips_org_id_employee_id_year_month_key" ON "payslips"("org_id", "employee_id", "year", "month");
CREATE INDEX "loan_advances_org_id_employee_id_is_active_idx" ON "loan_advances"("org_id", "employee_id", "is_active");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_advances" ADD CONSTRAINT "loan_advances_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_advances" ADD CONSTRAINT "loan_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
