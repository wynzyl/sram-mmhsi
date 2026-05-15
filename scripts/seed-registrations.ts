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
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import {
  students,
  registrations,
  schoolYears,
  gradeLevels,
  parentsGuardians,
  studentGuardianLinks,
} from "../src/lib/db/schema";
import { generateStudentRef } from "../src/lib/utils/reference";

expand(config({ path: ".env.local" }));
expand(config());

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

// Guardian-specific data arrays
const GUARDIAN_FIRST_NAMES_F = [
  "Maria", "Lourdes", "Rosario", "Teresa", "Carmen", "Corazon", "Luz",
  "Esperanza", "Gloria", "Milagros", "Remedios", "Dolores", "Asuncion",
];
const GUARDIAN_FIRST_NAMES_M = [
  "Jose", "Roberto", "Ricardo", "Eduardo", "Francisco", "Antonio", "Manuel",
  "Fernando", "Ernesto", "Alfredo", "Domingo", "Rodolfo", "Benjamin",
];
const RELATIONSHIPS = ["Mother", "Father", "Guardian"] as const;
const OCCUPATIONS = [
  "Teacher", "Engineer", "Nurse", "Business Owner", "Government Employee",
  "OFW", "Self-employed", "Accountant", "Doctor", "Lawyer", "IT Professional",
  "Sales Manager", "Bank Employee", "Entrepreneur", "Office Worker",
];
const ADDRESSES = [
  "123 Rizal St., Brgy. San Antonio, Makati City",
  "456 Mabini Ave., Brgy. Poblacion, Quezon City",
  "789 Bonifacio Dr., Brgy. Central, Manila",
  "321 Luna St., Brgy. San Jose, Pasig City",
  "654 Del Pilar Rd., Brgy. Kapitolyo, Pasig City",
  "111 Aguinaldo Blvd., Brgy. Marikina Heights, Marikina City",
  "222 Quezon Ave., Brgy. South Triangle, Quezon City",
  "333 Ayala Ave., Brgy. Bel-Air, Makati City",
  "444 EDSA, Brgy. Wack-Wack, Mandaluyong City",
  "555 Ortigas Ave., Brgy. San Antonio, Pasig City",
];

type GuardianData = {
  firstName: string;
  lastName: string;
  relationship: (typeof RELATIONSHIPS)[number];
  address: string;
  occupation: string;
  contactNumber: string;
  email: string;
};

type SeedRow = {
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  gradeLevel: string;
  type: (typeof TYPE_CYCLE)[number];
  guardians: GuardianData[];
};

function generateGuardians(studentLastName: string, index: number): GuardianData[] {
  const guardians: GuardianData[] = [];
  const hasSecondGuardian = index % 3 !== 2; // ~66% have 2 guardians
  const address = ADDRESSES[index % ADDRESSES.length];

  // Primary guardian (Mother or Father based on index)
  const isPrimaryMother = index % 2 === 0;
  const primaryFirstNames = isPrimaryMother ? GUARDIAN_FIRST_NAMES_F : GUARDIAN_FIRST_NAMES_M;
  const primaryRelationship = isPrimaryMother ? "Mother" : "Father";
  const primaryFirstName = primaryFirstNames[index % primaryFirstNames.length];
  const primaryEmail = `${primaryFirstName.toLowerCase()}.${studentLastName.toLowerCase().replace(/\s+/g, "")}.${index}@example.com`;
  const primaryPhone = `0917${String(100000 + index * 2).padStart(7, "0")}`;

  guardians.push({
    firstName: primaryFirstName,
    lastName: studentLastName,
    relationship: primaryRelationship,
    address,
    occupation: OCCUPATIONS[index % OCCUPATIONS.length],
    contactNumber: primaryPhone,
    email: primaryEmail,
  });

  // Secondary guardian (the other parent)
  if (hasSecondGuardian) {
    const secondaryFirstNames = isPrimaryMother ? GUARDIAN_FIRST_NAMES_M : GUARDIAN_FIRST_NAMES_F;
    const secondaryRelationship = isPrimaryMother ? "Father" : "Mother";
    const secondaryFirstName = secondaryFirstNames[(index + 3) % secondaryFirstNames.length];
    const secondaryEmail = `${secondaryFirstName.toLowerCase()}.${studentLastName.toLowerCase().replace(/\s+/g, "")}.${index}@example.com`;
    const secondaryPhone = `0918${String(100001 + index * 2).padStart(7, "0")}`;

    guardians.push({
      firstName: secondaryFirstName,
      lastName: studentLastName,
      relationship: secondaryRelationship,
      address,
      occupation: OCCUPATIONS[(index + 5) % OCCUPATIONS.length],
      contactNumber: secondaryPhone,
      email: secondaryEmail,
    });
  }

  return guardians;
}

function buildSeedData(): SeedRow[] {
  const rows: SeedRow[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const isFemale = i % 2 === 0;
    const firstPool = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    rows.push({
      firstName: firstPool[i % firstPool.length],
      middleName: MIDDLE_NAMES[i % MIDDLE_NAMES.length],
      lastName,
      gender: isFemale ? "Female" : "Male",
      gradeLevel: GRADE_LEVELS[i % GRADE_LEVELS.length],
      type: TYPE_CYCLE[i % TYPE_CYCLE.length],
      guardians: generateGuardians(lastName, i),
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
    if (suffix === 0) return r;
    // Update guardian last names to match the modified student last name
    const newLastName = `${r.lastName} ${suffix}`;
    return {
      ...r,
      lastName: newLastName,
      guardians: r.guardians.map((g) => ({
        ...g,
        lastName: newLastName,
        email: g.email.replace(r.lastName.toLowerCase().replace(/\s+/g, ""), newLastName.toLowerCase().replace(/\s+/g, "")),
      })),
    };
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
  let guardiansCreated = 0;
  let guardiansSkipped = 0;
  let linksCreated = 0;

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

    // Create or find guardians and link them to the student
    for (let gIdx = 0; gIdx < data.guardians.length; gIdx++) {
      const guardianData = data.guardians[gIdx];
      const isPrimary = gIdx === 0;

      // Check if guardian already exists by email (idempotent)
      const existingGuardian = await db
        .select({ id: parentsGuardians.id })
        .from(parentsGuardians)
        .where(eq(parentsGuardians.email, guardianData.email))
        .limit(1);

      let guardianId: string;

      if (existingGuardian.length > 0) {
        guardianId = existingGuardian[0].id;
        guardiansSkipped++;
      } else {
        const [insertedGuardian] = await db
          .insert(parentsGuardians)
          .values({
            firstName: guardianData.firstName,
            lastName: guardianData.lastName,
            relationship: guardianData.relationship,
            address: guardianData.address,
            occupation: guardianData.occupation,
            contactNumber: guardianData.contactNumber,
            email: guardianData.email,
          })
          .returning({ id: parentsGuardians.id });
        guardianId = insertedGuardian.id;
        guardiansCreated++;
      }

      // Check if link already exists (idempotent)
      const existingLink = await db
        .select({ id: studentGuardianLinks.id })
        .from(studentGuardianLinks)
        .where(
          and(
            eq(studentGuardianLinks.studentId, studentId),
            eq(studentGuardianLinks.guardianId, guardianId),
            isNull(studentGuardianLinks.deletedAt),
          ),
        )
        .limit(1);

      if (existingLink.length === 0) {
        await db.insert(studentGuardianLinks).values({
          studentId,
          guardianId,
          isPrimary,
        });
        linksCreated++;
      }
    }

    if (createdStudent) {
      console.log(`  + create ${referenceNumber} - ${data.firstName} ${data.lastName} (${data.gradeLevel}, ${data.type}) [${data.guardians.length} guardian(s)]`);
      created++;
    } else {
      console.log(`  + reg    ${referenceNumber} - ${data.firstName} ${data.lastName} (${data.gradeLevel}, ${data.type})`);
      regOnly++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Done!`);
  console.log(`  Students:    ${created} created, ${regOnly} registrations added, ${skipped} skipped`);
  console.log(`  Guardians:   ${guardiansCreated} created, ${guardiansSkipped} existing`);
  console.log(`  Links:       ${linksCreated} created`);
  if (missingGrade > 0) {
    console.log(`  Warnings:    ${missingGrade} missing grade level(s)`);
  }
  console.log(`${"─".repeat(60)}\n`);
  await client.end();
}

seedRegistrations().catch(async (err) => {
  console.error("Registration seed failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});
