ALTER TABLE "designations"
  ADD COLUMN "department_id" UUID;

CREATE INDEX "designations_department_id_idx" ON "designations"("department_id");

ALTER TABLE "designations"
  ADD CONSTRAINT "designations_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "designations" d
SET "department_id" = dept."id"
FROM "departments" dept
WHERE d."department_id" IS NULL
  AND d."org_id" = dept."org_id"
  AND (
    LOWER(d."name") LIKE '%' || LOWER(dept."name") || '%'
    OR LOWER(dept."name") LIKE '%' || LOWER(d."name") || '%'
  );

DROP INDEX IF EXISTS "designations_org_id_name_key";
CREATE UNIQUE INDEX "designations_org_id_department_id_name_key" ON "designations"("org_id", "department_id", "name");
CREATE UNIQUE INDEX "designations_org_id_name_global_key" ON "designations"("org_id", "name") WHERE "department_id" IS NULL;
