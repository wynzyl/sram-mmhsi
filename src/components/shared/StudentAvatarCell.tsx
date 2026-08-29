/**
 * Reusable student avatar + name cell component for table rows.
 *
 * Consolidates the common pattern of displaying:
 * - Avatar circle with initials
 * - Student name (truncatable)
 * - Optional reference code
 */

import { getInitials } from "@/lib/utils/name";
import { ReferenceCode } from "./ReferenceCode";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AvatarSize = "sm" | "md" | "lg";

interface StudentAvatarCellProps {
  /** Student's full name */
  name: string;
  /** Optional student reference number */
  referenceNumber?: string | null;
  /** Avatar size variant. Defaults to "md" */
  size?: AvatarSize;
  /** Whether to truncate the name. Defaults to true */
  truncate?: boolean;
  /** Optional badge to display after the name (e.g., SpedBadge) */
  badge?: React.ReactNode;
}

// ─── Size Configurations ───────────────────────────────────────────────────────

const AVATAR_SIZES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const NAME_SIZES: Record<AvatarSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Displays a student's avatar (initials circle), name, and optional reference code.
 *
 * This component is designed for use in table cells where student information
 * needs to be displayed consistently across the application.
 *
 * @example
 * ```tsx
 * <StudentAvatarCell
 *   name="Juan Dela Cruz"
 *   referenceNumber="0000001"
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Without reference, larger size
 * <StudentAvatarCell
 *   name="Maria Santos"
 *   size="lg"
 * />
 * ```
 */
export function StudentAvatarCell({
  name,
  referenceNumber,
  size = "md",
  truncate = true,
  badge,
}: StudentAvatarCellProps) {
  const avatarClass = AVATAR_SIZES[size];
  const nameClass = NAME_SIZES[size];

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary ${avatarClass}`}
        aria-hidden
      >
        {getInitials(name)}
      </div>
      <div className="min-w-0">
        <p
          className={`flex items-center font-semibold text-foreground ${nameClass} ${truncate ? "truncate" : ""}`}
        >
          {name}
          {badge}
        </p>
        {referenceNumber && (
          <div className="mt-0.5">
            <ReferenceCode code={referenceNumber} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Displays just the avatar circle with initials.
 *
 * Useful when name is displayed separately or space is limited.
 */
export function StudentAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: AvatarSize;
}) {
  const avatarClass = AVATAR_SIZES[size];

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary ${avatarClass}`}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}
