import Link from "next/link";

export type BackLinkProps = {
  /** The URL to navigate to */
  href: string;
  /** The label text (without the arrow) */
  label?: string;
  /** Additional CSS classes */
  className?: string;
};

/**
 * Back navigation link with consistent styling.
 * Extracted for reusability (audit 2026-07).
 *
 * @example
 * <BackLink href="/staff/students" label="Back to Students" />
 * <BackLink href="/staff/enrollments" /> // Uses default "Back" label
 */
export function BackLink({
  href,
  label = "Back",
  className = "",
}: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden ${className}`.trim()}
    >
      ← {label}
    </Link>
  );
}
