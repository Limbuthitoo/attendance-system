-- AlterEnum: Remove DESIGN_TASK from NotificationType
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('NOTICE', 'LEAVE', 'SYSTEM', 'CHECKOUT_REMINDER');
ALTER TABLE "public"."notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'NOTICE';
COMMIT;

-- DropForeignKey
ALTER TABLE "design_tasks" DROP CONSTRAINT "design_tasks_assigned_to_fkey";
ALTER TABLE "design_tasks" DROP CONSTRAINT "design_tasks_created_by_fkey";
ALTER TABLE "design_tasks" DROP CONSTRAINT "design_tasks_org_id_fkey";

-- DropTable
DROP TABLE "design_tasks";

-- DropEnum
DROP TYPE "DesignTaskStatus";

-- CreateTable: plans
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "billing_cycle" TEXT NOT NULL DEFAULT 'monthly',
    "max_employees" INTEGER NOT NULL DEFAULT 10,
    "max_branches" INTEGER NOT NULL DEFAULT 1,
    "max_devices" INTEGER NOT NULL DEFAULT 2,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- Seed default plans
INSERT INTO "plans" ("id", "name", "code", "description", "price", "currency", "billing_cycle", "max_employees", "max_branches", "max_devices", "trial_days", "is_active", "sort_order", "features", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Trial', 'trial', '14-day free trial', 0, 'NPR', 'monthly', 15, 2, 3, 14, true, 0, '["Core attendance","Leave management","Basic reports"]', NOW(), NOW()),
  (gen_random_uuid(), 'Starter', 'starter', 'For small teams up to 30 employees', 150000, 'NPR', 'monthly', 30, 3, 5, 0, true, 1, '["Everything in Trial","NFC/QR devices","Holiday calendar","Notices","App distribution"]', NOW(), NOW()),
  (gen_random_uuid(), 'Business', 'business', 'For growing organizations up to 100 employees', 400000, 'NPR', 'monthly', 100, 10, 20, 0, true, 2, '["Everything in Starter","Advanced reports","Payroll integration","Geofencing","Multiple branches"]', NOW(), NOW()),
  (gen_random_uuid(), 'Enterprise', 'enterprise', 'For large organizations with custom needs', 1000000, 'NPR', 'monthly', 500, 50, 100, 0, true, 3, '["Everything in Business","Unlimited support","Custom integrations","Dedicated account manager"]', NOW(), NOW());

-- Migrate organizations: map subscription_plan enum to plan_id
ALTER TABLE "organizations" ADD COLUMN "plan_id" UUID;

UPDATE "organizations" SET "plan_id" = (SELECT "id" FROM "plans" WHERE "code" = LOWER("organizations"."subscription_plan"::text));

ALTER TABLE "organizations" DROP COLUMN "subscription_plan";

-- DropEnum
DROP TYPE "SubscriptionPlan";

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
