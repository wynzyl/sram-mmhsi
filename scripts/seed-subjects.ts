/**
 * SRAMS Subject Seed Script
 * Seeds DepEd standard subjects for Grade 1-10 (Elementary & Junior High School).
 * Run: npm run db:seed-subjects
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  schoolYears,
  gradeLevels,
  curriculums,
  subjects,
} from "../src/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// ─── Subject Definitions ──────────────────────────────────────────────────────

/** Lower Elementary (Grade 1-3) subjects */
const LOWER_ELEM_SUBJECTS = [
  { code: "FIL", name: "Filipino" },
  { code: "ENG", name: "English" },
  { code: "MTH", name: "Mathematics" },
  { code: "MTB", name: "Mother Tongue-Based" },
  { code: "AP", name: "Araling Panlipunan" },
  { code: "MAPEH", name: "MAPEH" },
  { code: "ESP", name: "Edukasyon sa Pagpapakatao" },
] as const;

/** Upper Elementary (Grade 4-6) subjects */
const UPPER_ELEM_SUBJECTS = [
  { code: "FIL", name: "Filipino" },
  { code: "ENG", name: "English" },
  { code: "MTH", name: "Mathematics" },
  { code: "SCI", name: "Science" },
  { code: "AP", name: "Araling Panlipunan" },
  { code: "MAPEH", name: "MAPEH" },
  { code: "EPP", name: "EPP" },
  { code: "ESP", name: "Edukasyon sa Pagpapakatao" },
] as const;

/** Junior High School (Grade 7-10) subjects */
const JHS_SUBJECTS = [
  { code: "FIL", name: "Filipino" },
  { code: "ENG", name: "English" },
  { code: "MTH", name: "Mathematics" },
  { code: "SCI", name: "Science" },
  { code: "AP", name: "Araling Panlipunan" },
  { code: "MAPEH", name: "MAPEH" },
  { code: "TLE", name: "Technology and Livelihood Education" },
  { code: "ESP", name: "Edukasyon sa Pagpapakatao" },
] as const;

/** Grade level mapping with subject definitions */
const GRADE_SUBJECT_MAP: Record<
  string,
  typeof LOWER_ELEM_SUBJECTS | typeof UPPER_ELEM_SUBJECTS | typeof JHS_SUBJECTS
> = {
  "Grade 1": LOWER_ELEM_SUBJECTS,
  "Grade 2": LOWER_ELEM_SUBJECTS,
  "Grade 3": LOWER_ELEM_SUBJECTS,
  "Grade 4": UPPER_ELEM_SUBJECTS,
  "Grade 5": UPPER_ELEM_SUBJECTS,
  "Grade 6": UPPER_ELEM_SUBJECTS,
  "Grade 7": JHS_SUBJECTS,
  "Grade 8": JHS_SUBJECTS,
  "Grade 9": JHS_SUBJECTS,
  "Grade 10": JHS_SUBJECTS,
};

/** Extract grade number from grade name (e.g., "Grade 1" → 1) */
function getGradeNumber(gradeName: string): number {
  const match = gradeName.match(/Grade (\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Exportable Seed Function ─────────────────────────────────────────────────

export async function seedSubjects(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding elementary & JHS subjects...");

  // ─── Get Active School Year ─────────────────────────────────────────────────
  const [activeSchoolYear] = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(eq(schoolYears.isActive, true))
    .limit(1);

  if (!activeSchoolYear) {
    throw new Error("No active school year found. Run db:seed-config first.");
  }
  console.log(`📅 Using school year: ${activeSchoolYear.label}`);

  // ─── Get or Create Curriculum ───────────────────────────────────────────────
  const curriculumName = `DepEd K-12 (${activeSchoolYear.label})`;
  let [curriculum] = await db
    .select({ id: curriculums.id })
    .from(curriculums)
    .where(
      and(
        eq(curriculums.name, curriculumName),
        eq(curriculums.effectiveSchoolYearId, activeSchoolYear.id)
      )
    )
    .limit(1);

  if (!curriculum) {
    [curriculum] = await db
      .insert(curriculums)
      .values({
        name: curriculumName,
        effectiveSchoolYearId: activeSchoolYear.id,
      })
      .returning({ id: curriculums.id });
    console.log(`✅ Created curriculum: ${curriculumName}`);
  } else {
    console.log(`✅ Using existing curriculum: ${curriculumName}`);
  }

  // ─── Get Grade Levels ───────────────────────────────────────────────────────
  const allGradeLevels = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels);

  const gradeLevelMap = new Map(allGradeLevels.map((gl) => [gl.name, gl.id]));

  // ─── Get Existing Subjects (to avoid duplicates) ────────────────────────────
  const existingSubjects = await db
    .select({ code: subjects.code, gradeLevelId: subjects.gradeLevelId })
    .from(subjects)
    .where(
      and(
        eq(subjects.curriculumId, curriculum.id),
        isNull(subjects.deletedAt)
      )
    );

  const existingSubjectKeys = new Set(
    existingSubjects.map((s) => `${s.code}-${s.gradeLevelId}`)
  );

  // ─── Insert Subjects Per Grade Level ────────────────────────────────────────
  let insertedCount = 0;
  let skippedCount = 0;

  for (const [gradeName, subjectList] of Object.entries(GRADE_SUBJECT_MAP)) {
    const gradeLevelId = gradeLevelMap.get(gradeName);
    if (!gradeLevelId) {
      console.warn(`⚠️ Grade level "${gradeName}" not found. Skipping.`);
      continue;
    }

    const gradeNumber = getGradeNumber(gradeName);

    for (const subject of subjectList) {
      // Generate grade-specific code (e.g., FIL1, MTH4)
      const subjectCode = `${subject.code}${gradeNumber}`;
      const subjectKey = `${subjectCode}-${gradeLevelId}`;

      if (existingSubjectKeys.has(subjectKey)) {
        skippedCount++;
        continue;
      }

      await db.insert(subjects).values({
        name: subject.name,
        code: subjectCode,
        curriculumId: curriculum.id,
        gradeLevelId: gradeLevelId,
      });

      existingSubjectKeys.add(subjectKey);
      insertedCount++;
    }

    console.log(`  📚 ${gradeName}: subjects processed`);
  }

  console.log(`\n✅ Subjects seeding complete!`);
  console.log(`   Created: ${insertedCount} subjects`);
  console.log(`   Skipped: ${skippedCount} (already exist)`);
}

// ─── Standalone Execution ─────────────────────────────────────────────────────

if (require.main === module) {
  expand(config({ path: ".env.local" }));
  expand(config());

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  seedSubjects(db)
    .then(async () => {
      await client.end();
    })
    .catch(async (err) => {
      console.error("❌ Subjects seed failed:", err);
      await client.end();
      process.exit(1);
    });
}
