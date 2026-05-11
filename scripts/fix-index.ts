import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping old index...");
  await db.execute(sql`DROP INDEX IF EXISTS "enrollment_unique_sy_idx";`);
  console.log("Creating new partial index...");
  await db.execute(sql`CREATE UNIQUE INDEX "enrollment_unique_sy_idx" ON "enrollments" USING btree ("student_id", "school_year_id") WHERE status != 'cancelled';`);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
