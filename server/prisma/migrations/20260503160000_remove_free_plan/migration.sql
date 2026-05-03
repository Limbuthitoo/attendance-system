-- Remove FREE/BASIC/PRO, add STARTER/BUSINESS

-- 1. Rename old enum
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";

-- 2. Create new enum
CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'STARTER', 'BUSINESS', 'ENTERPRISE');

-- 3. Map old values to new and cast column
ALTER TABLE "organizations" ALTER COLUMN "subscription_plan" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "subscription_plan" TYPE "SubscriptionPlan"
  USING (
    CASE "subscription_plan"::text
      WHEN 'FREE' THEN 'BUSINESS'
      WHEN 'BASIC' THEN 'STARTER'
      WHEN 'PRO' THEN 'BUSINESS'
      ELSE "subscription_plan"::text
    END
  )::"SubscriptionPlan";
ALTER TABLE "organizations" ALTER COLUMN "subscription_plan" SET DEFAULT 'TRIAL';

-- 4. Drop old enum
DROP TYPE "SubscriptionPlan_old";
