/**
 * One-time data fix: Update students with registrations
 * - Set dateOfBirth to 2020-01-01 for all students with registrations
 * - Set gender to 'male' only where gender is currently NULL
 *
 * Run with: npx tsx scripts/fix-student-dob-gender.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { students, registrations } from "../src/lib/db/schema";
import * as schema from "../src/lib/db/schema";
import { and, isNull, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { logDbTarget } from "./lib/db-target";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

logDbTarget("fix-student-dob-gender", connectionString);

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

const DEFAULT_DOB = new Date("2020-01-01");
const DEFAULT_GENDER = "male";

async function fixStudentDobGender() {
  console.log("🔍 Finding students with registrations...");

  // Get all unique student IDs from registrations
  const registrationStudentIds = await db
    .selectDistinct({ studentId: registrations.studentId })
    .from(registrations);

  const studentIds = registrationStudentIds.map((r) => r.studentId);

  if (studentIds.length === 0) {
    console.log("✅ No registrations found. Nothing to update.");
    return;
  }

  console.log(`📋 Found ${studentIds.length} student(s) with registrations.`);

  // Update dateOfBirth for all students with registrations
  console.log("\n🔧 Updating dateOfBirth to 2020-01-01 for all...");
  const dobResult = await db
    .update(students)
    .set({ dateOfBirth: DEFAULT_DOB })
    .where(inArray(students.id, studentIds))
    .returning({ id: students.id });

  console.log(`   ✓ Updated dateOfBirth for ${dobResult.length} student(s).`);

  // Update gender only where it's NULL
  console.log("\n🔧 Updating gender to 'male' where NULL...");
  const genderResult = await db
    .update(students)
    .set({ gender: DEFAULT_GENDER })
    .where(
      and(
        inArray(students.id, studentIds),
        isNull(students.gender)
      )
    )
    .returning({ id: students.id });

  console.log(`   ✓ Updated gender for ${genderResult.length} student(s).`);
}

fixStudentDobGender()
  .then(async () => {
    console.log("\n🎉 Script completed successfully.");
    await client.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\n❌ Error:", err);
    await client.end();
    process.exit(1);
  });
