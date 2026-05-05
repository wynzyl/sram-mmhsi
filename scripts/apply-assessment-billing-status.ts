/**
 * One-off repair: assessments.billing_status column + enum + sync from balance / cancelled_at.
 * Mirrors drizzle/0009 + 0010 + 0011 for DBs where migrate was not applied.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url);
  try {
    await sql.unsafe(`
      DO $do$
      BEGIN
        CREATE TYPE "public"."assessment_billing_status" AS ENUM('outstanding', 'fully_paid');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $do$;
    `);
    await sql.unsafe(`
      ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "billing_status" "assessment_billing_status" DEFAULT 'outstanding' NOT NULL;
    `);
    await sql.unsafe(`
      ALTER TYPE "public"."assessment_billing_status" ADD VALUE IF NOT EXISTS 'cancelled';
    `);
    await sql.unsafe(`
      UPDATE "assessments" SET "billing_status" = CASE
        WHEN "cancelled_at" IS NOT NULL THEN 'cancelled'::"public"."assessment_billing_status"
        WHEN "balance"::numeric <= 0 THEN 'fully_paid'::"public"."assessment_billing_status"
        ELSE 'outstanding'::"public"."assessment_billing_status"
      END;
    `);
    console.log("assessments.billing_status ensured (incl. cancelled) and synced.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
