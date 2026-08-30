"use client";

import { cn } from "@/lib/utils/cn";
import { formatPhoneNumber, stripPhoneFormat } from "@/lib/utils/phone";
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Kept for API compatibility
  compact: _compact = false,
}: GuardianCardProps) {
  const fullName = [guardian.firstName, guardian.middleName, guardian.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        "transition-all duration-150",
        onEdit && "hover:border-border hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Primary indicator */}
          {guardian.isPrimary && (
            <div className="flex items-center gap-1.5 text-warning mb-2">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-xs font-mono font-medium uppercase tracking-wide">
                Primary Guardian
              </span>
            </div>
          )}

          {/* Name */}
          <h3 className="truncate font-display text-lg font-semibold text-foreground">
            {fullName}
          </h3>

          {/* Relationship & Occupation */}
          {/* Contact Information - 3 columns x 2 rows */}
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
              <p className="truncate text-foreground">{guardian.address?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tel Number</p>
              {guardian.contactNumber?.trim() ? (
                <a
                  href={`tel:${stripPhoneFormat(guardian.contactNumber)}`}
                  className="font-mono text-foreground transition-colors hover:text-primary"
                >
                  {formatPhoneNumber(guardian.contactNumber)}
                </a>
              ) : (
                <p className="text-foreground">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</p>
              {guardian.email?.trim() ? (
                <a
                  href={`mailto:${guardian.email}`}
                  className="block truncate text-foreground transition-colors hover:text-primary"
                >
                  {guardian.email}
                </a>
              ) : (
                <p className="text-foreground">—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Occupation</p>
              <p className="truncate text-foreground">{guardian.occupation?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationship</p>
              <p className="truncate capitalize text-foreground">{guardian.relationship || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primary</p>
              <p className="text-foreground">{guardian.isPrimary ? "Yes" : "No"}</p>
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
                className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(guardian.id)}
                className="rounded px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive"
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
