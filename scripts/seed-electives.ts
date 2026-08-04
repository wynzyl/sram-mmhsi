/**
 * SRAMS SHS Electives Seed Script
 * Seeds SHS core subjects and strand-specific electives for Grade 11-12.
 * Links strand-specific subjects via subjectStrands junction table.
 * Run: npm run db:seed-electives
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  schoolYears,
  gradeLevels,
  curriculums,
  curriculumAdoptions,
  subjects,
  strands,
  subjectStrands,
  users,
} from "../src/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import type { ShsStrandCode } from "../src/lib/constants/strands";

// ─── Subject Definitions ──────────────────────────────────────────────────────

interface SubjectDef {
  code: string;
  name: string;
  units: string;
  grade: 11 | 12;
}

/** SHS Core Subjects (All Strands) - these are core curriculum, not electives */
const SHS_CORE_SUBJECTS: SubjectDef[] = [
  // Grade 11
  { code: "ORAL-COMM", name: "Oral Communication", units: "1.0", grade: 11 },
  { code: "RWS", name: "Reading and Writing Skills", units: "1.0", grade: 11 },
  { code: "KOMUNIK", name: "Komunikasyon at Pananaliksik", units: "1.0", grade: 11 },
  { code: "21ST-LIT", name: "21st Century Literature", units: "1.0", grade: 11 },
  { code: "GEN-MATH", name: "General Mathematics", units: "1.0", grade: 11 },
  { code: "STATS-PROB", name: "Statistics and Probability", units: "1.0", grade: 11 },
  { code: "EARTH-SCI", name: "Earth and Life Science", units: "1.0", grade: 11 },
  { code: "PE-HEALTH1", name: "PE and Health 1", units: "1.0", grade: 11 },
  { code: "PE-HEALTH2", name: "PE and Health 2", units: "1.0", grade: 11 },
  { code: "PERS-DEV", name: "Personal Development", units: "1.0", grade: 11 },
  { code: "UCSP", name: "Understanding Culture, Society, Politics", units: "1.0", grade: 11 },
  { code: "EMPOWERTECH", name: "Empowerment Technologies", units: "1.0", grade: 11 },
  // Grade 12
  { code: "KONTEMPH", name: "Kontemporaryong Filipino", units: "1.0", grade: 12 },
  { code: "PHYS-SCI", name: "Physical Science", units: "1.0", grade: 12 },
  { code: "PE-HEALTH3", name: "PE and Health 3", units: "1.0", grade: 12 },
  { code: "PE-HEALTH4", name: "PE and Health 4", units: "1.0", grade: 12 },
  { code: "INTRO-PHILO", name: "Introduction to Philosophy", units: "1.0", grade: 12 },
  { code: "CONTEMP-ARTS", name: "Contemporary Philippine Arts", units: "1.0", grade: 12 },
  { code: "MEDIA-INFO", name: "Media and Information Literacy", units: "1.0", grade: 12 },
  { code: "ENTREP", name: "Entrepreneurship", units: "1.0", grade: 12 },
  { code: "INQUIRE1", name: "Inquiries, Investigations, Immersion 1", units: "1.0", grade: 12 },
  { code: "INQUIRE2", name: "Inquiries, Investigations, Immersion 2", units: "1.0", grade: 12 },
];

/** Strand-specific specialized subjects (isStrandCore = true for their strand) */
const STRAND_SUBJECTS: Record<ShsStrandCode, SubjectDef[]> = {
  // STEM Strand
  STEM: [
    { code: "PRE-CALC", name: "Pre-Calculus", units: "1.0", grade: 11 },
    { code: "BASIC-CALC", name: "Basic Calculus", units: "1.0", grade: 11 },
    { code: "GEN-BIO1", name: "General Biology 1", units: "1.0", grade: 11 },
    { code: "GEN-BIO2", name: "General Biology 2", units: "1.0", grade: 11 },
    { code: "GEN-CHEM1", name: "General Chemistry 1", units: "1.0", grade: 11 },
    { code: "GEN-CHEM2", name: "General Chemistry 2", units: "1.0", grade: 11 },
    { code: "GEN-PHYS1", name: "General Physics 1", units: "1.0", grade: 12 },
    { code: "GEN-PHYS2", name: "General Physics 2", units: "1.0", grade: 12 },
    { code: "RESEARCH1", name: "Research in Daily Life 1", units: "1.0", grade: 12 },
    { code: "RESEARCH2", name: "Research in Daily Life 2", units: "1.0", grade: 12 },
  ],
  // ABM Strand
  ABM: [
    { code: "ABM-1", name: "Applied Economics", units: "1.0", grade: 11 },
    { code: "ABM-2", name: "Business Ethics", units: "1.0", grade: 11 },
    { code: "ABM-3", name: "Fundamentals of ABM 1", units: "1.0", grade: 11 },
    { code: "ABM-4", name: "Fundamentals of ABM 2", units: "1.0", grade: 11 },
    { code: "ABM-5", name: "Business Math", units: "1.0", grade: 11 },
    { code: "ABM-6", name: "Business Finance", units: "1.0", grade: 12 },
    { code: "ABM-7", name: "Organization and Management", units: "1.0", grade: 12 },
    { code: "ABM-8", name: "Principles of Marketing", units: "1.0", grade: 12 },
  ],
  // HUMSS Strand
  HUMSS: [
    { code: "HUMSS-1", name: "Creative Writing", units: "1.0", grade: 11 },
    { code: "HUMSS-2", name: "Creative Nonfiction", units: "1.0", grade: 11 },
    { code: "HUMSS-3", name: "Introduction to World Religions", units: "1.0", grade: 11 },
    { code: "HUMSS-4", name: "Philippine Politics and Governance", units: "1.0", grade: 11 },
    { code: "HUMSS-5", name: "Community Engagement", units: "1.0", grade: 11 },
    { code: "HUMSS-6", name: "Disciplines in Social Sciences", units: "1.0", grade: 12 },
    { code: "HUMSS-7", name: "Trends, Networks in 21st Century", units: "1.0", grade: 12 },
    { code: "HUMSS-8", name: "Culminating Activity", units: "1.0", grade: 12 },
  ],
  // GAS Strand
  GAS: [
    { code: "GAS-1", name: "Humanities 1", units: "1.0", grade: 11 },
    { code: "GAS-2", name: "Humanities 2", units: "1.0", grade: 11 },
    { code: "GAS-3", name: "Social Science 1", units: "1.0", grade: 11 },
    { code: "GAS-4", name: "Applied Economics", units: "1.0", grade: 11 },
    { code: "GAS-5", name: "Organization and Management", units: "1.0", grade: 12 },
    { code: "GAS-6", name: "Disaster Readiness", units: "1.0", grade: 12 },
    { code: "GAS-7", name: "Elective 1", units: "1.0", grade: 12 },
    { code: "GAS-8", name: "Elective 2", units: "1.0", grade: 12 },
  ],
  // TVL-ICT Strand
  "TVL-ICT": [
    { code: "ICT-1", name: "Computer Systems Servicing 1", units: "1.0", grade: 11 },
    { code: "ICT-2", name: "Computer Systems Servicing 2", units: "1.0", grade: 11 },
    { code: "ICT-3", name: "Computer Programming 1", units: "1.0", grade: 11 },
    { code: "ICT-4", name: "Computer Programming 2", units: "1.0", grade: 11 },
    { code: "ICT-5", name: "Web Development 1", units: "1.0", grade: 12 },
    { code: "ICT-6", name: "Web Development 2", units: "1.0", grade: 12 },
    { code: "ICT-7", name: "Animation 1", units: "1.0", grade: 12 },
    { code: "ICT-8", name: "Animation 2", units: "1.0", grade: 12 },
  ],
  // TVL-HE Strand
  "TVL-HE": [
    { code: "HE-1", name: "Bread and Pastry Production 1", units: "1.0", grade: 11 },
    { code: "HE-2", name: "Bread and Pastry Production 2", units: "1.0", grade: 11 },
    { code: "HE-3", name: "Food and Beverage Services 1", units: "1.0", grade: 11 },
    { code: "HE-4", name: "Food and Beverage Services 2", units: "1.0", grade: 11 },
    { code: "HE-5", name: "Housekeeping 1", units: "1.0", grade: 12 },
    { code: "HE-6", name: "Housekeeping 2", units: "1.0", grade: 12 },
    { code: "HE-7", name: "Front Office Services 1", units: "1.0", grade: 12 },
    { code: "HE-8", name: "Front Office Services 2", units: "1.0", grade: 12 },
  ],
  // TVL-IA Strand
  "TVL-IA": [
    { code: "IA-1", name: "Shielded Metal Arc Welding 1", units: "1.0", grade: 11 },
    { code: "IA-2", name: "Shielded Metal Arc Welding 2", units: "1.0", grade: 11 },
    { code: "IA-3", name: "Electrical Installation 1", units: "1.0", grade: 11 },
    { code: "IA-4", name: "Electrical Installation 2", units: "1.0", grade: 11 },
    { code: "IA-5", name: "Automotive Servicing 1", units: "1.0", grade: 12 },
    { code: "IA-6", name: "Automotive Servicing 2", units: "1.0", grade: 12 },
    { code: "IA-7", name: "Carpentry 1", units: "1.0", grade: 12 },
    { code: "IA-8", name: "Carpentry 2", units: "1.0", grade: 12 },
  ],
  // TVL-AFA Strand
  "TVL-AFA": [
    { code: "AFA-1", name: "Agricultural Crops Production 1", units: "1.0", grade: 11 },
    { code: "AFA-2", name: "Agricultural Crops Production 2", units: "1.0", grade: 11 },
    { code: "AFA-3", name: "Animal Production 1", units: "1.0", grade: 11 },
    { code: "AFA-4", name: "Animal Production 2", units: "1.0", grade: 11 },
    { code: "AFA-5", name: "Fish Culture 1", units: "1.0", grade: 12 },
    { code: "AFA-6", name: "Fish Culture 2", units: "1.0", grade: 12 },
    { code: "AFA-7", name: "Horticulture 1", units: "1.0", grade: 12 },
    { code: "AFA-8", name: "Horticulture 2", units: "1.0", grade: 12 },
  ],
};

// ─── Exportable Seed Function ─────────────────────────────────────────────────

export async function seedElectives(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding SHS electives and strand-specific subjects...");

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

  // ─── Get System Actor (for createdBy) ───────────────────────────────────────
  const [systemUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "super_admin"))
    .limit(1);

  if (!systemUser) {
    throw new Error("No super_admin user found. Run db:seed-config first.");
  }

  // ─── Get Grade Levels (Grade 11 and 12) ─────────────────────────────────────
  const shsGradeLevels = await db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels)
    .where(inArray(gradeLevels.name, ["Grade 11", "Grade 12"]));

  const gradeLevelMap = new Map(shsGradeLevels.map((gl) => [gl.name, gl.id]));

  const grade11Id = gradeLevelMap.get("Grade 11");
  const grade12Id = gradeLevelMap.get("Grade 12");

  if (!grade11Id || !grade12Id) {
    throw new Error("Grade 11 or Grade 12 not found. Run db:seed-config first.");
  }
  console.log(`📚 Found Grade 11 (${grade11Id}) and Grade 12 (${grade12Id})`);

  // ─── Get All Active Strands ─────────────────────────────────────────────────
  const activeStrands = await db
    .select({ id: strands.id, code: strands.code })
    .from(strands)
    .where(and(eq(strands.isActive, true), isNull(strands.deletedAt)));

  if (activeStrands.length === 0) {
    throw new Error("No active strands found. Run strand seeding first.");
  }

  const strandMap = new Map(activeStrands.map((s) => [s.code, s.id]));
  console.log(`📋 Found ${activeStrands.length} active strands`);

  const curriculumName = `DepEd K-12 (${activeSchoolYear.label})`;

  // ─── Seed Curriculum, Subjects, and Strand Links (single transaction) ───────
  const result = await db.transaction(async (tx) => {
    // ─── Get or Create Curriculum ─────────────────────────────────────────────
    const [existingAdoption] = await tx
      .select({ curriculumId: curriculumAdoptions.curriculumId })
      .from(curriculumAdoptions)
      .innerJoin(curriculums, eq(curriculumAdoptions.curriculumId, curriculums.id))
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
          status: "published",
          version: 1,
          publishedAt: new Date(),
          publishedBy: systemUser.id,
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

    // ─── Ensure Curriculum Adoptions for Grade 11 & 12 ────────────────────────
    for (const gradeLevelId of [grade11Id, grade12Id]) {
      await tx
        .insert(curriculumAdoptions)
        .values({
          schoolYearId: activeSchoolYear.id,
          gradeLevelId,
          curriculumId: curriculum.id,
          adoptedBy: systemUser.id,
        })
        .onConflictDoNothing({
          target: [curriculumAdoptions.schoolYearId, curriculumAdoptions.gradeLevelId],
          where: isNull(curriculumAdoptions.deletedAt),
        });
    }

    // ─── Get Existing Subjects (to avoid duplicates) ──────────────────────────
    const existingSubjects = await tx
      .select({ id: subjects.id, code: subjects.code, gradeLevelId: subjects.gradeLevelId })
      .from(subjects)
      .where(and(eq(subjects.curriculumId, curriculum.id), isNull(subjects.deletedAt)));

    const existingSubjectKeys = new Set(
      existingSubjects.map((s) => `${s.code}-${s.gradeLevelId}`)
    );
    const subjectIdByKey = new Map(
      existingSubjects.map((s) => [`${s.code}-${s.gradeLevelId}`, s.id])
    );

    // ─── Get Existing Subject-Strand Links ────────────────────────────────────
    const existingLinks = await tx
      .select({ subjectId: subjectStrands.subjectId, strandId: subjectStrands.strandId })
      .from(subjectStrands)
      .where(isNull(subjectStrands.deletedAt));

    const existingLinkKeys = new Set(
      existingLinks.map((l) => `${l.subjectId}-${l.strandId}`)
    );

    let coreSubjectsInserted = 0;
    let coreSubjectsSkipped = 0;
    let strandSubjectsInserted = 0;
    let strandSubjectsSkipped = 0;
    let strandLinksInserted = 0;
    let strandLinksSkipped = 0;

    // ─── Helper to get grade level ID ─────────────────────────────────────────
    const getGradeLevelId = (grade: 11 | 12): string => {
      return grade === 11 ? grade11Id : grade12Id;
    };

    // ─── Insert SHS Core Subjects (isCore = true) ─────────────────────────────
    for (let index = 0; index < SHS_CORE_SUBJECTS.length; index++) {
      const subject = SHS_CORE_SUBJECTS[index];
      const gradeLevelId = getGradeLevelId(subject.grade);
      const subjectKey = `${subject.code}-${gradeLevelId}`;

      if (existingSubjectKeys.has(subjectKey)) {
        coreSubjectsSkipped++;
        continue;
      }

      const [inserted] = await tx
        .insert(subjects)
        .values({
          name: subject.name,
          code: subject.code,
          curriculumId: curriculum.id,
          gradeLevelId,
          units: subject.units,
          sequenceOrder: index,
          isCore: true, // Core SHS subjects
          createdBy: systemUser.id,
          updatedBy: systemUser.id,
        })
        .returning({ id: subjects.id });

      existingSubjectKeys.add(subjectKey);
      subjectIdByKey.set(subjectKey, inserted.id);
      coreSubjectsInserted++;
    }

    // ─── Insert Strand-Specific Subjects & Links ──────────────────────────────
    for (const [strandCode, strandSubjects] of Object.entries(STRAND_SUBJECTS)) {
      const strandId = strandMap.get(strandCode as ShsStrandCode);
      if (!strandId) {
        console.warn(`⚠️ Strand ${strandCode} not found in database, skipping its subjects`);
        continue;
      }

      for (let index = 0; index < strandSubjects.length; index++) {
        const subject = strandSubjects[index];
        const gradeLevelId = getGradeLevelId(subject.grade);
        const subjectKey = `${subject.code}-${gradeLevelId}`;

        let subjectId: string;

        // Insert subject if not exists
        if (existingSubjectKeys.has(subjectKey)) {
          subjectId = subjectIdByKey.get(subjectKey)!;
          strandSubjectsSkipped++;
        } else {
          const [inserted] = await tx
            .insert(subjects)
            .values({
              name: subject.name,
              code: subject.code,
              curriculumId: curriculum.id,
              gradeLevelId,
              units: subject.units,
              sequenceOrder: 100 + index, // After core subjects
              isCore: false, // These are electives
              createdBy: systemUser.id,
              updatedBy: systemUser.id,
            })
            .returning({ id: subjects.id });

          subjectId = inserted.id;
          existingSubjectKeys.add(subjectKey);
          subjectIdByKey.set(subjectKey, subjectId);
          strandSubjectsInserted++;
        }

        // Create subject-strand link
        const linkKey = `${subjectId}-${strandId}`;
        if (existingLinkKeys.has(linkKey)) {
          strandLinksSkipped++;
        } else {
          await tx.insert(subjectStrands).values({
            subjectId,
            strandId,
            isStrandCore: true, // Required for this strand
            createdBy: systemUser.id,
          });

          existingLinkKeys.add(linkKey);
          strandLinksInserted++;
        }
      }
    }

    return {
      createdCurriculum,
      coreSubjectsInserted,
      coreSubjectsSkipped,
      strandSubjectsInserted,
      strandSubjectsSkipped,
      strandLinksInserted,
      strandLinksSkipped,
    };
  });

  // ─── Summary Report ─────────────────────────────────────────────────────────
  console.log(
    result.createdCurriculum
      ? `✅ Created curriculum: ${curriculumName}`
      : `✅ Using existing curriculum: ${curriculumName}`
  );
  console.log(`\n✅ SHS Electives seeding complete!`);
  console.log(`\n📊 Core Subjects (All Strands):`);
  console.log(`   Created: ${result.coreSubjectsInserted}`);
  console.log(`   Skipped: ${result.coreSubjectsSkipped} (already exist)`);
  console.log(`\n📊 Strand-Specific Subjects:`);
  console.log(`   Created: ${result.strandSubjectsInserted}`);
  console.log(`   Skipped: ${result.strandSubjectsSkipped} (already exist)`);
  console.log(`\n📊 Subject-Strand Links:`);
  console.log(`   Created: ${result.strandLinksInserted}`);
  console.log(`   Skipped: ${result.strandLinksSkipped} (already exist)`);
}

// ─── Standalone Execution ─────────────────────────────────────────────────────

if (require.main === module) {
  expand(config({ path: ".env.local" }));
  expand(config());

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  seedElectives(db)
    .then(async () => {
      await client.end();
    })
    .catch(async (err) => {
      console.error("❌ Electives seed failed:", err);
      await client.end();
      process.exit(1);
    });
}
