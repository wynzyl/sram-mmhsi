"use client";

import { useActionState, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createStudentAction } from "@/features/students";
import {
  GuardianSchema,
  type CreateStudentFormFieldSnapshot,
  type CreateStudentFormState,
  type GuardianInput,
} from "@/lib/validators/student";
import {
  emailSchema,
  lrnSchema,
  phoneSchema,
} from "@/lib/validators/common-schemas";
import { DataCard, DataCardBody } from "@/components/ui/editorial/DataCard";
import GuardianForm from "@/features/students/components/GuardianForm";
import IntakeRequirementsFieldset from "@/features/enrollments/components/IntakeRequirementsFieldset";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";

const emptyGuardian = (): GuardianInput => ({
  firstName: "",
  middleName: "",
  lastName: "",
  relationship: "",
  address: "",
  occupation: "",
  contactNumber: "",
  email: "",
  isPrimary: false,
});

const initialState: CreateStudentFormState = {};

type StudentProfileBase = "/staff/students";

function registrationsQueuePath(_studentBasePath: StudentProfileBase): string {
  return "/staff/registrations";
}

interface GradeLevelOption {
  id: string;
  name: string;
  order: number;
}

interface StudentRegistrationFormProps {
  afterCreateStudentBasePath?: StudentProfileBase;
  /** Where to go after successful registration (default: registrations queue for admin/staff). */
  successRedirectTo?: string;
  currentSchoolYear: { id: string; label: string } | null;
  gradeLevels: GradeLevelOption[];
  lockedRegistrationType: "new_student" | "transferee";
}

type FormStep = 1 | 2 | 3 | 4;

const stepTitles: Record<FormStep, string> = {
  1: "Student Information",
  2: "Contact, Notes & Grade",
  3: "Guardians",
  4: "Documents & Review",
};

/**
 * Multi-step registration wizard with editorial styling. Submits via the same
 * `createStudentAction` contract as `StudentForm` (guardians JSON, gender, intake fields, etc.).
 */
export default function StudentRegistrationForm({
  afterCreateStudentBasePath = "/staff/students",
  successRedirectTo,
  currentSchoolYear,
  gradeLevels,
  lockedRegistrationType,
}: StudentRegistrationFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStudentAction, initialState);
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [draft, setDraft] = useState<Partial<CreateStudentFormFieldSnapshot>>({});
  const [guardians, setGuardians] = useState<GuardianInput[]>([
    { ...emptyGuardian(), isPrimary: true },
  ]);
  /** Client-side per-step validation errors (cleared on field change / step transition). */
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.fieldValues) {
      setDraft(state.fieldValues);
      if (state.fieldValues.guardians.length > 0) {
        setGuardians(state.fieldValues.guardians);
      }
    }
  }, [state.fieldValues]);

  /** Single source of truth for field errors — merge client + server, prefer fresh client errors. */
  const getError = useCallback(
    (key: string): string | undefined =>
      stepErrors[key] ??
      (state.errors as Record<string, string[] | undefined> | undefined)?.[key]?.[0],
    [stepErrors, state.errors]
  );

  /** Update a draft field and clear its stale per-step error (so the inline message disappears as the user types). */
  const updateDraft = useCallback(
    <K extends keyof CreateStudentFormFieldSnapshot>(
      key: K,
      value: CreateStudentFormFieldSnapshot[K]
    ) => {
      setDraft((d) => ({ ...d, [key]: value }));
      setStepErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    []
  );

  /** Validate just the fields that live on the requested step. Returns errors keyed by field name. */
  const validateStep = useCallback(
    (step: FormStep): Record<string, string> => {
      const errors: Record<string, string> = {};

      if (step === 1) {
        if (!draft.firstName?.trim()) errors.firstName = "First name is required.";
        if (!draft.lastName?.trim()) errors.lastName = "Last name is required.";
        if (!draft.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
        else {
          const d = new Date(draft.dateOfBirth);
          if (Number.isNaN(d.getTime())) errors.dateOfBirth = "Invalid date of birth.";
        }
        if (!draft.gender) errors.gender = "Gender is required.";
      }

      if (step === 2) {
        if (!currentSchoolYear) {
          errors._form =
            "An active school year is required before continuing. Configure one under School Years.";
          return errors;
        }
        if (!draft.gradeLevelId) errors.gradeLevelId = "Grade level is required.";
        if (lockedRegistrationType === "transferee" && !draft.previousSchool?.trim()) {
          errors.previousSchool = "Previous school is required for transferees.";
        }
        const lrnCheck = lrnSchema.safeParse(draft.lrn || undefined);
        if (!lrnCheck.success) errors.lrn = lrnCheck.error.issues[0]?.message ?? "Invalid LRN.";
        const phoneCheck = phoneSchema.safeParse(draft.mobileNumber || undefined);
        if (!phoneCheck.success) {
          errors.mobileNumber =
            phoneCheck.error.issues[0]?.message ?? "Invalid mobile number.";
        }
        const emailCheck = emailSchema.safeParse(draft.email || undefined);
        if (!emailCheck.success) {
          errors.email = emailCheck.error.issues[0]?.message ?? "Invalid email address.";
        }
      }

      if (step === 3) {
        if (guardians.length === 0) {
          errors.guardians = "At least one guardian is required.";
        } else {
          for (let i = 0; i < guardians.length; i++) {
            const result = GuardianSchema.safeParse(guardians[i]);
            if (!result.success) {
              const firstIssue = result.error.issues[0];
              const fieldName = String(firstIssue?.path[0] ?? "details");
              errors.guardians = `Guardian ${i + 1}: ${firstIssue?.message ?? `please complete the ${fieldName} field.`}`;
              break;
            }
          }
          if (!errors.guardians && !guardians.some((g) => g.isPrimary)) {
            errors.guardians = "Mark one guardian as the primary contact.";
          }
        }
      }

      return errors;
    },
    [draft, guardians, currentSchoolYear, lockedRegistrationType]
  );

  const handleContinue = useCallback(() => {
    const errors = validateStep(currentStep);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors({});
    setCurrentStep((prev) => Math.min(4, prev + 1) as FormStep);
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    setStepErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep);
  }, []);

  useEffect(() => {
    if (state.success && state.studentId) {
      const next =
        successRedirectTo ?? registrationsQueuePath(afterCreateStudentBasePath);
      router.push(next);
    }
  }, [
    state.success,
    state.studentId,
    router,
    afterCreateStudentBasePath,
    successRedirectTo,
  ]);

  const clearGuardiansError = useCallback(() => {
    setStepErrors((prev) => {
      if (!("guardians" in prev)) return prev;
      const next = { ...prev };
      delete next.guardians;
      return next;
    });
  }, []);

  const handleGuardianChange = (index: number, guardian: GuardianInput) => {
    setGuardians((prev) => {
      const next = [...prev];
      if (guardian.isPrimary) {
        next.forEach((g, i) => {
          if (i !== index) next[i] = { ...g, isPrimary: false };
        });
      }
      next[index] = guardian;
      return next;
    });
    clearGuardiansError();
  };

  const handleGuardianRemove = (index: number) => {
    setGuardians((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((g) => g.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
    clearGuardiansError();
  };

  const addGuardian = () => {
    setGuardians((prev) => [...prev, emptyGuardian()]);
    clearGuardiansError();
  };

  const disableSubmit = pending || !currentSchoolYear;
  const progress = (currentStep / 4) * 100;

  const intakePreserved = state.fieldValues
    ? {
        intakeForm138: state.fieldValues.intakeForm138,
        intakeBirthCertificatePsa: state.fieldValues.intakeBirthCertificatePsa,
        intakeGoodMoralCharacter: state.fieldValues.intakeGoodMoralCharacter,
        intakeQualifiedVoucher: state.fieldValues.intakeQualifiedVoucher,
        intakeEscCertificate: state.fieldValues.intakeEscCertificate,
      }
    : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-warm-gray">
            Step {currentStep} of 4
          </span>
          <span className="font-medium text-charcoal">{stepTitles[currentStep]}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form action={action} noValidate>
        <input type="hidden" name="guardians" value={JSON.stringify(guardians)} />
        {currentSchoolYear ? (
          <>
            <input type="hidden" name="schoolYearId" value={currentSchoolYear.id} />
            <input type="hidden" name="registrationIntent" value={lockedRegistrationType} />
            <input type="hidden" name="registrationStudentType" value={lockedRegistrationType} />
          </>
        ) : null}

        <FormStateAlert state={state} />

        {!currentSchoolYear && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            No <strong>active</strong> school year is configured. Add or activate the current school
            year under <strong>School Years</strong> before registering students.
          </div>
        )}

        {lockedRegistrationType === "transferee" && (
          <div
            className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm"
            role="note"
          >
            <strong>Transferee:</strong> Enter the learner&apos;s last school in{" "}
            <strong>Previous school</strong>. Enrollment type is fixed to <strong>Transferee</strong>.
          </div>
        )}

        <DataCard>
          <DataCardBody className="space-y-8">
            {/* Step 1 */}
            <div className={cn("space-y-6", currentStep !== 1 && "hidden")}>
              <div className="border-l-4 border-[var(--color-primary)] pl-6">
                <h2 className="mb-2 font-display text-2xl font-bold text-charcoal">
                  Student Information
                </h2>
                <p className="text-warm-gray">Legal name, demographics, and address.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-charcoal">
                    First Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    required
                    autoComplete="given-name"
                    value={draft.firstName ?? ""}
                    onChange={(e) => updateDraft("firstName", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("firstName") })}
                  />
                  {getError("firstName") && (
                    <p className="mt-1 text-sm text-red-600">{getError("firstName")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="middleName" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Middle Name
                  </label>
                  <input
                    id="middleName"
                    name="middleName"
                    autoComplete="additional-name"
                    value={draft.middleName ?? ""}
                    onChange={(e) => updateDraft("middleName", e.target.value)}
                    className={editorialFieldClass()}
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Last Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    required
                    autoComplete="family-name"
                    value={draft.lastName ?? ""}
                    onChange={(e) => updateDraft("lastName", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("lastName") })}
                  />
                  {getError("lastName") && (
                    <p className="mt-1 text-sm text-red-600">{getError("lastName")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="suffix" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Suffix
                  </label>
                  <select
                    id="suffix"
                    name="suffix"
                    value={draft.suffix ?? ""}
                    onChange={(e) => updateDraft("suffix", e.target.value)}
                    className={editorialFieldClass()}
                  >
                    <option value="">None</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="dateOfBirth" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Date of Birth <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    required
                    value={draft.dateOfBirth ?? ""}
                    onChange={(e) => updateDraft("dateOfBirth", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("dateOfBirth") })}
                  />
                  {getError("dateOfBirth") && (
                    <p className="mt-1 text-sm text-red-600">{getError("dateOfBirth")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="gender" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Gender <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    required
                    value={draft.gender ?? ""}
                    onChange={(e) => updateDraft("gender", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("gender") })}
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  {getError("gender") && (
                    <p className="mt-1 text-sm text-red-600">{getError("gender")}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={2}
                    value={draft.address ?? ""}
                    onChange={(e) => updateDraft("address", e.target.value)}
                    className={editorialFieldClass()}
                  />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={cn("space-y-6", currentStep !== 2 && "hidden")}>
              <div className="border-l-4 border-[var(--color-primary)] pl-6">
                <h2 className="mb-2 font-display text-2xl font-bold text-charcoal">
                  Contact, Notes & Application
                </h2>
                <p className="text-warm-gray">Reachable contacts, transfer notes, and grade placement.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label htmlFor="lrn" className="mb-1.5 block text-sm font-medium text-charcoal">
                    LRN
                  </label>
                  <input
                    id="lrn"
                    name="lrn"
                    maxLength={12}
                    placeholder="12-digit DepEd LRN"
                    value={draft.lrn ?? ""}
                    onChange={(e) => updateDraft("lrn", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("lrn"), className: "font-mono" })}
                  />
                  {getError("lrn") && (
                    <p className="mt-1 text-sm text-red-600">{getError("lrn")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="mobileNumber" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Mobile
                  </label>
                  <input
                    id="mobileNumber"
                    name="mobileNumber"
                    type="tel"
                    autoComplete="tel"
                    placeholder="09171234567"
                    value={draft.mobileNumber ?? ""}
                    onChange={(e) => updateDraft("mobileNumber", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("mobileNumber") })}
                  />
                  {getError("mobileNumber") && (
                    <p className="mt-1 text-sm text-red-600">{getError("mobileNumber")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={draft.email ?? ""}
                    onChange={(e) => updateDraft("email", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("email") })}
                  />
                  {getError("email") && (
                    <p className="mt-1 text-sm text-red-600">{getError("email")}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="nationality" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Nationality
                  </label>
                  <input
                    id="nationality"
                    name="nationality"
                    placeholder="Filipino"
                    value={draft.nationality ?? ""}
                    onChange={(e) => updateDraft("nationality", e.target.value)}
                    className={editorialFieldClass()}
                  />
                </div>

                <div>
                  <label htmlFor="bloodType" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Blood Type
                  </label>
                  <select
                    id="bloodType"
                    name="bloodType"
                    value={draft.bloodType ?? ""}
                    onChange={(e) => updateDraft("bloodType", e.target.value)}
                    className={editorialFieldClass()}
                  >
                    <option value="">Unknown</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="religion" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Religion
                  </label>
                  <input
                    id="religion"
                    name="religion"
                    placeholder="Roman Catholic"
                    value={draft.religion ?? ""}
                    onChange={(e) => updateDraft("religion", e.target.value)}
                    className={editorialFieldClass()}
                  />
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="previousSchool" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Previous school{lockedRegistrationType === "transferee" ? " " : " (transferees)"}
                    {lockedRegistrationType === "transferee" && (
                      <span className="text-red-600">*</span>
                    )}
                  </label>
                  <input
                    id="previousSchool"
                    name="previousSchool"
                    placeholder="Name of last school attended"
                    value={draft.previousSchool ?? ""}
                    onChange={(e) => updateDraft("previousSchool", e.target.value)}
                    className={editorialFieldClass({ invalid: !!getError("previousSchool") })}
                  />
                  {getError("previousSchool") && (
                    <p className="mt-1 text-sm text-red-600">{getError("previousSchool")}</p>
                  )}
                </div>

                <div className="md:col-span-3">
                  <label
                    htmlFor="submittedDocumentsNotes"
                    className="mb-1.5 block text-sm font-medium text-charcoal"
                  >
                    Submitted documents (notes)
                  </label>
                  <textarea
                    id="submittedDocumentsNotes"
                    name="submittedDocumentsNotes"
                    rows={3}
                    placeholder="e.g. Birth certificate on file, Form 137 pending"
                    value={draft.submittedDocumentsNotes ?? ""}
                    onChange={(e) =>
                      updateDraft("submittedDocumentsNotes", e.target.value)
                    }
                    className={editorialFieldClass({ invalid: !!getError("submittedDocumentsNotes") })}
                  />
                  {getError("submittedDocumentsNotes") && (
                    <p className="mt-1 text-sm text-red-600">
                      {getError("submittedDocumentsNotes")}
                    </p>
                  )}
                </div>
              </div>

              {currentSchoolYear ? (
                <div className="grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-6 md:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-charcoal">
                      School year <span className="text-red-600">*</span>
                    </span>
                    <div
                      className={editorialFieldClass({
                        invalid: !!getError("schoolYearId"),
                        className:
                          "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]",
                      })}
                    >
                      <strong className="text-[var(--color-text)]">{currentSchoolYear.label}</strong>
                      <span className="ml-2 text-sm">(active year only)</span>
                    </div>
                    {getError("schoolYearId") && (
                      <p className="mt-1 text-sm text-red-600">{getError("schoolYearId")}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="gradeLevelId" className="mb-1.5 block text-sm font-medium text-charcoal">
                      Grade level <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="gradeLevelId"
                      name="gradeLevelId"
                      required
                      value={draft.gradeLevelId ?? ""}
                      onChange={(e) => updateDraft("gradeLevelId", e.target.value)}
                      className={editorialFieldClass({ invalid: !!getError("gradeLevelId") })}
                    >
                      <option value="">Select grade level</option>
                      {gradeLevels.map((gl) => (
                        <option key={gl.id} value={gl.id}>
                          {gl.name}
                        </option>
                      ))}
                    </select>
                    {getError("gradeLevelId") && (
                      <p className="mt-1 text-sm text-red-600">{getError("gradeLevelId")}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-charcoal">Enrollment type</span>
                    <div
                      className={editorialFieldClass({
                        invalid: !!getError("registrationStudentType"),
                        className: "bg-[var(--color-surface-3)] text-[var(--color-text)]",
                      })}
                    >
                      <strong className="text-[var(--color-text)]">
                        {lockedRegistrationType === "transferee" ? "Transferee" : "New student"}
                      </strong>
                      <span className="ml-2 text-sm text-[var(--color-text-muted)]">
                        (set by the page you opened)
                      </span>
                    </div>
                    {getError("registrationStudentType") && (
                      <p className="mt-1 text-sm text-red-600">
                        {getError("registrationStudentType")}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Step 3 */}
            <div className={cn("space-y-6", currentStep !== 3 && "hidden")}>
              <div className="border-l-4 border-[var(--color-primary)] pl-6">
                <h2 className="mb-2 font-display text-2xl font-bold text-charcoal">Guardians</h2>
                <p className="text-warm-gray">
                  At least one guardian with a complete name is required before submission.
                </p>
              </div>

              {getError("guardians") && (
                <p className="text-sm text-red-600">{getError("guardians")}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addGuardian}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-charcoal transition-colors hover:bg-[var(--color-surface-3)]"
                >
                  + Add guardian
                </button>
              </div>

              <div className="space-y-4">
                {guardians.map((guardian, index) => (
                  <GuardianForm
                    key={index}
                    index={index}
                    guardian={guardian}
                    canRemove={guardians.length > 1}
                    onChange={handleGuardianChange}
                    onRemove={handleGuardianRemove}
                  />
                ))}
              </div>
            </div>

            {/* Step 4 */}
            <div className={cn("space-y-6", currentStep !== 4 && "hidden")}>
              <div className="border-l-4 border-[var(--color-primary)] pl-6">
                <h2 className="mb-2 font-display text-2xl font-bold text-charcoal">
                  Documents & Requirements
                </h2>
                <p className="text-warm-gray">Intake checklist for this registration.</p>
              </div>

              <IntakeRequirementsFieldset
                key={
                  state.fieldValues
                    ? `intake-${state.fieldValues.intakeForm138}-${state.fieldValues.intakeBirthCertificatePsa}-${state.fieldValues.intakeGoodMoralCharacter}-${state.fieldValues.intakeQualifiedVoucher}-${state.fieldValues.intakeEscCertificate}`
                    : "intake"
                }
                errors={state.errors}
                legend="Requirements (new / transferee)"
                preserved={intakePreserved}
                description={
                  <>
                    Set each item to <strong>Received</strong>, <strong>Not applicable</strong>, or{" "}
                    <strong>To follow</strong> when documents are still pending.
                  </>
                }
              />
            </div>

            {stepErrors._form && currentStep < 4 && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {stepErrors._form}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-6">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-4 py-2 text-warm-gray transition-colors hover:text-charcoal"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleContinue}
                  variant="primary"
                  size="md"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={disableSubmit}
                  variant="primary"
                  size="md"
                  loading={pending}
                >
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
