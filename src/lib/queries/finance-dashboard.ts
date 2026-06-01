import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import { assessments, payments } from "@/lib/db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ArAgingBucketKey =
  | "current"
  | "d1_30"
  | "d31_60"
  | "d61_90"
  | "d90_plus";

export type ArAgingBucket = {
  key: ArAgingBucketKey;
  label: string;
  count: number;
  amount: number;
};

export type ArAgingResult = {
  buckets: ArAgingBucket[];
  /** Sum of all outstanding balances (every bucket). */
  totalOutstanding: number;
  /** Sum of overdue balances (all buckets except `current`). */
  totalOverdue: number;
};

export type CollectionMethodBreakdown = {
  method: string;
  label: string;
  amount: number;
};

export type CollectionSummaryResult = {
  todayTotal: number;
  mtdTotal: number;
  byMethod: CollectionMethodBreakdown[];
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const AR_AGING_BUCKETS: { key: ArAgingBucketKey; label: string }[] = [
  { key: "current", label: "Current / Not yet due" },
  { key: "d1_30", label: "1–30 days overdue" },
  { key: "d31_60", label: "31–60 days overdue" },
  { key: "d61_90", label: "61–90 days overdue" },
  { key: "d90_plus", label: "90+ days overdue" },
];

const COLLECTION_METHODS: { method: string; label: string }[] = [
  { method: "cash", label: "Cash" },
  { method: "gcash", label: "GCash" },
  { method: "bank_transfer", label: "Bank Transfer" },
  { method: "check", label: "Check" },
  { method: "other", label: "Other" },
];

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Accounts Receivable aging: outstanding assessment balances for the active
 * school year, bucketed by how long overdue they are.
 *
 * Each assessment is aged by the earliest UNSETTLED invoice due date linked to
 * it (mirrors the overdue logic in getAdminDashboardMetrics). Assessments with
 * no due date — or a due date in the future — are treated as "current".
 *
 * Cached with the shared DASHBOARD tag (invalidated by payment post/void and
 * assessment mutations), revalidated every ~60s.
 */
export async function getArAging(schoolYearId: string): Promise<ArAgingResult> {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  cacheLife("minutes");

  const rows = (await db.execute(sql`
    WITH assessment_due AS (
      SELECT
        a.id,
        a.balance::numeric AS balance,
        (
          SELECT MIN(i.due_date)
          FROM invoices i
          WHERE i.assessment_id = a.id
            AND i.status <> 'settled'
            AND i.due_date IS NOT NULL
        ) AS due_date
      FROM assessments a
      WHERE a.school_year_id = ${schoolYearId}
        AND a.billing_status <> 'cancelled'
        AND a.balance::numeric > 0
        AND a.transferred_at IS NULL
    )
    SELECT
      CASE
        WHEN due_date IS NULL OR due_date >= NOW() THEN 'current'
        WHEN NOW() - due_date <= INTERVAL '30 days' THEN 'd1_30'
        WHEN NOW() - due_date <= INTERVAL '60 days' THEN 'd31_60'
        WHEN NOW() - due_date <= INTERVAL '90 days' THEN 'd61_90'
        ELSE 'd90_plus'
      END AS bucket,
      COUNT(*)::int AS cnt,
      COALESCE(SUM(balance), 0) AS amount
    FROM assessment_due
    GROUP BY bucket
  `)) as unknown as Array<{ bucket: string; cnt: number; amount: string }>;

  const byKey = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    byKey.set(row.bucket, {
      count: toNumber(row.cnt),
      amount: toNumber(row.amount),
    });
  }

  const buckets: ArAgingBucket[] = AR_AGING_BUCKETS.map(({ key, label }) => ({
    key,
    label,
    count: byKey.get(key)?.count ?? 0,
    amount: byKey.get(key)?.amount ?? 0,
  }));

  const totalOutstanding = buckets.reduce((sum, b) => sum + b.amount, 0);
  const totalOverdue = buckets
    .filter((b) => b.key !== "current")
    .reduce((sum, b) => sum + b.amount, 0);

  return { buckets, totalOutstanding, totalOverdue };
}

/**
 * Collection summary for the active school year: posted payments collected
 * today and month-to-date, plus an MTD breakdown by payment method.
 *
 * Only counts genuine payments (`status='posted'`, `kind='payment'`) so
 * balance-forward entries and reversals are excluded.
 */
export async function getCollectionSummary(
  schoolYearId: string
): Promise<CollectionSummaryResult> {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  cacheLife("minutes");

  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const monthStart = new Date(todayStart);
  monthStart.setDate(1);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

  const postedThisSy = and(
    eq(payments.status, "posted"),
    eq(payments.kind, "payment"),
    eq(assessments.schoolYearId, schoolYearId)
  );

  // Note: bind date bounds via the Date-aware `gte`/`lt` operators (they apply
  // the column's driver mapping). Interpolating a JS Date directly into a raw
  // `sql` template passes an unserializable Date to the driver.
  const [mtdRow, todayRow] = await Promise.all([
    db
      .select({
        mtdTotal: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        cash: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        gcash: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'gcash' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        bank_transfer: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'bank_transfer' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        check: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'check' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        other: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} NOT IN ('cash', 'gcash', 'bank_transfer', 'check') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(payments)
      .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
      .where(
        and(
          postedThisSy,
          gte(payments.paymentDate, monthStart),
          lt(payments.paymentDate, nextMonthStart)
        )
      )
      .then((rows) => rows[0]),
    db
      .select({
        total: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .innerJoin(assessments, eq(payments.assessmentId, assessments.id))
      .where(
        and(
          postedThisSy,
          gte(payments.paymentDate, todayStart),
          lt(payments.paymentDate, tomorrowStart)
        )
      )
      .then((rows) => rows[0]),
  ]);

  const byMethod: CollectionMethodBreakdown[] = COLLECTION_METHODS.map(
    ({ method, label }) => ({
      method,
      label,
      amount: toNumber(mtdRow?.[method as keyof typeof mtdRow]),
    })
  );

  return {
    todayTotal: toNumber(todayRow?.total),
    mtdTotal: toNumber(mtdRow?.mtdTotal),
    byMethod,
  };
}
