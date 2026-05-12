/**
 * Fix Student Reference Sequence
 *
 * This script syncs the PostgreSQL sequence for student reference numbers
 * with the highest existing reference number in the database.
 *
 * Run when you encounter duplicate reference number errors.
 *
 * Usage: npx tsx scripts/fix-student-sequence.ts
 */

import { config } from "dotenv";
import { expand } from "dotenv-expand";
import postgres from "postgres";

// Load environment variables
expand(config({ path: ".env.local" }));
expand(config({ path: ".env" }));

const DATABASE_URL = process.env.DATABASE_URL;

async function fixStudentSequence() {
  console.log("🔧 Fixing Student Reference Sequence\n");

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    // Step 1: Find the highest existing sequence number
    console.log("1️⃣ Finding highest existing student reference number...");

    const result = await sql`
      SELECT reference_number
      FROM students
      WHERE reference_number ~ '^SRAMS-[0-9]{4}-[0-9]{5}$'
      ORDER BY reference_number DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      console.log("⚠️  No student records found. Sequence will start from 1.");
      await sql`SELECT setval('student_ref_seq', 1, false)`;
      console.log("✅ Sequence set to start at 1");
      await sql.end();
      return;
    }

    const latestRef = result[0].reference_number as string;
    console.log(`   Latest reference: ${latestRef}`);

    // Extract the sequence number from reference (e.g., "SRAMS-2026-00096" → 96)
    const match = latestRef.match(/SRAMS-\d{4}-(\d{5})$/);
    if (!match) {
      console.error("❌ Could not parse reference number format");
      await sql.end();
      process.exit(1);
    }

    const currentSequence = parseInt(match[1], 10);
    console.log(`   Current highest sequence: ${currentSequence}`);

    // Step 2: Get current sequence value
    console.log("\n2️⃣ Checking current sequence value...");
    const seqResult = await sql`SELECT last_value FROM student_ref_seq`;
    const currentSeqValue = parseInt(seqResult[0].last_value as string, 10);
    console.log(`   Sequence last_value: ${currentSeqValue}`);

    // Step 3: Update sequence to be higher than the highest existing number
    const newSequence = Math.max(currentSequence, currentSeqValue) + 1;
    console.log(`\n3️⃣ Setting sequence to: ${newSequence}`);

    await sql`SELECT setval('student_ref_seq', ${newSequence}, false)`;

    // Verify the change
    const verifyResult = await sql`SELECT last_value FROM student_ref_seq`;
    const verifiedValue = parseInt(verifyResult[0].last_value as string, 10);

    if (verifiedValue === newSequence) {
      console.log("✅ Sequence successfully updated!");
      console.log(`\n📋 Summary:`);
      console.log(`   - Previous highest: ${currentSequence}`);
      console.log(`   - New sequence starts at: ${newSequence}`);
      console.log(`   - Next student reference will be: SRAMS-${new Date().getFullYear()}-${String(newSequence).padStart(5, "0")}`);
    } else {
      console.error("❌ Sequence verification failed");
      process.exit(1);
    }

  } catch (error) {
    console.error("\n💥 Error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixStudentSequence();
