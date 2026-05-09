import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StudentEditHeroProps = {
  backHref: string;
  backLabel: string;
  /** Profile URL (same as cancel target). */
  viewProfileHref: string;
  fullName: string;
  initials: string;
  referenceNumber: string;
  isActive: boolean;
};

/**
 * Hero chrome for student edit — matches profile header gradient and avatar pattern.
 */
export function StudentEditHero({
  backHref,
  backLabel,
  viewProfileHref,
  fullName,
  initials,
  referenceNumber,
  isActive,
}: StudentEditHeroProps) {
  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 font-mono text-sm text-[var(--color-text-muted) transition-colors hover:text-[var(--color-text) print:hidden"
      >
        ← {backLabel}
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated) shadow-[var(--shadow-md)] print:shadow-none">
        <div
          className="h-28 bg-linear-to-br from-(--color-primary) via-(--color-primary-700) to-(--color-surface-2) sm:h-32 print:h-16 print:bg-[var(--color-surface-3)"
          aria-hidden
        />
        <div className="relative px-4 pb-4 pt-0 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div
                className="-mt-12 flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-[var(--color-surface-elevated)] bg-[var(--color-surface-2)] font-display text-3xl font-bold tracking-tight text-[var(--color-text)] shadow-md sm:-mt-14 sm:h-32 sm:w-32 print:border-[var(--color-border)]"
                aria-hidden
              >
                {initials || "—"}
              </div>
              <div className="min-w-0 space-y-2 pb-1 sm:pb-3">
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)">
                  Edit student
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-text) sm:text-3xl md:text-4xl">
                    {fullName}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-[var(--color-border)] bg-[var(--color-surface-2) text-[var(--color-text-muted)"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-muted) sm:text-base">
                  <span className="font-mono text-[var(--color-text)">{referenceNumber}</span>
                  <span className="mx-2 text-[var(--color-border-2)]">·</span>
                  Update personal information and guardian details
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1 md:pb-3 print:hidden">
              <Link
                href={viewProfileHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]"
              >
                <Eye className="h-4 w-4" aria-hidden />
                View profile
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
