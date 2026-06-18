import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import type { ArAgingBucketKey, ArAgingResult } from "@/lib/queries/finance-dashboard";

/**
 * AR aging severity scale: escalates through deep-red as buckets age —
 * keeps the brand palette, signals risk.
 */
const BUCKET_BAR_COLOR: Record<ArAgingBucketKey, string> = {
  d1_30: "bg-primary/40",
  d31_60: "bg-primary/60",
  d61_90: "bg-primary/80",
  d90_plus: "bg-primary",
};

interface ArAgingCardProps {
  data: ArAgingResult;
}

/**
 * Accounts Receivable aging breakdown — outstanding balances bucketed by days
 * since last payment, rendered as labelled horizontal bars.
 */
export function ArAgingCard({ data }: ArAgingCardProps) {
  const { buckets, totalOutstanding } = data;
  const maxAmount = Math.max(...buckets.map((b) => b.amount), 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">
          AR Aging (Outstanding A/R)
        </h2>
        <CurrencyDisplay
          amount={totalOutstanding}
          className="font-display text-lg font-bold text-foreground"
        />
      </div>

      {totalOutstanding === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No outstanding receivables for this school year.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {buckets.map((bucket) => {
              const widthPct =
                maxAmount > 0 ? (bucket.amount / maxAmount) * 100 : 0;
              return (
                <div key={bucket.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{bucket.label}</span>
                    <span className="flex items-baseline gap-2">
                      <CurrencyDisplay
                        amount={bucket.amount}
                        className="font-medium text-foreground"
                      />
                      <span className="tabular-nums text-muted-foreground">
                        ({bucket.count})
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${BUCKET_BAR_COLOR[bucket.key]}`}
                      style={{ width: `${Math.max(widthPct, bucket.amount > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
