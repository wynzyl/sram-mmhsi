"use client";

import type { GuardianInput } from "../students.schema";
import { cn } from "@/lib/utils/cn";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
import { formatPhoneInput, stripPhoneFormat } from "@/lib/utils/phone";

interface GuardianFormProps {
  index: number;
  guardian: GuardianInput;
  canRemove: boolean;
  onChange: (index: number, guardian: GuardianInput) => void;
  onRemove: (index: number) => void;
}

export default function GuardianForm({
  index,
  guardian,
  canRemove,
  onChange,
  onRemove,
}: GuardianFormProps) {
  const update = (field: keyof GuardianInput, value: string | boolean) =>
    onChange(index, { ...guardian, [field]: value });

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm",
        "transition-shadow duration-150 hover:shadow-[var(--shadow-md)]"
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <h4 className="font-display text-lg font-bold tracking-tight text-[var(--color-text)]">
          Guardian {index + 1}
          {guardian.isPrimary && (
            <span className="ml-2 inline-flex items-center rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 px-2.5 py-0.5 align-middle font-mono text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              Primary
            </span>
          )}
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {!guardian.isPrimary && (
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-surface-2)]"
              onClick={() => update("isPrimary", true)}
            >
              Set as primary
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/50"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`guardian-${index}-firstName`} className="form-label">
            First name <span className="required">*</span>
          </label>
          <input
            id={`guardian-${index}-firstName`}
            type="text"
            className={editorialFieldClass()}
            value={guardian.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            required
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor={`guardian-${index}-middleName`} className="form-label">
            Middle name
          </label>
          <input
            id={`guardian-${index}-middleName`}
            type="text"
            className={editorialFieldClass()}
            value={guardian.middleName ?? ""}
            onChange={(e) => update("middleName", e.target.value)}
            autoComplete="additional-name"
          />
        </div>
        <div>
          <label htmlFor={`guardian-${index}-lastName`} className="form-label">
            Last name <span className="required">*</span>
          </label>
          <input
            id={`guardian-${index}-lastName`}
            type="text"
            className={editorialFieldClass()}
            value={guardian.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>
        <div>
          <label htmlFor={`guardian-${index}-relationship`} className="form-label">
            Relationship <span className="required">*</span>
          </label>
          <select
            id={`guardian-${index}-relationship`}
            className={editorialFieldClass()}
            value={guardian.relationship}
            onChange={(e) => update("relationship", e.target.value)}
            required
          >
            <option value="">Select relationship</option>
            <option value="Mother">Mother</option>
            <option value="Father">Father</option>
            <option value="Grandmother">Grandmother</option>
            <option value="Grandfather">Grandfather</option>
            <option value="Aunt">Aunt</option>
            <option value="Uncle">Uncle</option>
            <option value="Legal Guardian">Legal Guardian</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`guardian-${index}-address`} className="form-label">
            Address <span className="required">*</span>
          </label>
          <textarea
            id={`guardian-${index}-address`}
            className={editorialFieldClass()}
            rows={2}
            value={guardian.address ?? ""}
            onChange={(e) => update("address", e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor={`guardian-${index}-occupation`} className="form-label">
            Occupation
          </label>
          <input
            id={`guardian-${index}-occupation`}
            type="text"
            className={editorialFieldClass()}
            value={guardian.occupation ?? ""}
            onChange={(e) => update("occupation", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`guardian-${index}-contactNumber`} className="form-label">
            Contact number <span className="required">*</span>
          </label>
          <input
            id={`guardian-${index}-contactNumber`}
            type="tel"
            inputMode="numeric"
            className={editorialFieldClass({ className: "font-mono" })}
            value={formatPhoneInput(guardian.contactNumber ?? "")}
            onChange={(e) => update("contactNumber", stripPhoneFormat(formatPhoneInput(e.target.value)))}
            placeholder="0917-010-0098"
            required
            autoComplete="tel"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`guardian-${index}-email`} className="form-label">
            Email <span className="required">*</span>
          </label>
          <input
            id={`guardian-${index}-email`}
            type="email"
            className={editorialFieldClass()}
            value={guardian.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
            required
            autoComplete="email"
          />
        </div>
      </div>
    </div>
  );
}
