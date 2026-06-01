import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import type { CollectionSummaryResult } from "@/lib/queries/finance-dashboard";

/** Distinct (brand-consistent) colors for the by-method segments. */
const METHOD_BAR_COLOR: Record<string, string> = {
  cash: "bg-success",
  gcash: "bg-primary",
  bank_transfer: "bg-primary/70",
  check: "bg-primary/45",
  other: "bg-muted-foreground/40",
};

interface CollectionSummaryCardProps {
  data: CollectionSummaryResult;
}

/**
 * Collection summary — payments collected today vs month-to-date, with an MTD
 * breakdown by payment method.
 */
export function CollectionSummaryCard({ data }: CollectionSummaryCardProps) {
  const { todayTotal, mtdTotal, byMethod } = data;
  const activeMethods = byMethod.filter((m) => m.amount > 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">
        Collection Summary
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Collected Today
          </p>
          <CurrencyDisplay
            amount={todayTotal}
            className="mt-1 block font-display text-xl font-bold text-foreground"
          />
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Collected (MTD)
          </p>
          <CurrencyDisplay
            amount={mtdTotal}
            className="mt-1 block font-display text-xl font-bold text-foreground"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          By method (month-to-date)
        </p>

        {mtdTotal === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No payments collected this month.
          </p>
        ) : (
          <>
            <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {activeMethods.map((m) => (
                <div
                  key={m.method}
                  className={METHOD_BAR_COLOR[m.method] ?? "bg-muted-foreground/40"}
                  style={{ width: `${(m.amount / mtdTotal) * 100}%` }}
                  title={`${m.label}: ${((m.amount / mtdTotal) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-1.5">
              {activeMethods.map((m) => (
                <li
                  key={m.method}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className={`h-2.5 w-2.5 rounded-sm ${METHOD_BAR_COLOR[m.method] ?? "bg-muted-foreground/40"}`}
                    />
                    {m.label}
                  </span>
                  <CurrencyDisplay
                    amount={m.amount}
                    className="font-medium text-foreground"
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
