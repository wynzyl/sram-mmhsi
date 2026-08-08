/**
 * SRAMS SHS Subjects Seed Script
 * Seeds SHS subjects per track with the new direct ownership model.
 * Run: npx tsx scripts/seed-shs-subjects.ts
 *
 * Each track owns ALL its subjects directly via subjects.strandId.
 * Subjects have termOffered indicating when they're taught:
 * - full_year: Runs entire school year
 * - first_semester: Q1-Q2
 * - second_semester: Q3-Q4
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  subjects,
  strands,
  gradeLevels,
  curriculums,
  curriculumAdoptions,
  schoolYears,
} from "../src/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import type { TermOffering } from "../src/lib/constants/term-offerings";

// ─── Subject Data ─────────────────────────────────────────────────────────────

interface SubjectSeed {
  code: string;
  name: string;
  units: string;
  termOffered: TermOffering;
  sequenceOrder: number;
}

interface TrackSubjects {
  grade11FirstSem: SubjectSeed[];
  grade11SecondSem: SubjectSeed[];
  grade12FirstSem: SubjectSeed[];
  grade12SecondSem: SubjectSeed[];
}

// STEM Track subjects
const STEM_SUBJECTS: TrackSubjects = {
  grade11FirstSem: [
    { code: "STEM-OC11", name: "Oral Communication", units: "1.0", termOffered: "first_semester", sequenceOrder: 1 },
    { code: "STEM-GM11", name: "General Mathematics", units: "1.0", termOffered: "first_semester", sequenceOrder: 2 },
    { code: "STEM-ES11", name: "Earth and Life Science", units: "1.0", termOffered: "first_semester", sequenceOrder: 3 },
    { code: "STEM-PHY11", name: "General Physics 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 4 },
    { code: "STEM-PE11", name: "Physical Education and Health 1", units: "0.5", termOffered: "first_semester", sequenceOrder: 5 },
    { code: "STEM-UTS11", name: "Understanding the Self", units: "1.0", termOffered: "first_semester", sequenceOrder: 6 },
    { code: "STEM-PCHEM11", name: "Pre-Calculus / General Chemistry 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 7 },
  ],
  grade11SecondSem: [
    { code: "STEM-RW11", name: "Reading and Writing", units: "1.0", termOffered: "second_semester", sequenceOrder: 1 },
    { code: "STEM-STAT11", name: "Statistics and Probability", units: "1.0", termOffered: "second_semester", sequenceOrder: 2 },
    { code: "STEM-PS11", name: "Physical Science", units: "1.0", termOffered: "second_semester", sequenceOrder: 3 },
    { code: "STEM-PHY12", name: "General Physics 2", units: "1.0", termOffered: "second_semester", sequenceOrder: 4 },
    { code: "STEM-PE12", name: "Physical Education and Health 2", units: "0.5", termOffered: "second_semester", sequenceOrder: 5 },
    { code: "STEM-BC11", name: "Basic Calculus", units: "1.0", termOffered: "second_semester", sequenceOrder: 6 },
    { code: "STEM-CHEM12", name: "General Chemistry 2", units: "1.0", termOffered: "second_semester", sequenceOrder: 7 },
  ],
  grade12FirstSem: [
    { code: "STEM-EAPP12", name: "English for Academic and Professional Purposes", units: "1.0", termOffered: "first_semester", sequenceOrder: 1 },
    { code: "STEM-FIL12", name: "Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino", units: "1.0", termOffered: "first_semester", sequenceOrder: 2 },
    { code: "STEM-KAS12", name: "Kasaysayan ng Pilipinas", units: "1.0", termOffered: "first_semester", sequenceOrder: 3 },
    { code: "STEM-PE21", name: "Physical Education and Health 3", units: "0.5", termOffered: "first_semester", sequenceOrder: 4 },
    { code: "STEM-CAP12", name: "Capstone / Research 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 5 },
    { code: "STEM-BIO12", name: "General Biology 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 6 },
  ],
  grade12SecondSem: [
    { code: "STEM-PIC12", name: "Practical Research 2 / Inquiries, Investigations, and Immersion", units: "1.0", termOffered: "second_semester", sequenceOrder: 1 },
    { code: "STEM-PAG12", name: "Pagbasa at Pagsusuri ng Iba't Ibang Teksto", units: "1.0", termOffered: "second_semester", sequenceOrder: 2 },
    { code: "STEM-CON12", name: "Contemporary Philippine Arts from the Regions", units: "1.0", termOffered: "second_semester", sequenceOrder: 3 },
    { code: "STEM-PE22", name: "Physical Education and Health 4", units: "0.5", termOffered: "second_semester", sequenceOrder: 4 },
    { code: "STEM-BIO22", name: "General Biology 2", units: "1.0", termOffered: "second_semester", sequenceOrder: 5 },
    { code: "STEM-INTRO12", name: "Introduction to Philosophy of the Human Person", units: "1.0", termOffered: "second_semester", sequenceOrder: 6 },
  ],
};

// ABM Track subjects
const ABM_SUBJECTS: TrackSubjects = {
  grade11FirstSem: [
    { code: "ABM-OC11", name: "Oral Communication", units: "1.0", termOffered: "first_semester", sequenceOrder: 1 },
    { code: "ABM-GM11", name: "General Mathematics", units: "1.0", termOffered: "first_semester", sequenceOrder: 2 },
    { code: "ABM-ES11", name: "Earth and Life Science", units: "1.0", termOffered: "first_semester", sequenceOrder: 3 },
    { code: "ABM-ABM11", name: "Applied Economics", units: "1.0", termOffered: "first_semester", sequenceOrder: 4 },
    { code: "ABM-PE11", name: "Physical Education and Health 1", units: "0.5", termOffered: "first_semester", sequenceOrder: 5 },
    { code: "ABM-UTS11", name: "Understanding the Self", units: "1.0", termOffered: "first_semester", sequenceOrder: 6 },
    { code: "ABM-FAB11", name: "Fundamentals of Accountancy, Business and Management 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 7 },
  ],
  grade11SecondSem: [
    { code: "ABM-RW11", name: "Reading and Writing", units: "1.0", termOffered: "second_semester", sequenceOrder: 1 },
    { code: "ABM-STAT11", name: "Statistics and Probability", units: "1.0", termOffered: "second_semester", sequenceOrder: 2 },
    { code: "ABM-PS11", name: "Physical Science", units: "1.0", termOffered: "second_semester", sequenceOrder: 3 },
    { code: "ABM-BE11", name: "Business Ethics and Social Responsibility", units: "1.0", termOffered: "second_semester", sequenceOrder: 4 },
    { code: "ABM-PE12", name: "Physical Education and Health 2", units: "0.5", termOffered: "second_semester", sequenceOrder: 5 },
    { code: "ABM-OM11", name: "Organization and Management", units: "1.0", termOffered: "second_semester", sequenceOrder: 6 },
    { code: "ABM-FAB12", name: "Fundamentals of Accountancy, Business and Management 2", units: "1.0", termOffered: "second_semester", sequenceOrder: 7 },
  ],
  grade12FirstSem: [
    { code: "ABM-EAPP12", name: "English for Academic and Professional Purposes", units: "1.0", termOffered: "first_semester", sequenceOrder: 1 },
    { code: "ABM-FIL12", name: "Komunikasyon at Pananaliksik", units: "1.0", termOffered: "first_semester", sequenceOrder: 2 },
    { code: "ABM-KAS12", name: "Kasaysayan ng Pilipinas", units: "1.0", termOffered: "first_semester", sequenceOrder: 3 },
    { code: "ABM-PE21", name: "Physical Education and Health 3", units: "0.5", termOffered: "first_semester", sequenceOrder: 4 },
    { code: "ABM-PR112", name: "Practical Research 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 5 },
    { code: "ABM-BF12", name: "Business Finance", units: "1.0", termOffered: "first_semester", sequenceOrder: 6 },
  ],
  grade12SecondSem: [
    { code: "ABM-PR212", name: "Practical Research 2", units: "1.0", termOffered: "second_semester", sequenceOrder: 1 },
    { code: "ABM-PAG12", name: "Pagbasa at Pagsusuri ng Iba't Ibang Teksto", units: "1.0", termOffered: "second_semester", sequenceOrder: 2 },
    { code: "ABM-CON12", name: "Contemporary Philippine Arts from the Regions", units: "1.0", termOffered: "second_semester", sequenceOrder: 3 },
    { code: "ABM-PE22", name: "Physical Education and Health 4", units: "0.5", termOffered: "second_semester", sequenceOrder: 4 },
    { code: "ABM-BM12", name: "Business Marketing", units: "1.0", termOffered: "second_semester", sequenceOrder: 5 },
    { code: "ABM-ENT12", name: "Entrepreneurship", units: "1.0", termOffered: "second_semester", sequenceOrder: 6 },
  ],
};

// HUMSS Track subjects
const HUMSS_SUBJECTS: TrackSubjects = {
  grade11FirstSem: [
    { code: "HUMSS-OC11", name: "Oral Communication", units: "1.0", termOffered: "first_semester", sequenceOrder: 1 },
    { code: "HUMSS-GM11", name: "General Mathematics", units: "1.0", termOffered: "first_semester", sequenceOrder: 2 },
    { code: "HUMSS-ES11", name: "Earth and Life Science", units: "1.0", termOffered: "first_semester", sequenceOrder: 3 },
    { code: "HUMSS-PCUL11", name: "Philippine Politics and Governance", units: "1.0", termOffered: "first_semester", sequenceOrder: 4 },
    { code: "HUMSS-PE11", name: "Physical Education and Health 1", units: "0.5", termOffered: "first_semester", sequenceOrder: 5 },
    { code: "HUMSS-UTS11", name: "Understanding the Self", units: "1.0", termOffered: "first_semester", sequenceOrder: 6 },
    { code: "HUMSS-IW11", name: "Introduction to World Religions and Belief Systems", units: "1.0", termOffered: "first_semester", sequenceOrder: 7 },
  ],
  grade11SecondSem: [
    { code: "HUMSS-RW11", name: "Reading and Writing", units: "1.0", termOffered: "second_semester", sequenceOrder: 1 },
    { code: "HUMSS-STAT11", name: "Statistics and Probability", units: "1.0", termOffered: "second_semester", sequenceOrder: 2 },
    { code: "HUMSS-PS11", name: "Physical Science", units: "1.0", termOffered: "second_semester", sequenceOrder: 3 },
    { code: "HUMSS-COMM11", name: "Community Engagement, Solidarity, and Citizenship", units: "1.0", termOffered: "second_semester", sequenceOrder: 4 },
    { code: "HUMSS-PE12", name: "Physical Education and Health 2", units: "0.5", termOffered: "second_semester", sequenceOrder: 5 },
    { code: "HUMSS-CS11", name: "Creative Writing / Creative Nonfiction", units: "1.0", termOffered: "second_semester", sequenceOrder: 6 },
    { code: "HUMSS-DISS11", name: "Disciplines and Ideas in the Social Sciences", units: "1.0", termOffered: "second_semester", sequenceOrder: 7 },
  ],
  grade12FirstSem: [
    { code: "HUMSS-EAPP12", name: "English for Academic and Professional Purposes", units: "1.0", termOffered: "first_semester", sequenceOrder: 1 },
    { code: "HUMSS-FIL12", name: "Komunikasyon at Pananaliksik", units: "1.0", termOffered: "first_semester", sequenceOrder: 2 },
    { code: "HUMSS-KAS12", name: "Kasaysayan ng Pilipinas", units: "1.0", termOffered: "first_semester", sequenceOrder: 3 },
    { code: "HUMSS-PE21", name: "Physical Education and Health 3", units: "0.5", termOffered: "first_semester", sequenceOrder: 4 },
    { code: "HUMSS-PR112", name: "Practical Research 1", units: "1.0", termOffered: "first_semester", sequenceOrder: 5 },
    { code: "HUMSS-DIAH12", name: "Disciplines and Ideas in Applied Social Sciences", units: "1.0", termOffered: "first_semester", sequenceOrder: 6 },
  ],
  grade12SecondSem: [
    { code: "HUMSS-PR212", name: "Practical Research 2", units: "1.0", termOffered: "second_semester", sequenceOrder: 1 },
    { code: "HUMSS-PAG12", name: "Pagbasa at Pagsusuri ng Iba't Ibang Teksto", units: "1.0", termOffered: "second_semester", sequenceOrder: 2 },
    { code: "HUMSS-CON12", name: "Contemporary Philippine Arts from the Regions", units: "1.0", termOffered: "second_semester", sequenceOrder: 3 },
    { code: "HUMSS-PE22", name: "Physical Education and Health 4", units: "0.5", termOffered: "second_semester", sequenceOrder: 4 },
    { code: "HUMSS-TRENDS12", name: "Trends, Networks, and Critical Thinking in the 21st Century", units: "1.0", termOffered: "second_semester", sequenceOrder: 5 },
    { code: "HUMSS-CAP12", name: "Culminating Activity / Work Immersion", units: "1.0", termOffered: "second_semester", sequenceOrder: 6 },
  ],
};

// Track code to subjects mapping
const TRACK_SUBJECTS: Record<string, TrackSubjects> = {
  STEM: STEM_SUBJECTS,
  ABM: ABM_SUBJECTS,
  HUMSS: HUMSS_SUBJECTS,
};

// ─── Seed Function ────────────────────────────────────────────────────────────

export async function seedSHSSubjects(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding SHS subjects per track...");

  // Get active curriculum (or latest published)
  const [curriculum] = await db
    .select({ id: curriculums.id })
    .from(curriculums)
    .where(eq(curriculums.status, "published"))
    .limit(1);

  if (!curriculum) {
    console.log("⚠️  No published curriculum found. Skipping SHS subjects seeding.");
    console.log("   Please create and publish a curriculum first.");
    return;
  }

  // Get Grade 11 and Grade 12 IDs
  const shsGrades = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels)
    .where(inArray(gradeLevels.name, ["Grade 11", "Grade 12"]));

  const grade11 = shsGrades.find((g) => g.name === "Grade 11");
  const grade12 = shsGrades.find((g) => g.name === "Grade 12");

  if (!grade11 || !grade12) {
    console.log("⚠️  Grade 11 or Grade 12 not found. Run seed-config first.");
    return;
  }

  // Get all tracks
  const allStrands = await db
    .select({ id: strands.id, code: strands.code })
    .from(strands)
    .where(isNull(strands.deletedAt));

  const strandMap = new Map(allStrands.map((s) => [s.code, s.id]));

  // Seed subjects for each track
  for (const [trackCode, trackSubjects] of Object.entries(TRACK_SUBJECTS)) {
    const trackId = strandMap.get(trackCode);
    if (!trackId) {
      console.log(`  ⚠️  Track ${trackCode} not found. Skipping.`);
      continue;
    }

    console.log(`  📚 Seeding ${trackCode} subjects...`);

    // Grade 11 First Semester
    await seedSubjectsForGrade(
      db,
      curriculum.id,
      grade11.id,
      trackId,
      trackSubjects.grade11FirstSem,
      `${trackCode} G11-S1`
    );

    // Grade 11 Second Semester
    await seedSubjectsForGrade(
      db,
      curriculum.id,
      grade11.id,
      trackId,
      trackSubjects.grade11SecondSem,
      `${trackCode} G11-S2`
    );

    // Grade 12 First Semester
    await seedSubjectsForGrade(
      db,
      curriculum.id,
      grade12.id,
      trackId,
      trackSubjects.grade12FirstSem,
      `${trackCode} G12-S1`
    );

    // Grade 12 Second Semester
    await seedSubjectsForGrade(
      db,
      curriculum.id,
      grade12.id,
      trackId,
      trackSubjects.grade12SecondSem,
      `${trackCode} G12-S2`
    );
  }

  console.log("✅ SHS subjects seeding complete!");
}

async function seedSubjectsForGrade(
  db: PostgresJsDatabase,
  curriculumId: string,
  gradeLevelId: string,
  trackId: string,
  subjectList: SubjectSeed[],
  label: string
): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const subj of subjectList) {
    // Check if subject already exists
    const existing = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(
        and(
          eq(subjects.curriculumId, curriculumId),
          eq(subjects.code, subj.code),
          isNull(subjects.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing subject with strandId if missing
      await db
        .update(subjects)
        .set({
          strandId: trackId,
          termOffered: subj.termOffered,
          updatedAt: new Date(),
        })
        .where(eq(subjects.id, existing[0].id));
      skipped++;
    } else {
      // Insert new subject
      await db.insert(subjects).values({
        code: subj.code,
        name: subj.name,
        curriculumId,
        gradeLevelId,
        strandId: trackId,
        termOffered: subj.termOffered,
        units: subj.units,
        sequenceOrder: subj.sequenceOrder,
        isCore: true, // All SHS subjects owned by track are "core" to that track
      });
      created++;
    }
  }

  console.log(`    ${label}: ${created} created, ${skipped} updated`);
}

// ─── Standalone Execution ─────────────────────────────────────────────────────

if (require.main === module) {
  expand(config({ path: ".env.local" }));
  expand(config());

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  seedSHSSubjects(db)
    .then(async () => {
      await client.end();
    })
    .catch(async (err) => {
      console.error("❌ SHS subjects seed failed:", err);
      await client.end();
      process.exit(1);
    });
}
