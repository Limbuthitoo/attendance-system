-- AlterTable
ALTER TABLE "employees" ADD COLUMN "address" TEXT;
ALTER TABLE "employees" ADD COLUMN "bank_account_name" TEXT;
ALTER TABLE "employees" ADD COLUMN "bank_account_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "bank_branch" TEXT;
ALTER TABLE "employees" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "employees" ADD COLUMN "blood_group" TEXT;
ALTER TABLE "employees" ADD COLUMN "city" TEXT;
ALTER TABLE "employees" ADD COLUMN "contract_type" TEXT;
ALTER TABLE "employees" ADD COLUMN "country" TEXT DEFAULT 'Nepal';
ALTER TABLE "employees" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "employees" ADD COLUMN "marital_status" TEXT;
ALTER TABLE "employees" ADD COLUMN "pan_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "probation_end_date" DATE;
ALTER TABLE "employees" ADD COLUMN "ssf_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "state" TEXT;
ALTER TABLE "employees" ADD COLUMN "zip_code" TEXT;

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emergency_contacts_employee_id_idx" ON "emergency_contacts"("employee_id");
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
