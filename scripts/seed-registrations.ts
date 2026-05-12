/**
 * SRAMS Registration Seed Script
 * Seeds 10 new students with pending registrations for the 2025-2026 school year.
 * Run: npx tsx scripts/seed-registrations.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { students, registrations, schoolYears, gradeLevels } from "../src/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import { generateStudentRef } from "../src/lib/utils/reference";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const STUDENT_DATA = [
  { firstName: "Maria", middleName: "Santos", lastName: "Reyes", gender: "Female", gradeLevel: "Grade 7", type: "new_student" as const },
  { firstName: "Juan", middleName: "Cruz", lastName: "Garcia", gender: "Male", gradeLevel: "Grade 4", type: "new_student" as const },
  { firstName: "Ana", middleName: "Dela", lastName: "Cruz", gender: "Female", gradeLevel: "Grade 1", type: "new_student" as const },
  { firstName: "Miguel", middleName: "Ramos", lastName: "Torres", gender: "Male", gradeLevel: "Grade 10", type: "new_student" as const },
  { firstName: "Sofia", middleName: "Bautista", lastName: "Mendoza", gender: "Female", gradeLevel: "Grade 11", type: "transferee" as const },
  { firstName: "Carlos", middleName: "Aguilar", lastName: "Villanueva", gender: "Male", gradeLevel: "Senior Casa", type: "new_student" as const },
  { firstName: "Isabella", middleName: "Flores", lastName: "Castillo", gender: "Female", gradeLevel: "Grade 3", type: "new_student" as const },
  { firstName: "Jose", middleName: "Rivera", lastName: "Aquino", gender: "Male", gradeLevel: "Grade 8", type: "new_student" as const },
  { firstName: "Elena", middleName: "Santiago", lastName: "Fernandez", gender: "Female", gradeLevel: "Grade 5", type: "new_student" as const },
  { firstName: "Marco", middleName: "Dela Rosa", lastName: "Gonzales", gender: "Male", gradeLevel: "Grade 12", type: "transferee" as const },
];

async function seedRegistrations() {
  console.log("🌱 Seeding 10 student registrations...\n");

  // Fetch active school year
  const [schoolYear] = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(eq(schoolYears.isActive, true))
    .limit(1);

  if (!schoolYear) {
    console.error("❌ No active school year found. Run seed-config.ts first.");
    process.exit(1);
  }
  console.log(`✅ Using school year: ${schoolYear.label}`);

  // Fetch all grade levels for lookup
  const gradeLevelRows = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels);

  const gradeLevelMap = new Map(gradeLevelRows.map((g) => [g.name, g.id]));

  // Determine next sequence number from existing student refs
  const latestStudent = await db
    .select({ referenceNumber: students.referenceNumber })
    .from(students)
    .orderBy(desc(students.createdAt))
    .limit(1);

  let nextSeq = 1;
  if (latestStudent.length > 0) {
    const match = latestStudent[0].referenceNumber.match(/(\d+)$/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }

  const currentYear = new Date().getFullYear();
  let created = 0;

  for (const data of STUDENT_DATA) {
    const gradeLevelId = gradeLevelMap.get(data.gradeLevel);
    if (!gradeLevelId) {
      console.warn(`⚠️  Grade level "${data.gradeLevel}" not found. Skipping ${data.firstName} ${data.lastName}.`);
      continue;
    }

    const referenceNumber = generateStudentRef(currentYear, nextSeq);

    const [student] = await db
      .insert(students)
      .values({
        referenceNumber,
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        gender: data.gender,
        isActive: true,
      })
      .returning({ id: students.id, referenceNumber: students.referenceNumber });

    await db.insert(registrations).values({
      studentId: student.id,
      schoolYearId: schoolYear.id,
      gradeLevelId,
      studentType: data.type,
      intakeDocuments: {
        form138: "to_follow",
        birthCertificatePsa: "to_follow",
        goodMoralCharacter: data.type === "transferee" ? "to_follow" : "not_applicable",
        qualifiedVoucher: "not_applicable",
        escCertificate: "not_applicable",
      },
      status: "approved",
    });

    console.log(`  ✅ ${student.referenceNumber} — ${data.firstName} ${data.lastName} (${data.gradeLevel}, ${data.type})`);
    nextSeq++;
    created++;
  }

  console.log(`\n✅ Done. ${created} student registrations seeded.\n`);
  await client.end();
}

seedRegistrations().catch((err) => {
  console.error("❌ Registration seed failed:", err);
  process.exit(1);
});
