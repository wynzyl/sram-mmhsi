/**
 * Repair: add registrations.student_type + intake_documents when the DB was
 * evolved outside drizzle-kit migrate (e.g. db:push) so sequential migrate
 * never reached 0013_salty_triton.sql.
 */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import postgres from "postgres";

expand(config({ path: ".env.local" }));
expand(config({ path: ".env" }));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url);
  try {
    await sql.unsafe(`
      DO $$
      BEGIN
        CREATE TYPE "public"."enrollment_student_type" AS ENUM (
          'new_student',
          'transferee',
          'old_student'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await sql.unsafe(`
      ALTER TABLE "registrations"
        ADD COLUMN IF NOT EXISTS "student_type" "enrollment_student_type"
        DEFAULT 'new_student' NOT NULL;
    `);
    await sql.unsafe(`
      ALTER TABLE "registrations"
        ADD COLUMN IF NOT EXISTS "intake_documents" jsonb;
    `);
    console.log(
      "registrations.student_type and registrations.intake_documents ensured.",
    );
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
