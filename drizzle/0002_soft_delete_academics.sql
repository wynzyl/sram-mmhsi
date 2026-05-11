ALTER TABLE "subjects"
ADD COLUMN "deleted_at" timestamp,
ADD COLUMN "deleted_by" uuid REFERENCES "users"("id");

ALTER TABLE "teacher_assignments"
ADD COLUMN "deleted_at" timestamp,
ADD COLUMN "deleted_by" uuid REFERENCES "users"("id");
