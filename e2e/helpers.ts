import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, desc, eq } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";
import type { Page } from "@playwright/test";
import {
  enrollments,
  assessments,
  assessmentItems,
  payments,
  auditLogs,
  receiptBooklets,
  users,
} from "../src/lib/db/schema";
import { TEST_DATA_STATE_PATH, type E2eTestDataState } from "./ensure-test-data";

loadEnvConfig(process.cwd());

// ─── UI helpers ────────────────────────────────────────────────────────────────

export async function login(
  page: Page,
  creds: { username: string; password: string }
): Promise<void> {
  await page.goto("/login");
  // Label is "Username or school email" — match loosely to survive copy tweaks.
  await page.getByLabel(/username/i).fill(creds.username);
  await page.getByLabel(/^Password$/i).fill(creds.password);
  await page.getByRole("button", { name: /Sign In/i }).click();
  // All staff roles land somewhere under /staff or /admin after login.
  await page.waitForURL(/\/(staff|admin)\//, { timeout: 30_000 });
}

export async function logout(page: Page): Promise<void> {
  // Clearing cookies is the most robust role switch (no dependency on nav UI).
  await page.context().clearCookies();
}

// ─── Test data state ───────────────────────────────────────────────────────────

export function readTestDataState(): E2eTestDataState {
  return JSON.parse(readFileSync(TEST_DATA_STATE_PATH, "utf8")) as E2eTestDataState;
}

// ─── DB assertion helpers ──────────────────────────────────────────────────────

/**
 * Shared read-only DB handle for assertions. Opened lazily, closed via
 * `closeDb()` in the spec's afterAll hook.
 */
let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb(): ReturnType<typeof drizzle> {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("[e2e] DATABASE_URL is not set.");
    client = postgres(connectionString, { max: 1 });
    db = drizzle(client);
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export async function getEnrollmentForStudent(studentId: string, schoolYearId: string) {
  const rows = await getDb()
    .select({
      id: enrollments.id,
      status: enrollments.status,
      gradeLevelId: enrollments.gradeLevelId,
      registrationId: enrollments.registrationId,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.schoolYearId, schoolYearId)))
    .orderBy(desc(enrollments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAssessmentForEnrollment(enrollmentId: string) {
  const rows = await getDb()
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
    })
    .from(assessments)
    .where(eq(assessments.enrollmentId, enrollmentId))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAssessmentItems(assessmentId: string) {
  return getDb()
    .select({
      id: assessmentItems.id,
      description: assessmentItems.description,
      amount: assessmentItems.amount,
      isDiscount: assessmentItems.isDiscount,
    })
    .from(assessmentItems)
    .where(eq(assessmentItems.assessmentId, assessmentId));
}

export async function getPaymentsForAssessment(assessmentId: string) {
  return getDb()
    .select({
      id: payments.id,
      orNumber: payments.orNumber,
      orStatus: payments.orStatus,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      referenceNumber: payments.referenceNumber,
      status: payments.status,
      bookletId: payments.bookletId,
    })
    .from(payments)
    .where(eq(payments.assessmentId, assessmentId))
    .orderBy(payments.createdAt);
}

export async function getBooklet(bookletId: string) {
  const rows = await getDb()
    .select({
      id: receiptBooklets.id,
      prefix: receiptBooklets.prefix,
      nextNumber: receiptBooklets.nextNumber,
      endNumber: receiptBooklets.endNumber,
      status: receiptBooklets.status,
    })
    .from(receiptBooklets)
    .where(eq(receiptBooklets.id, bookletId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveBooklets() {
  return getDb()
    .select({
      id: receiptBooklets.id,
      prefix: receiptBooklets.prefix,
      nextNumber: receiptBooklets.nextNumber,
      endNumber: receiptBooklets.endNumber,
      status: receiptBooklets.status,
    })
    .from(receiptBooklets)
    .where(eq(receiptBooklets.status, "active"));
}

export async function getAuditEntries(action: string, targetId: string) {
  return getDb()
    .select({
      id: auditLogs.id,
      actor: auditLogs.actor,
      actorRole: auditLogs.actorRole,
      action: auditLogs.action,
      targetEntity: auditLogs.targetEntity,
      targetId: auditLogs.targetId,
      context: auditLogs.context,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, action), eq(auditLogs.targetId, targetId)));
}

export async function getUserIdByUsername(username: string): Promise<string | null> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0]?.id ?? null;
}
