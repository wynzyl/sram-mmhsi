import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface PortalPageProps {
  title: string;
  description?: string;
  /** Small contextual chips rendered under the title, e.g. school year. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Page shell for every /portal route.
 *
 * Owns the page landmark, width, padding and vertical rhythm, so individual
 * portal pages never hand-roll a wrapper. Intentionally does NOT use the
 * shared PageContainer: that component is tuned for wide staff directories,
 * while portal content is a single student's records.
 */
export function PortalPage({
  title,
  description,
  meta,
  actions,
  className,
  children,
}: PortalPageProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-5xl space-y-6 px-4 py-4 sm:px-6 sm:py-6",
        className
      )}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-serif text-2xl font-bold italic tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-[65ch] text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {meta ? (
          <div className="flex flex-wrap items-center gap-2">{meta}</div>
        ) : null}
      </header>

      {children}
    </main>
  );
}
