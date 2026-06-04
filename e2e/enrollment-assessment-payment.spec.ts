/**
 * Phase 11 E2E — Enrollment → Assessment → Payment (Casa levels only).
 *
 * Roles simulated:
 *  - Registrar (`e2e_registrar`): confirms enrollment, posts payments (has payments:post)
 *  - Finance Officer (`e2e_finance`): creates the fee assessment
 *
 * Test data: synthetic Junior Casa + Senior Casa students provisioned by
 * `e2e/ensure-test-data.ts` (global setup). Every UI step is verified against
 * the database (status transitions, OR consumption, audit log entries).
 */
import { test, expect, type Page } from "@playwright/test";
import { e2eRegistrar, e2eFinance } from "./credentials";
import {
  login,
  logout,
  readTestDataState,
  closeDb,
  getEnrollmentForStudent,
  getAssessmentForEnrollment,
  getAssessmentItems,
  getPaymentsForAssessment,
  getBooklet,
  getAuditEntries,
  getUserIdByUsername,
} from "./helpers";
import { formatStoredOrNumber } from "../src/lib/utils/or-number";
import type { E2eTestDataState, E2eCasaStudent } from "./ensure-test-data";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let state: E2eTestDataState;

test.beforeAll(() => {
  state = readTestDataState();
});

test.afterAll(async () => {
  await closeDb();
});

// ─── Shared flow helpers ───────────────────────────────────────────────────────

/** Registrar: locate the synthetic student in the Ready-to-Enroll queue and confirm enrollment. */
async function registrarEnrolls(page: Page, student: E2eCasaStudent) {
  await login(page, e2eRegistrar);

  // pageSize=100 keeps every ready student on one page (search filters client-side only).
  await page.goto(
    `/staff/enrollments?tab=ready-to-enroll&pageSize=100&search=${encodeURIComponent(student.lastName)}`
  );

  // Both synthetic students share the same lastName — match "Last, First" to stay unique.
  const fullName = `${student.lastName}, ${student.firstName}`;
  const row = page.getByRole("row", { name: new RegExp(fullName, "i") });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText(student.gradeLevelName);
  await row.getByRole("button", { name: /^Enroll$/ }).click();

  // Confirmation drawer
  await expect(page.getByText("Enrollment Confirmation", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Enrollment" }).click();

  await expect(page.getByText("Enrollment confirmed successfully")).toBeVisible({
    timeout: 20_000,
  });

  // DB evidence: enrollment row is pending + audit entry written by the registrar.
  await expect
    .poll(
      async () =>
        (await getEnrollmentForStudent(student.studentId, state.schoolYearId)) !== null,
      { timeout: 15_000 }
    )
    .toBe(true);
  const enrollment = await getEnrollmentForStudent(student.studentId, state.schoolYearId);

  expect(enrollment!.status).toBe("pending");
  expect(enrollment!.registrationId).toBe(student.registrationId);
  expect(enrollment!.gradeLevelId).toBe(student.gradeLevelId);

  const audits = await getAuditEntries("enrollment_confirmed", enrollment!.id);
  expect(audits.length).toBeGreaterThanOrEqual(1);
  const registrarId = await getUserIdByUsername(e2eRegistrar.username);
  expect(audits[0].actor).toBe(registrarId);
  expect(audits[0].actorRole).toBe("registrar");

  await logout(page);
  return enrollment!;
}

/** Finance officer: open the draft assessment for the enrollment and save it. */
async function financeAssesses(page: Page, student: E2eCasaStudent, enrollmentId: string) {
  await login(page, e2eFinance);

  await page.goto(`/staff/assessments/new/${enrollmentId}`);
  await expect(
    page.getByRole("heading", { name: `${student.lastName}, ${student.firstName}` })
  ).toBeVisible({ timeout: 20_000 });

  // Casa fee catalog must render at least one charge line.
  const chargesTable = page.locator("table", { hasText: "Description" });
  await expect(chargesTable.locator("tbody tr").first()).toBeVisible();

  const saveButton = page.getByRole("button", { name: "Save assessment" });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Hydrated path: success toast + client redirect to the assessment ledger.
  // Pre-hydration path (progressive enhancement): full-page POST that runs the
  // same server action, then redirects to the assessments index. Either way the
  // database is the source of truth — poll it for the assessed transition.
  await expect
    .poll(
      async () =>
        (await getEnrollmentForStudent(student.studentId, state.schoolYearId))?.status,
      { timeout: 30_000 }
    )
    .toBe("assessed");

  // DB evidence: enrollment → assessed, assessment outstanding with copied items.
  const enrollment = await getEnrollmentForStudent(student.studentId, state.schoolYearId);
  expect(enrollment!.status).toBe("assessed");

  const assessment = await getAssessmentForEnrollment(enrollmentId);
  expect(assessment).not.toBeNull();
  expect(assessment!.billingStatus).toBe("outstanding");
  expect(Number(assessment!.totalPaid)).toBe(0);
  expect(Number(assessment!.balance)).toBeGreaterThan(0);
  expect(Number(assessment!.balance)).toBe(
    Number(assessment!.totalAmount) // no discounts on synthetic students
  );

  const items = await getAssessmentItems(assessment!.id);
  expect(items.length).toBeGreaterThanOrEqual(1);

  const audits = await getAuditEntries("assessment_created_and_enrollment_assessed", assessment!.id);
  expect(audits.length).toBeGreaterThanOrEqual(1);
  expect(audits[0].actorRole).toBe("finance_officer");

  await logout(page);
  return assessment!;
}

/** Registrar: post a payment on the assessment via the cashier processing form. */
async function registrarPostsPayment(
  page: Page,
  assessmentId: string,
  opts: {
    amount?: number; // defaults to the prefilled full balance
    method: "cash" | "gcash";
    referenceNumber?: string;
  }
) {
  await login(page, e2eRegistrar);
  await page.goto(`/staff/payments/process/${assessmentId}`);

  // Scope to the payment-processing dialog: a transient duplicate of the form
  // was observed once in the production build (orphaned hydration copy outside
  // the dialog), which breaks unscoped strict-mode locators.
  const dialog = page.getByRole("dialog").filter({ hasText: "Payment details" }).first();
  const bookletSelect = dialog.locator('select[name="bookletId"]');
  await expect(bookletSelect).toBeVisible({ timeout: 20_000 });

  // Always pay from the dedicated E2E (ZZ) booklet — never consume real OR series.
  const booklet = (await getBooklet(state.bookletId))!;
  expect(booklet).not.toBeNull();
  expect(booklet.status).toBe("active");
  await bookletSelect.selectOption(booklet.id);
  const expectedOrNumber = formatStoredOrNumber(booklet.prefix, booklet.nextNumber);

  // Hydration gate: the cash-only "Amount tendered" section is swapped by React
  // state. Re-select until the toggle takes effect, proving the form is
  // interactive before we drive it (a pre-hydration submit would fall back to a
  // full-page POST and skip the client success panel).
  const methodSelect = dialog.locator('select[name="paymentMethod"]');
  const amountTendered = dialog.locator('input[name="amountTendered"]');
  await expect(async () => {
    await methodSelect.selectOption("gcash");
    await expect(amountTendered).toBeHidden({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  if (opts.amount !== undefined) {
    await dialog.locator('input[name="amount"]').fill(opts.amount.toFixed(2));
  }
  const amountValue = await dialog.locator('input[name="amount"]').inputValue();

  await methodSelect.selectOption(opts.method);
  if (opts.method === "cash") {
    await expect(amountTendered).toBeVisible();
    await amountTendered.fill(amountValue);
  }
  if (opts.referenceNumber) {
    await dialog.locator('input[name="referenceNumber"]').fill(opts.referenceNumber);
  }

  const paymentsBefore = (await getPaymentsForAssessment(assessmentId)).length;

  await dialog.getByRole("button", { name: "Post payment & print OR" }).click();

  // The database is authoritative for the post. The client "Payment posted"
  // panel normally renders, but an intermittent prod-build artifact (report
  // finding F7) can leave the UI on a stale form even though the server action
  // committed — so poll for the new payment row instead of requiring the panel.
  await expect
    .poll(async () => (await getPaymentsForAssessment(assessmentId)).length, {
      timeout: 30_000,
    })
    .toBe(paymentsBefore + 1);

  // DB evidence: posted payment consumed the expected OR and advanced the booklet.
  const allPayments = await getPaymentsForAssessment(assessmentId);
  const payment = allPayments[allPayments.length - 1];
  expect(payment.status).toBe("posted");
  expect(payment.orStatus).toBe("consumed");
  expect(payment.orNumber).toBe(expectedOrNumber);
  expect(payment.paymentMethod).toBe(opts.method);
  expect(Number(payment.amount)).toBeCloseTo(Number(amountValue), 2);
  if (opts.referenceNumber) {
    expect(payment.referenceNumber).toBe(opts.referenceNumber);
  }

  const bookletAfter = await getBooklet(booklet.id);
  expect(bookletAfter!.nextNumber).toBe(booklet.nextNumber + 1);

  const audits = await getAuditEntries("payment_posted", payment.id);
  expect(audits.length).toBeGreaterThanOrEqual(1);
  expect(audits[0].actorRole).toBe("registrar");
  expect(audits[0].context).toBe(`OR: ${expectedOrNumber}`);

  await logout(page);
  return { payment, expectedOrNumber };
}

// ─── Scenario A — Junior Casa: full payment happy path ─────────────────────────

test.describe("Scenario A — Junior Casa: enroll → assess → full cash payment", () => {
  let enrollmentId: string;
  let assessmentId: string;

  test("registrar confirms enrollment from the Ready-to-Enroll queue", async ({ page }) => {
    const enrollment = await registrarEnrolls(page, state.juniorCasa);
    enrollmentId = enrollment.id;
  });

  test("finance officer creates the casa fee assessment", async ({ page }) => {
    const assessment = await financeAssesses(page, state.juniorCasa, enrollmentId);
    assessmentId = assessment.id;
  });

  test("registrar posts a full cash payment consuming the next OR", async ({ page }) => {
    await registrarPostsPayment(page, assessmentId, { method: "cash" });

    // Full payment settles the ledger and finalizes the enrollment.
    const assessment = await getAssessmentForEnrollment(enrollmentId);
    expect(assessment!.billingStatus).toBe("fully_paid");
    expect(Number(assessment!.balance)).toBe(0);

    const enrollment = await getEnrollmentForStudent(
      state.juniorCasa.studentId,
      state.schoolYearId
    );
    expect(enrollment!.status).toBe("enrolled");
    expect(enrollment!.enrolledAt).not.toBeNull();

    const transitionAudits = await getAuditEntries(
      "enrollment_enrolled_via_payment",
      enrollmentId
    );
    expect(transitionAudits.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Scenario B — Senior Casa: partial + completing GCash payment ──────────────

test.describe("Scenario B — Senior Casa: enroll → assess → partial cash → completing GCash", () => {
  let enrollmentId: string;
  let assessmentId: string;
  let totalAmount: number;

  test("registrar confirms enrollment for the Senior Casa student", async ({ page }) => {
    const enrollment = await registrarEnrolls(page, state.seniorCasa);
    enrollmentId = enrollment.id;
  });

  test("finance officer creates the assessment", async ({ page }) => {
    const assessment = await financeAssesses(page, state.seniorCasa, enrollmentId);
    assessmentId = assessment.id;
    totalAmount = Number(assessment.totalAmount);
  });

  test("registrar posts a partial cash payment — ledger stays outstanding", async ({ page }) => {
    const half = Math.floor(totalAmount / 2);
    await registrarPostsPayment(page, assessmentId, { method: "cash", amount: half });

    const assessment = await getAssessmentForEnrollment(enrollmentId);
    expect(assessment!.billingStatus).toBe("outstanding");
    expect(Number(assessment!.totalPaid)).toBeCloseTo(half, 2);
    expect(Number(assessment!.balance)).toBeCloseTo(totalAmount - half, 2);

    // Business rule: FIRST payment (even partial) flips the enrollment to "enrolled".
    const enrollment = await getEnrollmentForStudent(
      state.seniorCasa.studentId,
      state.schoolYearId
    );
    expect(enrollment!.status).toBe("enrolled");
  });

  test("registrar settles the balance via GCash with a unique reference", async ({ page }) => {
    const reference = `E2E-GCASH-${state.runId}`;
    const { payment } = await registrarPostsPayment(page, assessmentId, {
      method: "gcash",
      referenceNumber: reference,
    });
    expect(payment.referenceNumber).toBe(reference);

    const assessment = await getAssessmentForEnrollment(enrollmentId);
    expect(assessment!.billingStatus).toBe("fully_paid");
    expect(Number(assessment!.balance)).toBe(0);

    // Both ORs must be sequential and unique.
    const allPayments = await getPaymentsForAssessment(assessmentId);
    expect(allPayments).toHaveLength(2);
    const orNumbers = allPayments.map((p) => p.orNumber);
    expect(new Set(orNumbers).size).toBe(2);
  });
});

// ─── Scenario C — RBAC boundaries ──────────────────────────────────────────────

test.describe("Scenario C — RBAC boundaries", () => {
  test("finance officer cannot open the enrollment queue", async ({ page }) => {
    await login(page, e2eFinance);
    await page.goto("/staff/enrollments");
    // Page guard redirects away (finance has no enrollments:read).
    await expect(page).not.toHaveURL(/\/staff\/enrollments/, { timeout: 20_000 });
    await logout(page);
  });

  test("finance officer cannot open the payment processing form", async ({ page }) => {
    // Reuse the settled Junior Casa assessment id from the DB.
    const enrollment = await getEnrollmentForStudent(
      state.juniorCasa.studentId,
      state.schoolYearId
    );
    const assessment = await getAssessmentForEnrollment(enrollment!.id);

    await login(page, e2eFinance);
    await page.goto(`/staff/payments/process/${assessment!.id}`);
    await expect(page.getByRole("button", { name: "Post payment & print OR" })).toHaveCount(0);
    await logout(page);
  });

  test("registrar cannot open OR booklet creation", async ({ page }) => {
    await login(page, e2eRegistrar);
    await page.goto("/staff/finance/booklets/new");
    await expect(page).not.toHaveURL(/\/staff\/finance\/booklets\/new/, { timeout: 20_000 });
    await logout(page);
  });
});
