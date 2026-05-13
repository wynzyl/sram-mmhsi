/**
 * SRAMS Registration Seed Script
 *
 * Seeds 50 students with APPROVED registrations for the active school year.
 * Idempotent: re-running skips students whose (firstName + middleName + lastName)
 * already exist, and skips approved registrations that already exist for that
 * student in the active school year.
 *
 * Run: npm run db:seed-registrations
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, desc, eq, isNull } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import {
  students,
  registrations,
  schoolYears,
  gradeLevels,
} from "../src/lib/db/schema";
import { generateStudentRef } from "../src/lib/utils/reference";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

const TOTAL = 50;

const FIRST_NAMES_F = [
  "Maria", "Ana", "Sofia", "Isabella", "Elena", "Andrea", "Camille",
  "Patricia", "Bea", "Angela", "Kristine", "Therese", "Janelle",
];
const FIRST_NAMES_M = [
  "Juan", "Miguel", "Carlos", "Jose", "Marco", "Luis", "Rafael",
  "Diego", "Joaquin", "Emilio", "Daniel", "Paolo", "Vincent",
];
const MIDDLE_NAMES = [
  "Santos", "Cruz", "Dela Rosa", "Ramos", "Bautista", "Aguilar", "Flores",
  "Rivera", "Santiago", "Mendoza", "Reyes", "Torres", "Castillo",
];
const LAST_NAMES = [
  "Reyes", "Garcia", "Cruz", "Torres", "Mendoza", "Villanueva",
  "Castillo", "Aquino", "Fernandez", "Gonzales", "Navarro", "Domingo",
  "Morales", "Pascual", "Lim", "Tan", "Ocampo", "Salazar",
];
const GRADE_LEVELS = [
  "Junior Casa", "Senior Casa", "Advance Casa",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7", "Grade 8", "Grade 9", "Grade 10",
  "Grade 11", "Grade 12",
];
const TYPE_CYCLE = ["new_student", "new_student", "new_student", "new_student", "transferee"] as const;

type SeedRow = {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  gradeLevel: string;
  type: (typeof TYPE_CYCLE)[number];
};

function buildSeedData(): SeedRow[] {
  const rows: SeedRow[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const isFemale = i % 2 === 0;
    const firstPool = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
    rows.push({
      firstName: firstPool[i % firstPool.length],
      middleName: MIDDLE_NAMES[i % MIDDLE_NAMES.length],
      lastName: LAST_NAMES[i % LAST_NAMES.length],
      gender: isFemale ? "Female" : "Male",
      gradeLevel: GRADE_LEVELS[i % GRADE_LEVELS.length],
      type: TYPE_CYCLE[i % TYPE_CYCLE.length],
    });
  }
  // Guard against duplicate (first+middle+last) keys in the deterministic pool.
  const seen = new Set<string>();
  return rows.map((r, i) => {
    let key = `${r.firstName}|${r.middleName}|${r.lastName}`;
    let suffix = 0;
    while (seen.has(key)) {
      suffix++;
      key = `${r.firstName}|${r.middleName}|${r.lastName} ${suffix}`;
    }
    seen.add(key);
    return suffix === 0 ? r : { ...r, lastName: `${r.lastName} ${suffix}` };
  });
}

async function seedRegistrations() {
  console.log(`Seeding up to ${TOTAL} approved registrations (idempotent)...\n`);

  const [schoolYear] = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(eq(schoolYears.isActive, true))
    .limit(1);

  if (!schoolYear) {
    console.error("No active school year found. Run `npm run db:seed-config` first.");
    process.exit(1);
  }
  console.log(`Active school year: ${schoolYear.label}\n`);

  const gradeLevelRows = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels);
  const gradeLevelMap = new Map(gradeLevelRows.map((g) => [g.name, g.id]));

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
  const seedData = buildSeedData();

  let created = 0;
  let skipped = 0;
  let regOnly = 0;
  let missingGrade = 0;

  for (const data of seedData) {
    const gradeLevelId = gradeLevelMap.get(data.gradeLevel);
    if (!gradeLevelId) {
      console.warn(`  ! grade level "${data.gradeLevel}" not found - skipping ${data.firstName} ${data.lastName}`);
      missingGrade++;
      continue;
    }

    // Look up existing student by natural key (first + middle + last, not soft-deleted).
    const existing = await db
      .select({ id: students.id, referenceNumber: students.referenceNumber })
      .from(students)
      .where(
        and(
          eq(students.firstName, data.firstName),
          eq(students.middleName, data.middleName),
          eq(students.lastName, data.lastName),
          isNull(students.deletedAt),
        ),
      )
      .limit(1);

    let studentId: string;
    let referenceNumber: string;
    let createdStudent = false;

    if (existing.length > 0) {
      studentId = existing[0].id;
      referenceNumber = existing[0].referenceNumber;
    } else {
      referenceNumber = generateStudentRef(currentYear, nextSeq);
      const [inserted] = await db
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
      studentId = inserted.id;
      referenceNumber = inserted.referenceNumber;
      nextSeq++;
      createdStudent = true;
    }

    // Skip registration insert if an approved one already exists for this student + active SY.
    const existingReg = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(
        and(
          eq(registrations.studentId, studentId),
          eq(registrations.schoolYearId, schoolYear.id),
          eq(registrations.status, "approved"),
        ),
      )
      .limit(1);

    if (existingReg.length > 0) {
      console.log(`  ~ skip   ${referenceNumber} - ${data.firstName} ${data.lastName} (already approved)`);
      skipped++;
      continue;
    }

    await db.insert(registrations).values({
      studentId,
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

    if (createdStudent) {
      console.log(`  + create ${referenceNumber} - ${data.firstName} ${data.lastName} (${data.gradeLevel}, ${data.type})`);
      created++;
    } else {
      console.log(`  + reg    ${referenceNumber} - ${data.firstName} ${data.lastName} (${data.gradeLevel}, ${data.type})`);
      regOnly++;
    }
  }

  console.log(
    `\nDone. ${created} students+registrations created, ${regOnly} registrations added to existing students, ${skipped} skipped, ${missingGrade} missing-grade.\n`,
  );
  await client.end();
}

seedRegistrations().catch(async (err) => {
  console.error("Registration seed failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});
