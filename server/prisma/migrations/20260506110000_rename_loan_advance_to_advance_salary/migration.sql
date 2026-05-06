-- Rename loan_advances table to advance_salaries
ALTER TABLE "loan_advances" RENAME TO "advance_salaries";

-- Drop the type column (no longer distinguishing LOAN vs ADVANCE)
ALTER TABLE "advance_salaries" DROP COLUMN "type";

-- Rename indexes
ALTER INDEX "loan_advances_pkey" RENAME TO "advance_salaries_pkey";
ALTER INDEX "loan_advances_org_id_employee_id_is_active_idx" RENAME TO "advance_salaries_org_id_employee_id_is_active_idx";

-- Rename foreign key constraints
ALTER TABLE "advance_salaries" RENAME CONSTRAINT "loan_advances_org_id_fkey" TO "advance_salaries_org_id_fkey";
ALTER TABLE "advance_salaries" RENAME CONSTRAINT "loan_advances_employee_id_fkey" TO "advance_salaries_employee_id_fkey";

-- In payslips: merge loan_deduction + advance_deduction into advance_salary_deduction
ALTER TABLE "payslips" ADD COLUMN "advance_salary_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "payslips" SET "advance_salary_deduction" = COALESCE("loan_deduction", 0) + COALESCE("advance_deduction", 0);
ALTER TABLE "payslips" DROP COLUMN "loan_deduction";
ALTER TABLE "payslips" DROP COLUMN "advance_deduction";
