"use client";

import { cn } from "@/lib/utils/cn";
import { Star } from "lucide-react";

interface Guardian {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  relationship: string;
  contactNumber: string;
  email: string;
  occupation?: string | null;
  address?: string | null;
  isPrimary?: boolean;
}

interface GuardianCardProps {
  guardian: Guardian;
  onEdit?: (guardianId: string) => void;
  onRemove?: (guardianId: string) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Guardian information card with primary indicator.
 * Displays contact details with formatted phone/email and inline actions.
 * Part of the Editorial Design System for SRAMS.
 */
export function GuardianCard({
  guardian,
  onEdit,
  onRemove,
  className,
  compact: _compact = false,
}: GuardianCardProps) {
  const fullName = [guardian.firstName, guardian.middleName, guardian.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "rounded-lg border border-(--color-border) bg-(--color-surface-elevated) p-4",
        "transition-all duration-150",
        onEdit && "hover:border-(--color-border-2) hover:shadow-(--shadow-md)",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Primary indicator */}
          {guardian.isPrimary && (
            <div className="flex items-center gap-1.5 text-accent-amber mb-2">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-xs font-mono font-medium uppercase tracking-wide">
                Primary Guardian
              </span>
            </div>
          )}

          {/* Name */}
          <h3 className="truncate font-display text-lg font-semibold text-(--color-text)">
            {fullName}
          </h3>

          {/* Relationship & Occupation */}
          {/* Contact Information - 3 columns x 2 rows */}
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Address</p>
              <p className="truncate text-(--color-text)">{guardian.address?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Tel Number</p>
              {guardian.contactNumber?.trim() ? (
                <a
                  href={`tel:${guardian.contactNumber}`}
                  className="font-mono text-(--color-text) transition-colors hover:text-(--color-primary)"
                >
                  {guardian.contactNumber}
                </a>
              ) : (
                <p className="text-(--color-text)">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Email</p>
              {guardian.email?.trim() ? (
                <a
                  href={`mailto:${guardian.email}`}
                  className="block truncate text-(--color-text) transition-colors hover:text-(--color-primary)"
                >
                  {guardian.email}
                </a>
              ) : (
                <p className="text-(--color-text)">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Occupation</p>
              <p className="truncate text-(--color-text)">{guardian.occupation?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Relationship</p>
              <p className="truncate capitalize text-(--color-text)">{guardian.relationship || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Primary</p>
              <p className="text-(--color-text)">{guardian.isPrimary ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {(onEdit || onRemove) && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(guardian.id)}
                className="rounded px-2 py-1 text-xs text-(--color-text-muted) transition-colors hover:bg-(--color-surface-2) hover:text-(--color-text)"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(guardian.id)}
                className="rounded px-2 py-1 text-xs text-(--color-error) transition-colors hover:bg-[color-mix(in_srgb,var(--color-error)_12%,transparent)] hover:text-(--color-error)"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
