"use client";

/* eslint-disable react/no-children-prop -- TanStack Form's <form.Field> uses children as a render-prop function; this is its documented API. */

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";

import { createStudentAction } from "@/features/students";
import type { CreateStudentFormState } from "@/lib/validators/student";
import {
  nameSchema,
  emailSchema,
  lrnSchema,
  phoneSchema,
  phoneRequiredSchema,
  emailRequiredSchema,
} from "@/lib/validators/common-schemas";
import { DataCard, DataCardBody } from "@/components/ui/editorial/DataCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
import { formatPhoneInput, stripPhoneFormat } from "@/lib/utils/phone";
import { useFormToast } from "@/hooks/useFormToast";

/**
 * PROTOTYPE — TanStack Form variant of StudentRegistrationForm.
 *
 * Demonstrates the TanStack Form approach against the native useActionState
 * pattern: per-field client validation (reusing the same Zod field schemas),
 * a typed guardian field array, and per-step gating. The server contract is
 * unchanged — on submit we build the same FormData and dispatch the existing
 * `createStudentAction`, so server-side validation + audit logging stay
 * authoritative. The original form remains the production path.
 */

type IntakeStatus = "received" | "not_applicable" | "to_follow" | "";

type GuardianValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  relationship: string;
  address: string;
  occupation: string;
  contactNumber: string;
  email: string;
  isPrimary: boolean;
};

type FormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  lrn: string;
  mobileNumber: string;
  email: string;
  nationality: string;
  bloodType: string;
  religion: string;
  previousSchool: string;
  submittedDocumentsNotes: string;
  gradeLevelId: string;
  guardians: GuardianValues[];
  intakeForm138: IntakeStatus;
  intakeBirthCertificatePsa: IntakeStatus;
  intakeGoodMoralCharacter: IntakeStatus;
  intakeQualifiedVoucher: IntakeStatus;
  intakeEscCertificate: IntakeStatus;
};

const emptyGuardian = (isPrimary = false): GuardianValues => ({
  firstName: "",
  middleName: "",
  lastName: "",
  relationship: "",
  address: "",
  occupation: "",
  contactNumber: "",
  email: "",
  isPrimary,
});

const intakeRequired = z.enum(["received", "not_applicable", "to_follow"], {
  message: "Select a status.",
});

const requiredText = (label: string) =>
  z.string().trim().min(1, `${label} is required.`);

/**
 * Adapt a Zod schema to a TanStack Form field validator function.
 * Returning `string | undefined` avoids the standard-schema output-type
 * matching constraint, so optional schemas and dynamic array fields work.
 */
const zodCheck =
  (schema: z.ZodType) =>
  ({ value }: { value: unknown }): string | undefined => {
    const r = schema.safeParse(value);
    return r.success ? undefined : r.error.issues[0]?.message;
  };

const INTAKE_ROWS: { name: keyof FormValues; title: string }[] = [
  { name: "intakeForm138", title: "FORM 138" },
  { name: "intakeBirthCertificatePsa", title: "Birth Certificate (PSA)" },
  { name: "intakeGoodMoralCharacter", title: "Good Moral Character" },
  { name: "intakeQualifiedVoucher", title: "Qualified Voucher Certificate (if any)" },
  { name: "intakeEscCertificate", title: "ESC Certificate (if any)" },
];

const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  1: ["firstName", "lastName", "dateOfBirth", "gender"],
  2: ["gradeLevelId", "previousSchool", "lrn", "mobileNumber", "email"],
  3: ["guardians"],
  4: [
    "intakeForm138",
    "intakeBirthCertificatePsa",
    "intakeGoodMoralCharacter",
    "intakeQualifiedVoucher",
    "intakeEscCertificate",
  ],
};

const STEP_TITLES: Record<number, string> = {
  1: "Student Information",
  2: "Contact, Notes & Grade",
  3: "Guardians",
  4: "Documents & Review",
};

interface GradeLevelOption {
  id: string;
  name: string;
  order: number;
}

interface Props {
  currentSchoolYear: { id: string; label: string } | null;
  gradeLevels: GradeLevelOption[];
  lockedRegistrationType: "new_student" | "transferee";
  successRedirectTo?: string;
}

/** Render the first validation error for a field, if any. */
function fieldError(errors: unknown[]): string | null {
  if (!errors || errors.length === 0) return null;
  const first = errors[0] as { message?: string } | string | undefined;
  if (!first) return null;
  return typeof first === "string" ? first : first.message ?? "Invalid value.";
}

export default function StudentRegistrationFormTanstack({
  currentSchoolYear,
  gradeLevels,
  lockedRegistrationType,
  successRedirectTo,
}: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateStudentFormState, FormData>(
    createStudentAction,
    {},
  );
  const [currentStep, setCurrentStep] = useState(1);

  useFormToast(state, {
    successMessage: "Student registered successfully",
    onSuccess: () => router.push(successRedirectTo ?? "/staff/registrations"),
  });

  const form = useForm({
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      suffix: "",
      dateOfBirth: "",
      gender: "",
      address: "",
      lrn: "",
      mobileNumber: "",
      email: "",
      nationality: "",
      bloodType: "",
      religion: "",
      previousSchool: "",
      submittedDocumentsNotes: "",
      gradeLevelId: "",
      guardians: [emptyGuardian(true)],
      intakeForm138: "",
      intakeBirthCertificatePsa: "",
      intakeGoodMoralCharacter: "",
      intakeQualifiedVoucher: "",
      intakeEscCertificate: "",
    } as FormValues,
    onSubmit: async ({ value }) => {
      const fd = new FormData();
      const scalarKeys: (keyof FormValues)[] = [
        "firstName", "middleName", "lastName", "suffix", "dateOfBirth", "gender",
        "address", "lrn", "mobileNumber", "email", "nationality", "bloodType",
        "religion", "previousSchool", "submittedDocumentsNotes", "gradeLevelId",
        "intakeForm138", "intakeBirthCertificatePsa", "intakeGoodMoralCharacter",
        "intakeQualifiedVoucher", "intakeEscCertificate",
      ];
      for (const k of scalarKeys) fd.set(k, String(value[k] ?? ""));
      fd.set("guardians", JSON.stringify(value.guardians));
      if (currentSchoolYear) fd.set("schoolYearId", currentSchoolYear.id);
      fd.set("registrationIntent", lockedRegistrationType);
      fd.set("registrationStudentType", lockedRegistrationType);
      action(fd);
    },
  });

  /** Validate the fields belonging to a step; return true if all pass. */
  const validateStep = async (step: number): Promise<boolean> => {
    const names = STEP_FIELDS[step] ?? [];
    const results = await Promise.all(
      names.map((n) => form.validateField(n as never, "change")),
    );
    return results.every((errs) => !errs || errs.length === 0);
  };

  const handleContinue = async () => {
    if (await validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(4, s + 1));
    }
  };

  const progress = (currentStep / 4) * 100;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-muted-foreground">Step {currentStep} of 4</span>
          <span className="font-medium text-foreground">{STEP_TITLES[currentStep]}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        {!currentSchoolYear && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            No <strong>active</strong> school year is configured. Configure one under{" "}
            <strong>School Years</strong> before registering students.
          </div>
        )}

        <DataCard>
          <DataCardBody className="space-y-8">
            {/* ── Step 1 ── */}
            <div className={cn("space-y-6", currentStep !== 1 && "hidden")}>
              <StepHeading title="Student Information" subtitle="Legal name, demographics, and address." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <form.Field
                  name="firstName"
                  validators={{ onChange: zodCheck(nameSchema) }}
                  children={(field) => (
                    <TextField label="First Name" required field={field} autoComplete="given-name" />
                  )}
                />
                <form.Field
                  name="middleName"
                  children={(field) => (
                    <TextField label="Middle Name" field={field} autoComplete="additional-name" />
                  )}
                />
                <form.Field
                  name="lastName"
                  validators={{ onChange: zodCheck(nameSchema) }}
                  children={(field) => (
                    <TextField label="Last Name" required field={field} autoComplete="family-name" />
                  )}
                />
                <form.Field
                  name="suffix"
                  children={(field) => (
                    <SelectField
                      label="Suffix"
                      field={field}
                      options={[
                        ["", "None"],
                        ["Jr.", "Jr."],
                        ["Sr.", "Sr."],
                        ["II", "II"],
                        ["III", "III"],
                        ["IV", "IV"],
                      ]}
                    />
                  )}
                />
                <form.Field
                  name="dateOfBirth"
                  validators={{ onChange: zodCheck(requiredText("Date of birth")) }}
                  children={(field) => (
                    <TextField label="Date of Birth" required type="date" field={field} />
                  )}
                />
                <form.Field
                  name="gender"
                  validators={{ onChange: zodCheck(requiredText("Gender")) }}
                  children={(field) => (
                    <SelectField
                      label="Gender"
                      required
                      field={field}
                      options={[
                        ["", "Select gender"],
                        ["male", "Male"],
                        ["female", "Female"],
                        ["other", "Other"],
                        ["prefer_not_to_say", "Prefer not to say"],
                      ]}
                    />
                  )}
                />
                <div className="md:col-span-2">
                  <form.Field
                    name="address"
                    children={(field) => <TextAreaField label="Address" field={field} rows={2} />}
                  />
                </div>
              </div>
            </div>

            {/* ── Step 2 ── */}
            <div className={cn("space-y-6", currentStep !== 2 && "hidden")}>
              <StepHeading
                title="Contact, Notes & Application"
                subtitle="Reachable contacts, transfer notes, and grade placement."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <form.Field
                  name="lrn"
                  validators={{ onChange: zodCheck(lrnSchema) }}
                  children={(field) => (
                    <TextField label="LRN" field={field} maxLength={12} mono placeholder="12-digit DepEd LRN" />
                  )}
                />
                <form.Field
                  name="mobileNumber"
                  validators={{ onChange: zodCheck(phoneSchema) }}
                  children={(field) => (
                    <PhoneField label="Mobile" field={field} />
                  )}
                />
                <form.Field
                  name="email"
                  validators={{ onChange: zodCheck(emailSchema) }}
                  children={(field) => <TextField label="Email" type="email" field={field} />}
                />
                <form.Field
                  name="nationality"
                  children={(field) => <TextField label="Nationality" field={field} placeholder="Filipino" />}
                />
                <form.Field
                  name="bloodType"
                  children={(field) => (
                    <SelectField
                      label="Blood Type"
                      field={field}
                      options={[["", "Unknown"], ["A+", "A+"], ["A-", "A-"], ["B+", "B+"], ["B-", "B-"], ["AB+", "AB+"], ["AB-", "AB-"], ["O+", "O+"], ["O-", "O-"]]}
                    />
                  )}
                />
                <form.Field
                  name="religion"
                  children={(field) => <TextField label="Religion" field={field} placeholder="Roman Catholic" />}
                />
                <div className="md:col-span-3">
                  <form.Field
                    name="previousSchool"
                    validators={{
                      onChange: lockedRegistrationType === "transferee"
                        ? zodCheck(requiredText("Previous school"))
                        : undefined,
                    }}
                    children={(field) => (
                      <TextField
                        label={`Previous school${lockedRegistrationType === "transferee" ? "" : " (transferees)"}`}
                        required={lockedRegistrationType === "transferee"}
                        field={field}
                        placeholder="Name of last school attended"
                      />
                    )}
                  />
                </div>
                <div className="md:col-span-3">
                  <form.Field
                    name="submittedDocumentsNotes"
                    children={(field) => (
                      <TextAreaField
                        label="Submitted documents (notes)"
                        field={field}
                        rows={3}
                        placeholder="e.g. Birth certificate on file, Form 137 pending"
                      />
                    )}
                  />
                </div>
              </div>

              {currentSchoolYear && (
                <div className="grid grid-cols-1 gap-4 border-t border-border pt-6 md:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-foreground">
                      School year <span className="text-red-600">*</span>
                    </span>
                    <div className={editorialFieldClass({ className: "bg-gray-200 text-muted-foreground dark:bg-gray-800" })}>
                      <strong className="text-foreground">{currentSchoolYear.label}</strong>
                      <span className="ml-2 text-sm">(active year only)</span>
                    </div>
                  </div>
                  <form.Field
                    name="gradeLevelId"
                    validators={{ onChange: zodCheck(requiredText("Grade level")) }}
                    children={(field) => (
                      <SelectField
                        label="Grade level"
                        required
                        field={field}
                        options={[["", "Select grade level"], ...gradeLevels.map((gl) => [gl.id, gl.name] as [string, string])]}
                      />
                    )}
                  />
                  <div className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-foreground">Enrollment type</span>
                    <div className={editorialFieldClass({ className: "bg-gray-200 text-foreground dark:bg-gray-800" })}>
                      <strong className="text-foreground">
                        {lockedRegistrationType === "transferee" ? "Transferee" : "New student"}
                      </strong>
                      <span className="ml-2 text-sm text-muted-foreground">(set by the page you opened)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 3: Guardians (field array) ── */}
            <div className={cn("space-y-6", currentStep !== 3 && "hidden")}>
              <StepHeading
                title="Guardians"
                subtitle="At least one guardian with a complete profile is required before submission."
              />
              <form.Field
                name="guardians"
                mode="array"
                children={(arrayField) => (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => arrayField.pushValue(emptyGuardian())}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        + Add guardian
                      </button>
                    </div>

                    {arrayField.state.value.map((g, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                          <h4 className="font-display text-lg font-bold text-foreground">
                            Guardian {i + 1}
                            {g.isPrimary && (
                              <span className="ml-2 inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 align-middle font-mono text-xs font-semibold uppercase text-primary">
                                Primary
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2">
                            {!g.isPrimary && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Single primary: clear all, then set this one.
                                  arrayField.state.value.forEach((_, j) =>
                                    form.setFieldValue(`guardians[${j}].isPrimary` as never, (j === i) as never),
                                  );
                                }}
                                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                              >
                                Set as primary
                              </button>
                            )}
                            {arrayField.state.value.length > 1 && (
                              <button
                                type="button"
                                onClick={() => arrayField.removeValue(i)}
                                className="rounded-lg border border-red-200 bg-card px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <form.Field
                            name={`guardians[${i}].firstName` as never}
                            validators={{ onChange: zodCheck(nameSchema) }}
                            children={(field) => <TextField label="First name" required field={field} />}
                          />
                          <form.Field
                            name={`guardians[${i}].middleName` as never}
                            children={(field) => <TextField label="Middle name" field={field} />}
                          />
                          <form.Field
                            name={`guardians[${i}].lastName` as never}
                            validators={{ onChange: zodCheck(nameSchema) }}
                            children={(field) => <TextField label="Last name" required field={field} />}
                          />
                          <form.Field
                            name={`guardians[${i}].relationship` as never}
                            validators={{ onChange: zodCheck(requiredText("Relationship")) }}
                            children={(field) => (
                              <SelectField
                                label="Relationship"
                                required
                                field={field}
                                options={[["", "Select relationship"], ["Mother", "Mother"], ["Father", "Father"], ["Grandmother", "Grandmother"], ["Grandfather", "Grandfather"], ["Aunt", "Aunt"], ["Uncle", "Uncle"], ["Legal Guardian", "Legal Guardian"], ["Other", "Other"]]}
                              />
                            )}
                          />
                          <div className="md:col-span-2">
                            <form.Field
                              name={`guardians[${i}].address` as never}
                              validators={{ onChange: zodCheck(requiredText("Address")) }}
                              children={(field) => <TextAreaField label="Address" required field={field} rows={2} />}
                            />
                          </div>
                          <form.Field
                            name={`guardians[${i}].occupation` as never}
                            children={(field) => <TextField label="Occupation" field={field} />}
                          />
                          <form.Field
                            name={`guardians[${i}].contactNumber` as never}
                            validators={{ onChange: zodCheck(phoneRequiredSchema) }}
                            children={(field) => <PhoneField label="Contact number" required field={field} />}
                          />
                          <div className="md:col-span-2">
                            <form.Field
                              name={`guardians[${i}].email` as never}
                              validators={{ onChange: zodCheck(emailRequiredSchema) }}
                              children={(field) => <TextField label="Email" required type="email" field={field} />}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* ── Step 4: Intake ── */}
            <div className={cn("space-y-6", currentStep !== 4 && "hidden")}>
              <StepHeading title="Documents & Requirements" subtitle="Intake checklist for this registration." />
              <fieldset className="rounded-xl border border-border bg-muted p-5 shadow-sm">
                <legend className="px-1 font-display text-lg font-bold text-foreground">
                  Requirements (new / transferee)
                </legend>
                <ul className="m-0 mt-3 list-none space-y-0 rounded-lg border border-border bg-card p-0 shadow-sm">
                  {INTAKE_ROWS.map((row) => (
                    <form.Field
                      key={row.name}
                      name={row.name as never}
                      validators={{ onChange: zodCheck(intakeRequired) }}
                      children={(field) => {
                        const err = fieldError(field.state.meta.errors);
                        return (
                          <li className={cn(
                            "rounded-r-lg border-b border-l-4 py-4 pl-4 last:border-b-0",
                            err ? "border-l-destructive bg-destructive/5" : "border-l-primary/35 bg-card",
                          )}>
                            <span className="mb-2 block font-display text-base font-semibold text-foreground">
                              {row.title}
                            </span>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                              {(["received", "not_applicable", "to_follow"] as const).map((opt) => (
                                <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <input
                                    type="radio"
                                    name={String(row.name)}
                                    value={opt}
                                    checked={field.state.value === opt}
                                    onChange={() => field.handleChange(opt as never)}
                                    className="h-4 w-4 text-primary focus:ring-primary/25"
                                  />
                                  <span>{opt === "not_applicable" ? "Not applicable" : opt === "to_follow" ? "To follow" : "Received"}</span>
                                </label>
                              ))}
                            </div>
                            {err && <p className="mt-2 text-sm font-medium text-destructive">{err}</p>}
                          </li>
                        );
                      }}
                    />
                  ))}
                </ul>
              </fieldset>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between border-t border-border pt-6">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                  className="inline-flex items-center gap-2 px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button type="button" onClick={handleContinue} variant="primary" size="md">
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={pending || !currentSchoolYear} variant="primary" size="md" loading={pending}>
                  {pending ? "Registering…" : "Register student"}
                </Button>
              )}
            </div>
          </DataCardBody>
        </DataCard>
      </form>
    </div>
  );
}

// ──────────────────────── Reusable field renderers ────────────────────────

type AnyField = {
  name: string;
  state: { value: string; meta: { errors: unknown[] } };
  handleChange: (v: never) => void;
  handleBlur: () => void;
};

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-l-4 border-primary pl-6">
      <h2 className="mb-2 font-display text-2xl font-bold text-foreground">{title}</h2>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function TextField({
  label,
  field,
  required,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
  mono,
}: {
  label: string;
  field: AnyField;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  mono?: boolean;
}) {
  const err = fieldError(field.state.meta.errors);
  return (
    <div>
      <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        id={field.name}
        name={field.name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
        className={editorialFieldClass({ invalid: !!err, className: mono ? "font-mono" : undefined })}
      />
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function PhoneField({ label, field, required }: { label: string; field: AnyField; required?: boolean }) {
  const err = fieldError(field.state.meta.errors);
  return (
    <div>
      <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        id={field.name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="0917-010-0098"
        value={formatPhoneInput(field.state.value)}
        onChange={(e) => field.handleChange(stripPhoneFormat(formatPhoneInput(e.target.value)) as never)}
        onBlur={field.handleBlur}
        className={editorialFieldClass({ invalid: !!err, className: "font-mono" })}
      />
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function TextAreaField({
  label,
  field,
  rows = 2,
  required,
  placeholder,
}: {
  label: string;
  field: AnyField;
  rows?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const err = fieldError(field.state.meta.errors);
  return (
    <div>
      <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <textarea
        id={field.name}
        name={field.name}
        rows={rows}
        placeholder={placeholder}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
        className={editorialFieldClass({ invalid: !!err })}
      />
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function SelectField({
  label,
  field,
  options,
  required,
}: {
  label: string;
  field: AnyField;
  options: [string, string][];
  required?: boolean;
}) {
  const err = fieldError(field.state.meta.errors);
  return (
    <div>
      <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <select
        id={field.name}
        name={field.name}
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value as never)}
        onBlur={field.handleBlur}
        className={editorialFieldClass({ invalid: !!err })}
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}
