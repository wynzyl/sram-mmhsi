"use client";

import type { ReactNode } from "react";
import type { IntakePreserved } from "@/lib/utils/intake-documents";
import type { IntakeDocumentStatus } from "../enrollments.schema";
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
    "flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-muted";
  const inputClass =
    "h-4 w-4 shrink-0 border-border text-primary focus:ring-primary/25";

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
          required
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
          required
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
        "rounded-r-lg border-b border-l-4 py-4 pl-4 last:border-b-0",
        error
          ? "border-b-destructive/20 border-l-destructive bg-destructive/5"
          : "border-b-border border-l-primary/35 bg-card"
      )}
    >
      <span className="mb-2 block font-display text-base font-semibold leading-snug tracking-tight text-foreground md:text-lg">
        {title}
        {error && <span className="ml-2 text-sm font-normal text-destructive">(required)</span>}
      </span>
      <TriRadios name={name} preserved={preserved} />
      {error && (
        <p className="mt-2 text-sm font-medium text-destructive">{error}</p>
      )}
    </li>
  );
}

export default function IntakeRequirementsFieldset({
  errors,
  legend = "Requirements checklist (New / Transferee)",
  preserved,
  description = (
    <>
      Set each item to <strong className="text-foreground">Received</strong>,{" "}
      <strong className="text-foreground">Not applicable</strong>, or{" "}
      <strong className="text-foreground">To follow</strong> if the document is still pending. Qualified
      Voucher and ESC follow the same rule.
    </>
  ),
}: IntakeRequirementsFieldsetProps) {
  return (
    <fieldset className="rounded-xl border border-border bg-muted p-5 shadow-sm">
      <legend className="font-display text-lg font-bold text-foreground px-1">{legend}</legend>
      <p className="mb-5 mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      <ul className="m-0 list-none space-y-0 rounded-lg border border-border bg-card p-0 shadow-sm">
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
