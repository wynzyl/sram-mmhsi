import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { StudentPhotoUpload } from "./StudentPhotoUpload";

export type StudentEditHeroProps = {
  backHref: string;
  backLabel: string;
  /** Profile URL (same as cancel target). */
  viewProfileHref: string;
  fullName: string;
  initials: string;
  referenceNumber: string;
  isActive: boolean;
  /** Student ID for photo upload API */
  studentId: string;
  /** Current photo URL or null */
  photoUrl: string | null;
  /** Whether the user can edit photos (has students:update permission) */
  canEditPhoto: boolean;
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
  studentId,
  photoUrl,
  canEditPhoto,
}: StudentEditHeroProps) {
  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        ← {backLabel}
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-md print:shadow-none">
        <div
          className="h-28 bg-gradient-to-br from-primary via-primary/80 to-muted sm:h-32 print:h-16 print:bg-gray-200"
          aria-hidden
        />
        <div className="relative px-4 pb-4 pt-0 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <StudentPhotoUpload
                studentId={studentId}
                referenceNumber={referenceNumber}
                currentPhotoUrl={photoUrl}
                initials={initials}
                canEdit={canEditPhoto}
              />
              <div className="min-w-0 space-y-2 pb-1 sm:pb-3">
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Edit student
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                    {fullName}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground sm:text-base">
                  <span className="font-mono text-foreground">{referenceNumber}</span>
                  <span className="mx-2 text-gray-300 dark:text-gray-700">·</span>
                  Update personal information and guardian details
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1 md:pb-3 print:hidden">
              <Link
                href={viewProfileHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
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
