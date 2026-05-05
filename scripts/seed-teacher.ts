import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import {
  users,
  subjects,
  sections,
  schoolYears,
  teacherAssignments,
  gradeLevels,
  students,
  enrollments,
  curriculums,
} from "../lib/db/schema";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding test data for Grade Encoding...");

  try {
    // 1. Create a Teacher User
    const passwordHash = await hash("Teacher@2026!", 12);
    const existingTeacher = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "teacher1"))
      .limit(1);
    const teacher =
      existingTeacher.length > 0
        ? existingTeacher[0]
        : (
            await db
              .insert(users)
              .values({
                email: "teacher1@srams.local",
                username: "teacher1",
                passwordHash,
                role: "teacher",
                isActive: true,
                forcePasswordChange: false,
              })
              .returning({ id: users.id })
          )[0];

    // 2. Create School Year
    const existingSchoolYear = await db
      .select({ id: schoolYears.id })
      .from(schoolYears)
      .where(eq(schoolYears.label, "2026-2027"))
      .limit(1);
    const sy =
      existingSchoolYear.length > 0
        ? existingSchoolYear[0]
        : (
            await db
              .insert(schoolYears)
              .values({
                label: "2026-2027",
                startDate: new Date("2026-08-01"),
                endDate: new Date("2027-05-31"),
                isActive: true,
              })
              .returning({ id: schoolYears.id })
          )[0];

    // 3. Create Grade Level & Section
    const existingGradeLevel = await db
      .select({ id: gradeLevels.id })
      .from(gradeLevels)
      .where(eq(gradeLevels.name, "Grade 7"))
      .limit(1);
    const gl =
      existingGradeLevel.length > 0
        ? existingGradeLevel[0]
        : (
            await db
              .insert(gradeLevels)
              .values({
                name: "Grade 7",
                order: 7,
                assessmentBand: "junior_high",
              })
              .returning({ id: gradeLevels.id })
          )[0];

    const existingSection = await db
      .select({ id: sections.id })
      .from(sections)
      .where(eq(sections.name, "Section A"))
      .limit(1);
    const sec =
      existingSection.length > 0
        ? existingSection[0]
        : (
            await db
              .insert(sections)
              .values({
                name: "Section A",
                gradeLevelId: gl.id,
                schoolYearId: sy.id,
              })
              .returning({ id: sections.id })
          )[0];

    const existingCurriculum = await db
      .select({ id: curriculums.id })
      .from(curriculums)
      .where(eq(curriculums.name, "Seed Curriculum"))
      .limit(1);
    const curr =
      existingCurriculum.length > 0
        ? existingCurriculum[0]
        : (
            await db
              .insert(curriculums)
              .values({
                name: "Seed Curriculum",
                effectiveSchoolYearId: sy.id,
              })
              .returning({ id: curriculums.id })
          )[0];

    // 4. Create Subject
    const existingSubject = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.code, "MATH7"))
      .limit(1);
    const sub =
      existingSubject.length > 0
        ? existingSubject[0]
        : (
            await db
              .insert(subjects)
              .values({
                name: "Mathematics",
                code: "MATH7",
                curriculumId: curr.id,
                gradeLevelId: gl.id,
              })
              .returning({ id: subjects.id })
          )[0];

    // 5. Assign Teacher
    await db.insert(teacherAssignments).values({
      teacherId: teacher.id,
      subjectId: sub.id,
      sectionId: sec.id,
      schoolYearId: sy.id,
    });

    // 6. Create a Student & Enrollment
    let [student] = await db.insert(students).values({
      referenceNumber: `STD-${Date.now()}`,
      firstName: "John",
      lastName: "Doe",
      isActive: true,
    }).returning();

    await db.insert(enrollments).values({
      studentId: student.id,
      schoolYearId: sy.id,
      gradeLevelId: gl.id,
      sectionId: sec.id,
      status: "enrolled",
    });

    console.log("✅ Teacher seeded successfully!");
    console.log(`   Username : teacher1`);
    console.log(`   Password : Teacher@2026!`);
  } catch (e: any) {
    if (e.code === "23505") {
      console.log("Data already seeded.");
    } else {
      console.error(e);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error("❌ Teacher seed failed:", err);
  process.exit(1);
});
