import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import { assessments, payments } from "@/lib/db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ArAgingBucketKey = "d1_30" | "d31_60" | "d61_90" | "d90_plus";

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
  { key: "d1_30", label: "1–30 days" },
  { key: "d31_60", label: "31–60 days" },
  { key: "d61_90", label: "61–90 days" },
  { key: "d90_plus", label: "90+ days" },
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
 * school year, bucketed by days since last payment.
 *
 * Only includes enrolled students. Aging is computed from the most recent
 * posted payment date. Assessments with no payments are excluded (they haven't
 * started paying yet, so no aging applies).
 *
 * Cached with the shared DASHBOARD tag (invalidated by payment post/void and
 * assessment mutations), revalidated every ~60s.
 */
export async function getArAging(schoolYearId: string): Promise<ArAgingResult> {
  "use cache";
  cacheTag(CACHE_TAGS.DASHBOARD);
  cacheLife("minutes");

  const rows = (await db.execute(sql`
    WITH assessment_aging AS (
      SELECT
        a.id,
        a.balance::numeric AS balance,
        (
          SELECT MAX(p.payment_date)
          FROM payments p
          WHERE p.assessment_id = a.id
            AND p.status = 'posted'
        ) AS last_payment_date
      FROM assessments a
      JOIN enrollments e ON a.enrollment_id = e.id
      WHERE a.school_year_id = ${schoolYearId}
        AND e.status = 'enrolled'
        AND a.billing_status = 'outstanding'
        AND a.balance::numeric > 0
        AND a.transferred_at IS NULL
    )
    SELECT
      CASE
        WHEN NOW() - last_payment_date <= INTERVAL '30 days' THEN 'd1_30'
        WHEN NOW() - last_payment_date <= INTERVAL '60 days' THEN 'd31_60'
        WHEN NOW() - last_payment_date <= INTERVAL '90 days' THEN 'd61_90'
        ELSE 'd90_plus'
      END AS bucket,
      COUNT(*)::int AS cnt,
      COALESCE(SUM(balance), 0) AS amount
    FROM assessment_aging
    WHERE last_payment_date IS NOT NULL
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

  return { buckets, totalOutstanding };
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
