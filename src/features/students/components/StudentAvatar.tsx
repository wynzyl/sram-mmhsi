import Image from "next/image";
import { cn } from "@/lib/utils/cn";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AvatarSize = "sm" | "md" | "lg";

export type StudentAvatarProps = {
  /** URL path to student photo (e.g., /uploads/students/0000001.webp) */
  photoUrl: string | null;
  /** Initials to display when no photo exists */
  initials: string;
  /** Avatar size: sm (48px), md (112px), lg (128px) */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
};

// ─── Size Mappings ─────────────────────────────────────────────────────────────

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-12 w-12 text-base",
  md: "h-28 w-28 text-3xl",
  lg: "h-32 w-32 text-4xl",
};

const SIZE_PIXELS: Record<AvatarSize, number> = {
  sm: 48,
  md: 112,
  lg: 128,
};

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Display-only avatar component for student profile photos.
 *
 * Shows the student's photo if available, otherwise displays styled initials.
 * For interactive upload functionality, use StudentPhotoUpload instead.
 */
export function StudentAvatar({
  photoUrl,
  initials,
  size = "md",
  className,
}: StudentAvatarProps) {
  const sizeClasses = SIZE_CLASSES[size];
  const pixels = SIZE_PIXELS[size];

  const baseClasses = cn(
    "shrink-0 rounded-2xl border-4 border-card shadow-md overflow-hidden",
    "flex items-center justify-center",
    "bg-muted font-display font-bold tracking-tight text-foreground",
    sizeClasses,
    className
  );

  if (photoUrl) {
    return (
      <div className={baseClasses}>
        <Image
          src={photoUrl}
          alt="Student photo"
          width={pixels}
          height={pixels}
          className="h-full w-full object-cover"
          priority={size !== "sm"}
          // Runtime-uploaded photos must bypass Next.js Image Optimization
          // (optimization only works for images present at build time)
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className={baseClasses} aria-hidden>
      {initials || "—"}
    </div>
  );
}
