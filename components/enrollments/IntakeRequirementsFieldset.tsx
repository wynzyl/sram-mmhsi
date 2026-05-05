"use client";

import type { ReactNode } from "react";
import type { IntakePreserved } from "@/lib/utils/intake-documents";
import type { IntakeDocumentStatus } from "@/lib/validators/intake-documents";

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
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={name}
          value="received"
          required
          defaultChecked={v === "received"}
        />
        Received
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={name}
          value="not_applicable"
          defaultChecked={v === "not_applicable"}
        />
        Not applicable
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" name={name} value="to_follow" defaultChecked={v === "to_follow"} />
        To follow
      </label>
    </div>
  );
}

export default function IntakeRequirementsFieldset({
  errors,
  legend = "Requirements checklist (New / Transferee)",
  preserved,
  description = (
    <>
      Set each item to <strong>Received</strong>, <strong>Not applicable</strong>, or{" "}
      <strong>To follow</strong> if the document is still pending. Qualified Voucher and ESC follow the
      same rule.
    </>
  ),
}: IntakeRequirementsFieldsetProps) {
  return (
    <fieldset
      className="form-section"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "1rem",
      }}
    >
      <legend className="form-section-title" style={{ padding: "0 0.35rem" }}>
        {legend}
      </legend>
      <p className="text-muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
        {description}
      </p>
      <ul className="student-record-muted" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li style={{ marginBottom: "0.65rem" }}>
          <span className="form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
            FORM 138
          </span>
          <TriRadios name="intakeForm138" preserved={preserved?.intakeForm138} />
          {errors?.intakeForm138 && (
            <p className="form-error" style={{ marginTop: "0.25rem" }}>
              {errors.intakeForm138[0]}
            </p>
          )}
        </li>
        <li style={{ marginBottom: "0.65rem" }}>
          <span className="form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
            Birth Certificate (PSA)
          </span>
          <TriRadios name="intakeBirthCertificatePsa" preserved={preserved?.intakeBirthCertificatePsa} />
          {errors?.intakeBirthCertificatePsa && (
            <p className="form-error" style={{ marginTop: "0.25rem" }}>
              {errors.intakeBirthCertificatePsa[0]}
            </p>
          )}
        </li>
        <li style={{ marginBottom: "0.65rem" }}>
          <span className="form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
            Good Moral Character
          </span>
          <TriRadios name="intakeGoodMoralCharacter" preserved={preserved?.intakeGoodMoralCharacter} />
          {errors?.intakeGoodMoralCharacter && (
            <p className="form-error" style={{ marginTop: "0.25rem" }}>
              {errors.intakeGoodMoralCharacter[0]}
            </p>
          )}
        </li>
        <li style={{ marginBottom: "0.65rem" }}>
          <span className="form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
            Qualified Voucher Certificate (if any)
          </span>
          <TriRadios name="intakeQualifiedVoucher" preserved={preserved?.intakeQualifiedVoucher} />
          {errors?.intakeQualifiedVoucher && (
            <p className="form-error" style={{ marginTop: "0.25rem" }}>
              {errors.intakeQualifiedVoucher[0]}
            </p>
          )}
        </li>
        <li>
          <span className="form-label" style={{ display: "block", marginBottom: "0.25rem" }}>
            ESC Certificate (if any)
          </span>
          <TriRadios name="intakeEscCertificate" preserved={preserved?.intakeEscCertificate} />
          {errors?.intakeEscCertificate && (
            <p className="form-error" style={{ marginTop: "0.25rem" }}>
              {errors.intakeEscCertificate[0]}
            </p>
          )}
        </li>
      </ul>
    </fieldset>
  );
}
