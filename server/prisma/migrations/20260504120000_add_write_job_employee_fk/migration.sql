-- AddForeignKey
ALTER TABLE "device_write_jobs" ADD CONSTRAINT "device_write_jobs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
