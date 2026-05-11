/**
 * Fix Student Reference Sequence
 *
 * This script ensures the student_ref_seq sequence exists and is properly initialized.
 * Run: npx tsx scripts/fix-student-ref-sequence.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function fixSequence() {
  console.log("🔍 Checking student reference sequence...");

  try {
    // Check if sequence exists
    const [result] = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'student_ref_seq' AND relkind = 'S'
      ) as exists;
    `);

    const exists = (result as any).exists;

    if (!exists) {
      console.log("⚠️  Sequence does not exist. Creating it now...");

      // Create sequence
      await db.execute(sql`CREATE SEQUENCE student_ref_seq START WITH 1;`);
      console.log("✅ Created student_ref_seq sequence");

      // Initialize to current max + 1
      await db.execute(sql`
        DO $$
        DECLARE
          max_seq INTEGER;
        BEGIN
          SELECT COALESCE(MAX(
            CAST(
              SUBSTRING(reference_number FROM '\\d{5}$') AS INTEGER
            )
          ), 0) INTO max_seq
          FROM students
          WHERE reference_number ~ '^SRAMS-\\d{4}-\\d{5}$';

          -- Set sequence to max + 1
          PERFORM setval('student_ref_seq', max_seq + 1, false);

          RAISE NOTICE 'Initialized sequence to value: %', max_seq + 1;
        END $$;
      `);

      console.log("✅ Initialized sequence to prevent collisions");
    } else {
      console.log("✅ Sequence already exists");

      // Show current value
      const [current] = await db.execute(sql`SELECT last_value FROM student_ref_seq;`);
      console.log(`   Current sequence value: ${(current as any).last_value}`);
    }

    console.log("\n✨ Student reference sequence is ready!");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

fixSequence()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  });
