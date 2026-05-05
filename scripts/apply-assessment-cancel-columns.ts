/**
 * One-off repair: add assessments.cancelled_at / cancelled_by when the DB was
 * evolved outside drizzle-kit migrate (e.g. push/manual) so postPayment queries match schema.
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
      ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
      ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "cancelled_by" uuid;
    `);
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'assessments_cancelled_by_users_id_fk'
        ) THEN
          ALTER TABLE "assessments"
            ADD CONSTRAINT "assessments_cancelled_by_users_id_fk"
            FOREIGN KEY ("cancelled_by") REFERENCES "public"."users" ("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    console.log("assessments.cancelled_at / cancelled_by ensured.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
