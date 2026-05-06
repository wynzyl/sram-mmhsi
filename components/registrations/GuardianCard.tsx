"use client";

import { cn } from "@/lib/utils/cn";
import { Mail, Phone, Star } from "lucide-react";

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
  compact = false,
}: GuardianCardProps) {
  const fullName = [guardian.firstName, guardian.middleName, guardian.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 p-4",
        "transition-all duration-150",
        onEdit && "hover:border-gray-300 hover:shadow-md",
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
          <h3 className="font-display font-semibold text-lg text-charcoal truncate">
            {fullName}
          </h3>

          {/* Relationship & Occupation */}
          <div className="flex items-center gap-2 text-sm text-warm-gray mt-1">
            <span className="capitalize">{guardian.relationship}</span>
            {guardian.occupation && (
              <>
                <span className="text-gray-300">•</span>
                <span>{guardian.occupation}</span>
              </>
            )}
          </div>

          {!compact && guardian.address?.trim() ? (
            <p className="mt-2 text-sm text-warm-gray">{guardian.address}</p>
          ) : null}

          {!compact && (
            <>
              {/* Contact Information */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-warm-gray shrink-0" />
                  <a
                    href={`tel:${guardian.contactNumber}`}
                    className="font-mono text-charcoal hover:text-[var(--color-primary)] transition-colors"
                  >
                    {guardian.contactNumber}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-warm-gray shrink-0" />
                  <a
                    href={`mailto:${guardian.email}`}
                    className="text-charcoal hover:text-[var(--color-primary)] transition-colors truncate"
                  >
                    {guardian.email}
                  </a>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {(onEdit || onRemove) && (
          <div className="flex flex-col gap-1.5 shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(guardian.id)}
                className="text-xs text-warm-gray hover:text-charcoal transition-colors px-2 py-1 rounded hover:bg-gray-50"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(guardian.id)}
                className="text-xs text-red-600 hover:text-red-700 transition-colors px-2 py-1 rounded hover:bg-red-50"
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
