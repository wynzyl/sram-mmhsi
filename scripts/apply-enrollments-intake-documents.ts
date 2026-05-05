/**
 * Repair: add enrollments.intake_documents when migrate has not been applied
 * (same shape as drizzle/0012_enrollment_intake_documents.sql).
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
      ALTER TABLE "enrollments"
        ADD COLUMN IF NOT EXISTS "intake_documents" jsonb;
    `);
    console.log('enrollments.intake_documents ensured (jsonb). Run "npm run db:migrate" so Drizzle tracks migration 0012 if needed.');
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
