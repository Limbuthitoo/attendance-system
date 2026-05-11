-- Platform Settings table (key-value config)
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_key" ON "platform_settings"("key");

-- Add backup_retention_days to plans
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "backup_retention_days" INTEGER NOT NULL DEFAULT 7;

-- Seed default platform settings
INSERT INTO "platform_settings" ("id", "key", "value", "label") VALUES
  (gen_random_uuid(), 'backup_retention_days', '30', 'Global Backup Retention (days)'),
  (gen_random_uuid(), 'backup_frequency', 'daily', 'Backup Frequency (daily/hourly)'),
  (gen_random_uuid(), 'backup_enabled', 'true', 'Automated Backups Enabled')
ON CONFLICT ("key") DO NOTHING;

-- Set plan-specific retention
UPDATE "plans" SET "backup_retention_days" = 1 WHERE "code" = 'trial';
UPDATE "plans" SET "backup_retention_days" = 7 WHERE "code" = 'starter';
UPDATE "plans" SET "backup_retention_days" = 30 WHERE "code" = 'business';
UPDATE "plans" SET "backup_retention_days" = 90 WHERE "code" = 'enterprise';
