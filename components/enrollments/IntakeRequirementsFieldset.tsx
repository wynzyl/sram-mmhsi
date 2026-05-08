"use client";

import type { ReactNode } from "react";
import type { IntakePreserved } from "@/lib/utils/intake-documents";
import type { IntakeDocumentStatus } from "@/lib/validators/intake-documents";
import { cn } from "@/lib/utils/cn";

export type IntakeRequirementErrorKey =
  | "intakeForm138"
  | "intakeBirthCertificatePsa"
  | "intakeGoodMoralCharacter"
  | "intakeQualifiedVoucher"
  | "intakeEscCertificate";

type FieldErrors = Partial<Record<IntakeRequirementErrorKey, string[] | undefined>>;

export type { IntakePreserved };

interface IntakeRequirementsFieldsetProps {
  errors?: FieldErrors;
  /** Legend text (default matches enrollment copy). */
  legend?: string;
  /** Intro paragraph below legend. */
  description?: ReactNode;
  /** Restore checklist/radio state after a failed submission (defaultChecked). */
  preserved?: IntakePreserved;
}

function TriRadios({
  name,
  preserved,
}: {
  name: IntakeRequirementErrorKey;
  preserved?: IntakeDocumentStatus | "";
}) {
  const v = preserved === "" ? undefined : preserved;
  const optionClass =
    "flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-[var(--color-text-2) transition-colors hover:bg-[var(--color-surface-3)";
  const inputClass =
    "h-4 w-4 shrink-0 border-[var(--color-border-2)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/25";

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 pl-0.5">
      <label className={optionClass}>
        <input
          type="radio"
          name={name}
          value="received"
          required
          defaultChecked={v === "received"}
          className={inputClass}
        />
        <span>Received</span>
      </label>
      <label className={optionClass}>
        <input
          type="radio"
          name={name}
          value="not_applicable"
          defaultChecked={v === "not_applicable"}
          className={inputClass}
        />
        <span>Not applicable</span>
      </label>
      <label className={optionClass}>
        <input
          type="radio"
          name={name}
          value="to_follow"
          defaultChecked={v === "to_follow"}
          className={inputClass}
        />
        <span>To follow</span>
      </label>
    </div>
  );
}

function DocumentRequirementRow({
  title,
  name,
  preserved,
  error,
}: {
  title: string;
  name: IntakeRequirementErrorKey;
  preserved?: IntakeDocumentStatus | "";
  error?: string;
}) {
  return (
    <li
      className={cn(
        "rounded-r-lg border-b border-l-4 border-b-(--color-border) border-l-(--color-primary)/35 bg-[var(--color-surface-elevated) py-4 pl-4 last:border-b-0"
      )}
    >
      <span className="mb-2 block font-display text-base font-semibold leading-snug tracking-tight text-[var(--color-text) md:text-lg">
        {title}
      </span>
      <TriRadios name={name} preserved={preserved} />
      {error && <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
    </li>
  );
}

export default function IntakeRequirementsFieldset({
  errors,
  legend = "Requirements checklist (New / Transferee)",
  preserved,
  description = (
    <>
      Set each item to <strong className="text-[var(--color-text)">Received</strong>,{" "}
      <strong className="text-[var(--color-text)">Not applicable</strong>, or{" "}
      <strong className="text-[var(--color-text)">To follow</strong> if the document is still pending. Qualified
      Voucher and ESC follow the same rule.
    </>
  ),
}: IntakeRequirementsFieldsetProps) {
  return (
    <fieldset className="rounded-xl border border-[var(--color-border) bg-[var(--color-surface-2) p-5 shadow-sm">
      <legend className="font-display text-lg font-bold text-[var(--color-text) px-1">{legend}</legend>
      <p className="mb-5 mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text-muted)">{description}</p>
      <ul className="m-0 list-none space-y-0 rounded-lg border border-[var(--color-border) bg-[var(--color-surface-elevated) p-0 shadow-sm">
        <DocumentRequirementRow
          title="FORM 138"
          name="intakeForm138"
          preserved={preserved?.intakeForm138}
          error={errors?.intakeForm138?.[0]}
        />
        <DocumentRequirementRow
          title="Birth Certificate (PSA)"
          name="intakeBirthCertificatePsa"
          preserved={preserved?.intakeBirthCertificatePsa}
          error={errors?.intakeBirthCertificatePsa?.[0]}
        />
        <DocumentRequirementRow
          title="Good Moral Character"
          name="intakeGoodMoralCharacter"
          preserved={preserved?.intakeGoodMoralCharacter}
          error={errors?.intakeGoodMoralCharacter?.[0]}
        />
        <DocumentRequirementRow
          title="Qualified Voucher Certificate (if any)"
          name="intakeQualifiedVoucher"
          preserved={preserved?.intakeQualifiedVoucher}
          error={errors?.intakeQualifiedVoucher?.[0]}
        />
        <DocumentRequirementRow
          title="ESC Certificate (if any)"
          name="intakeEscCertificate"
          preserved={preserved?.intakeEscCertificate}
          error={errors?.intakeEscCertificate?.[0]}
        />
      </ul>
    </fieldset>
  );
}
