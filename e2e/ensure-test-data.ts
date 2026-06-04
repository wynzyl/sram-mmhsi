import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, isNull, like, lte, sql, inArray } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  students,
  registrations,
  enrollments,
  assessments,
  schoolYears,
  gradeLevels,
  parentsGuardians,
  studentGuardianLinks,
  feeTemplates,
  feeTemplateItems,
  receiptBooklets,
} from "../src/lib/db/schema";
import { generateStudentRef } from "../src/lib/utils/reference";

loadEnvConfig(process.cwd());

/** Marker used on synthetic students so prior runs can be soft-deleted safely. */
export const E2E_LASTNAME_PREFIX = "E2E-CASA";

export const TEST_DATA_STATE_PATH = path.join(__dirname, ".state", "test-data.json");

export type E2eCasaStudent = {
  studentId: string;
  registrationId: string;
  referenceNumber: string;
  firstName: string;
  lastName: string;
  gradeLevelName: "Junior Casa" | "Senior Casa";
  gradeLevelId: string;
};

export type E2eTestDataState = {
  runId: string;
  schoolYearId: string;
  /** Dedicated E2E receipt booklet (prefix ZZ) so tests never consume real OR numbers. */
  bookletId: string;
  juniorCasa: E2eCasaStudent;
  seniorCasa: E2eCasaStudent;
};

/** OR booklet prefix reserved for E2E runs (kept away from real series like AK). */
export const E2E_BOOKLET_PREFIX = "ZZ";

/**
 * Finds (or creates) an active E2E-only receipt booklet so payment tests
 * consume ZZ-series ORs instead of the school's real booklets.
 * Booklets hold 51 numbers per business rule (e.g. ZZ-00001-00051).
 */
async function ensureE2eBooklet(db: ReturnType<typeof drizzle>): Promise<string> {
  const [existing] = await db
    .select({ id: receiptBooklets.id })
    .from(receiptBooklets)
    .where(
      and(
        eq(receiptBooklets.prefix, E2E_BOOKLET_PREFIX),
        eq(receiptBooklets.status, "active"),
        lte(receiptBooklets.nextNumber, receiptBooklets.endNumber)
      )
    )
    .limit(1);
  if (existing) return existing.id;

  // Start a fresh 51-number range above any prior ZZ booklet.
  const [maxRow] = await db.execute<{ max_end: number | null }>(
    sql`SELECT MAX(end_number)::int AS max_end FROM receipt_booklets WHERE prefix = ${E2E_BOOKLET_PREFIX}`
  );
  const startNumber = Number(maxRow?.max_end ?? 0) + 1;
  const endNumber = startNumber + 50; // 51 pieces per booklet (business rule)
  const pad = (n: number) => String(n).padStart(5, "0");

  const [created] = await db
    .insert(receiptBooklets)
    .values({
      series: `${E2E_BOOKLET_PREFIX}-${pad(startNumber)}-${pad(endNumber)}`,
      prefix: E2E_BOOKLET_PREFIX,
      startNumber,
      endNumber,
      nextNumber: startNumber,
      status: "active",
    })
    .returning({ id: receiptBooklets.id });

  console.log(
    `[e2e] Created E2E receipt booklet ${E2E_BOOKLET_PREFIX}-${pad(startNumber)}-${pad(endNumber)}.`
  );
  return created.id;
}

/**
 * Allocates the next unique student reference number.
 *
 * Mirrors `getNextStudentSequence()` in students.actions.ts but with a wider
 * retry window: the dev DB's `student_ref_seq` can lag behind seeded
 * reference numbers (seed scripts compute refs from MAX instead of nextval),
 * so we advance the sequence until it produces an unused number.
 */
async function nextUniqueStudentRef(db: ReturnType<typeof drizzle>): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const [row] = await db.execute<{ nextval: number }>(
      sql`SELECT nextval('student_ref_seq') AS nextval`
    );
    const ref = generateStudentRef(Number(row?.nextval ?? 1));
    const existing = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.referenceNumber, ref))
      .limit(1);
    if (existing.length === 0) return ref;
  }
  throw new Error("[e2e] Unable to allocate a unique student reference number after 200 attempts.");
}

/** Soft-deletes synthetic students from previous runs and cancels their open enrollments. */
async function cleanupPriorRuns(db: ReturnType<typeof drizzle>): Promise<void> {
  const stale = await db
    .select({ id: students.id })
    .from(students)
    .where(and(like(students.lastName, `${E2E_LASTNAME_PREFIX}%`), isNull(students.deletedAt)));

  if (stale.length === 0) return;
  const staleIds = stale.map((s) => s.id);

  // Hide from queues + lists (ready-to-enroll filters on is_active).
  await db
    .update(students)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(inArray(students.id, staleIds));

  // Cancel any non-cancelled enrollments so they leave the pending/assessed tabs.
  await db
    .update(enrollments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelRemarks: "E2E cleanup (synthetic test data from a previous Playwright run)",
      updatedAt: new Date(),
    })
    .where(
      and(inArray(enrollments.studentId, staleIds), sql`${enrollments.status} != 'cancelled'`)
    );

  // Cancel their open assessments so they leave finance queues.
  await db
    .update(assessments)
    .set({ billingStatus: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        inArray(assessments.studentId, staleIds),
        sql`${assessments.billingStatus} = 'outstanding'`
      )
    );

  console.log(`[e2e] Cleaned up ${staleIds.length} synthetic student(s) from prior runs.`);
}

async function createCasaStudent(
  db: ReturnType<typeof drizzle>,
  opts: {
    runId: string;
    schoolYearId: string;
    gradeLevelId: string;
    gradeLevelName: "Junior Casa" | "Senior Casa";
    firstName: string;
    gender: "Male" | "Female";
  }
): Promise<E2eCasaStudent> {
  const lastName = `${E2E_LASTNAME_PREFIX}-${opts.runId}`;
  const referenceNumber = await nextUniqueStudentRef(db);

  const [student] = await db
    .insert(students)
    .values({
      referenceNumber,
      firstName: opts.firstName,
      middleName: "Playwright",
      lastName,
      gender: opts.gender,
      isActive: true,
    })
    .returning({ id: students.id });

  // All documents received → student shows as "Complete" in the ready queue.
  const [registration] = await db
    .insert(registrations)
    .values({
      studentId: student.id,
      schoolYearId: opts.schoolYearId,
      gradeLevelId: opts.gradeLevelId,
      studentType: "new_student",
      intakeDocuments: {
        form138: "received",
        birthCertificatePsa: "received",
        goodMoralCharacter: "not_applicable",
        qualifiedVoucher: "not_applicable",
        escCertificate: "not_applicable",
      },
      status: "approved",
    })
    .returning({ id: registrations.id });

  const guardianEmail = `guardian.${opts.firstName.toLowerCase()}.${opts.runId.toLowerCase()}@srams-e2e.invalid`;
  const [guardian] = await db
    .insert(parentsGuardians)
    .values({
      firstName: "Guardian",
      lastName,
      relationship: "Mother",
      address: "1 E2E Test St., Brgy. Playwright, Test City",
      occupation: "QA Engineer",
      contactNumber: "09170000001",
      email: guardianEmail,
    })
    .returning({ id: parentsGuardians.id });

  await db.insert(studentGuardianLinks).values({
    studentId: student.id,
    guardianId: guardian.id,
    isPrimary: true,
  });

  return {
    studentId: student.id,
    registrationId: registration.id,
    referenceNumber,
    firstName: opts.firstName,
    lastName,
    gradeLevelName: opts.gradeLevelName,
    gradeLevelId: opts.gradeLevelId,
  };
}

/**
 * Provisions fresh synthetic Junior Casa + Senior Casa students with approved
 * registrations for the Playwright enrollment → assessment → payment suite.
 * Runs preflight checks so the suite fails fast with a clear message when the
 * environment is missing required configuration.
 */
export async function ensureE2eTestData(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[e2e] DATABASE_URL is not set; skipping E2E test data provisioning.");
    return;
  }

  const client = postgres(connectionString, { max: 1 });

  try {
    const db = drizzle(client);

    // ── Preflight: active school year ──────────────────────────────────────
    const [activeSy] = await db
      .select({ id: schoolYears.id, label: schoolYears.label })
      .from(schoolYears)
      .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
      .limit(1);
    if (!activeSy) {
      throw new Error("[e2e] No active school year. Run `npm run db:seed-config` first.");
    }

    // ── Preflight: Junior/Senior Casa grade levels ─────────────────────────
    const casaLevels = await db
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .where(inArray(gradeLevels.name, ["Junior Casa", "Senior Casa"]));
    const juniorCasaLevel = casaLevels.find((g) => g.name === "Junior Casa");
    const seniorCasaLevel = casaLevels.find((g) => g.name === "Senior Casa");
    if (!juniorCasaLevel || !seniorCasaLevel) {
      throw new Error("[e2e] Junior Casa / Senior Casa grade levels not found. Run `npm run db:seed-config`.");
    }

    // ── Preflight: active casa fee template with at least one item ─────────
    const [casaTemplate] = await db
      .select({ id: feeTemplates.id })
      .from(feeTemplates)
      .where(and(eq(feeTemplates.assessmentBand, "casa"), eq(feeTemplates.isActive, true)))
      .limit(1);
    if (!casaTemplate) {
      throw new Error("[e2e] No active 'casa' fee template — finance assessment step cannot run.");
    }
    const casaItems = await db
      .select({ id: feeTemplateItems.id })
      .from(feeTemplateItems)
      .where(eq(feeTemplateItems.feeTemplateId, casaTemplate.id))
      .limit(1);
    if (casaItems.length === 0) {
      throw new Error("[e2e] The active 'casa' fee template has no items — assessment would be empty.");
    }

    // ── Dedicated E2E booklet (never consume real OR series) ───────────────
    const bookletId = await ensureE2eBooklet(db);

    // ── Cleanup + fresh provisioning ───────────────────────────────────────
    await cleanupPriorRuns(db);

    const runId = Date.now().toString(36).toUpperCase();

    const juniorCasa = await createCasaStudent(db, {
      runId,
      schoolYearId: activeSy.id,
      gradeLevelId: juniorCasaLevel.id,
      gradeLevelName: "Junior Casa",
      firstName: "Junior",
      gender: "Male",
    });

    const seniorCasa = await createCasaStudent(db, {
      runId,
      schoolYearId: activeSy.id,
      gradeLevelId: seniorCasaLevel.id,
      gradeLevelName: "Senior Casa",
      firstName: "Senior",
      gender: "Female",
    });

    const state: E2eTestDataState = {
      runId,
      schoolYearId: activeSy.id,
      bookletId,
      juniorCasa,
      seniorCasa,
    };

    mkdirSync(path.dirname(TEST_DATA_STATE_PATH), { recursive: true });
    writeFileSync(TEST_DATA_STATE_PATH, JSON.stringify(state, null, 2), "utf8");

    console.log(
      `[e2e] Provisioned synthetic Casa students for run ${runId}: ` +
        `${juniorCasa.lastName}, ${juniorCasa.firstName} (${juniorCasa.referenceNumber}) / ` +
        `${seniorCasa.lastName}, ${seniorCasa.firstName} (${seniorCasa.referenceNumber})`
    );
  } finally {
    await client.end();
  }
}
