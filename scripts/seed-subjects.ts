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
  curriculumAdoptions,
  subjects,
  users,
} from "../src/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// ─── Subject Definitions ──────────────────────────────────────────────────────

/** Lower Elementary (Grade 1-3) subjects */
const LOWER_ELEM_SUBJECTS = [
  { code: "RED", name: "Reading/Spelling" },
  { code: "SCI", name: "Science" },
  { code: "LAN", name: "Language" },
  { code: "GMRC", name: "GMRC" },
  { code: "MAK", name: "Makabansa" },
  { code: "FIL", name: "Filipino/Pagbaybay" },
  { code: "MTH", name: "Math and Geometry" },
  { code: "MAPEH", name: "MAPEH" },
] as const;

/** Upper Elementary (Grade 4-6) subjects */
const UPPER_ELEM_SUBJECTS = [
  { code: "RED", name: "Reading/Spelling" },
  { code: "SCI", name: "Science" },
  { code: "LAN", name: "Language" },
  { code: "GMRC", name: "GMRC" },
  { code: "AP", name: "Araling Panlipunan" },
  { code: "FIL", name: "Filipino/Pagbaybay" },
  { code: "MTH", name: "Math and Geometry" },
  { code: "MAPEH", name: "MAPEH" },
  { code: "COMP", name: "Computer" },
  { code: "EPP", name: "EPP" },
] as const;

/** Junior High School (Grade 7-10) subjects */
const JHS_SUBJECTS = [
  { code: "FIL", name: "Filipino" },
  { code: "ENG", name: "English" },
  { code: "MTH", name: "Mathematics" },
  { code: "SCI", name: "Science" },
  { code: "AP", name: "Araling Panlipunan" },
  { code: "MAPEH", name: "MAPEH" },
  { code: "GMRC", name: "GMRC" },
  { code: "TLE", name: "Technology and Livelihood Education" },
  { code: "COMP", name: "Computer" },
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
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  if (!activeSchoolYear) {
    throw new Error("No active school year found. Run db:seed-config first.");
  }
  console.log(`📅 Using school year: ${activeSchoolYear.label}`);

  // ─── Get System Actor (for adoptedBy) ───────────────────────────────────────
  const [systemUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "super_admin"))
    .limit(1);

  if (!systemUser) {
    throw new Error(
      "No super_admin user found. Run db:seed-config first."
    );
  }

  // ─── Get Grade Levels ───────────────────────────────────────────────────────
  const allGradeLevels = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels);

  const gradeLevelMap = new Map(allGradeLevels.map((gl) => [gl.name, gl.id]));

  // ─── Validate All Expected Grade Levels Exist ───────────────────────────────
  // Fail fast so we never partially populate a curriculum for a subset of grades.
  const missingGrades = Object.keys(GRADE_SUBJECT_MAP).filter(
    (gradeName) => !gradeLevelMap.has(gradeName)
  );
  if (missingGrades.length > 0) {
    throw new Error(
      `Missing grade levels: ${missingGrades.join(", ")}. Run db:seed-config first.`
    );
  }

  const curriculumName = `DepEd K-12 (${activeSchoolYear.label})`;

  // ─── Seed Curriculum, Adoptions, and Subjects (single transaction) ──────────
  // Curriculum creation, its rootId self-link, per-grade adoptions, and subject
  // inserts all mutate related rows. Wrapping them in one transaction means any
  // failure rolls back the published curriculum AND every dependent record,
  // preventing partial state (e.g. a published curriculum with only some grades
  // adopted) that a rerun would then read as already-seeded.
  const { insertedCount, skippedCount, created } = await db.transaction(
    async (tx) => {
      // ─── Get or Create Curriculum ───────────────────────────────────────────
      // Curriculums are associated with a school year through curriculum_adoptions,
      // not the deprecated effectiveSchoolYearId column. Look up an existing
      // curriculum by name that already has an adoption for the active school year;
      // otherwise create a published v1 curriculum (rootId = self).
      const [existingAdoption] = await tx
        .select({ curriculumId: curriculumAdoptions.curriculumId })
        .from(curriculumAdoptions)
        .innerJoin(
          curriculums,
          eq(curriculumAdoptions.curriculumId, curriculums.id)
        )
        .where(
          and(
            eq(curriculums.name, curriculumName),
            eq(curriculumAdoptions.schoolYearId, activeSchoolYear.id),
            isNull(curriculumAdoptions.deletedAt)
          )
        )
        .limit(1);

      let curriculum: { id: string };
      let createdCurriculum = false;

      if (existingAdoption) {
        curriculum = { id: existingAdoption.curriculumId };
      } else {
        const [inserted] = await tx
          .insert(curriculums)
          .values({
            name: curriculumName,
            status: "draft",
            version: 1,
            createdBy: systemUser.id,
            updatedBy: systemUser.id,
          })
          .returning({ id: curriculums.id });

        // v1 is the root of its own version chain.
        await tx
          .update(curriculums)
          .set({ rootId: inserted.id })
          .where(eq(curriculums.id, inserted.id));

        curriculum = { id: inserted.id };
        createdCurriculum = true;
      }

      // ─── Adoption Preflight: Detect Conflicting Adoptions ───────────────────
      // onConflictDoNothing silently retains ANY existing active adoption for a
      // (schoolYearId, gradeLevelId) pair — including one pointing at a DIFFERENT
      // curriculum. That would leave subjects seeded under our curriculum while the
      // grade's active adoption points elsewhere. Inspect every target grade's
      // existing adoption up-front and fail on any mismatch, since this seed script
      // owns the DepEd curriculum adoption configuration.
      const existingAdoptions = await tx
        .select({
          gradeLevelId: curriculumAdoptions.gradeLevelId,
          curriculumId: curriculumAdoptions.curriculumId,
        })
        .from(curriculumAdoptions)
        .where(
          and(
            eq(curriculumAdoptions.schoolYearId, activeSchoolYear.id),
            isNull(curriculumAdoptions.deletedAt)
          )
        );

      const adoptionByGrade = new Map(
        existingAdoptions.map((a) => [a.gradeLevelId, a.curriculumId])
      );

      const conflictingGrades = Object.keys(GRADE_SUBJECT_MAP).filter(
        (gradeName) => {
          const gradeLevelId = gradeLevelMap.get(gradeName)!;
          const adopted = adoptionByGrade.get(gradeLevelId);
          return adopted !== undefined && adopted !== curriculum.id;
        }
      );

      if (conflictingGrades.length > 0) {
        // Throwing rolls back the transaction (including any curriculum created above).
        throw new Error(
          `Conflicting curriculum adoptions for ${activeSchoolYear.label}: ` +
            `${conflictingGrades.join(", ")} already adopt a different curriculum. ` +
            `Resolve (soft-delete/re-adopt) these adoptions before re-seeding "${curriculumName}".`
        );
      }

      // ─── Adopt Curriculum for Each Grade Level (active school year) ──────────
      // Any grade already adopting THIS curriculum is a no-op via onConflictDoNothing;
      // conflicting adoptions were rejected by the preflight above.
      for (const gradeName of Object.keys(GRADE_SUBJECT_MAP)) {
        const gradeLevelId = gradeLevelMap.get(gradeName)!;
        await tx
          .insert(curriculumAdoptions)
          .values({
            schoolYearId: activeSchoolYear.id,
            gradeLevelId,
            curriculumId: curriculum.id,
            adoptedBy: systemUser.id,
          })
          .onConflictDoNothing({
            target: [
              curriculumAdoptions.schoolYearId,
              curriculumAdoptions.gradeLevelId,
            ],
            // Partial unique index (deleted_at IS NULL) — match its predicate.
            // NOTE: onConflictDoNothing's predicate key is `where` (not
            // `targetWhere`, which is onConflictDoUpdate's key); the wrong key is
            // silently ignored and emits `ON CONFLICT (...) DO NOTHING` with no
            // predicate, failing against the partial index (Postgres 42P10).
            where: isNull(curriculumAdoptions.deletedAt),
          });
      }

      // ─── Get Existing Subjects (to avoid duplicates) ────────────────────────
      const existingSubjects = await tx
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

      // ─── Insert Subjects Per Grade Level ────────────────────────────────────
      let inserted = 0;
      let skipped = 0;

      for (const [gradeName, subjectList] of Object.entries(GRADE_SUBJECT_MAP)) {
        // Existence was validated up-front, so this is guaranteed present.
        const gradeLevelId = gradeLevelMap.get(gradeName)!;
        const gradeNumber = getGradeNumber(gradeName);

        for (let index = 0; index < subjectList.length; index++) {
          const subject = subjectList[index];
          // Generate grade-specific code (e.g., FIL1, MTH4)
          const subjectCode = `${subject.code}${gradeNumber}`;
          const subjectKey = `${subjectCode}-${gradeLevelId}`;

          if (existingSubjectKeys.has(subjectKey)) {
            skipped++;
            continue;
          }

          await tx.insert(subjects).values({
            name: subject.name,
            code: subjectCode,
            curriculumId: curriculum.id,
            gradeLevelId: gradeLevelId,
            // Preserve declared display order instead of the DB default (0).
            sequenceOrder: index,
          });

          existingSubjectKeys.add(subjectKey);
          inserted++;
        }
      }

      return {
        insertedCount: inserted,
        skippedCount: skipped,
        created: createdCurriculum,
      };
    }
  );

  console.log(
    created
      ? `✅ Created draft curriculum: ${curriculumName} (editable for finalization)`
      : `✅ Using existing curriculum: ${curriculumName}`
  );
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
