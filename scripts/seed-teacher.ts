import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { users, subjects, sections, schoolYears, teacherAssignments, gradeLevels, students, enrollments, curriculums } from "../lib/db/schema";
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
    let [teacher] = await db.insert(users).values({
      email: "teacher1@srams.local",
      username: "teacher1",
      passwordHash,
      role: "teacher",
      isActive: true,
      forcePasswordChange: false,
    }).returning();
    
    // 2. Create School Year
    let [sy] = await db.insert(schoolYears).values({
      label: "2026-2027",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2027-05-31"),
      isActive: true,
    }).returning();

    // 3. Create Grade Level & Section
    let [gl] = await db.insert(gradeLevels).values({
      name: "Grade 7",
      order: 7,
    }).returning();

    let [sec] = await db.insert(sections).values({
      name: "Section A",
      gradeLevelId: gl.id,
      schoolYearId: sy.id,
    }).returning();

    let [curr] = await db.insert(curriculums).values({
      name: "Seed Curriculum",
      effectiveSchoolYearId: sy.id,
    }).returning();

    // 4. Create Subject
    let [sub] = await db.insert(subjects).values({
      name: "Mathematics",
      code: "MATH7",
      curriculumId: curr.id,
      gradeLevelId: gl.id,
    }).returning();

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
    if (e.code === '23505') {
      console.log("Data already seeded.");
    } else {
      console.error(e);
    }
  }

  await client.end();
}

seed();
