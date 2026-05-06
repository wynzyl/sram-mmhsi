"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStudentAction } from "@/actions/students";
import type {
  CreateStudentFormFieldSnapshot,
  CreateStudentFormState,
  GuardianInput,
} from "@/lib/validators/student";
import { DataCard, DataCardBody } from "@/components/ui/editorial/DataCard";
import GuardianForm from "@/components/students/GuardianForm";
import IntakeRequirementsFieldset from "@/components/enrollments/IntakeRequirementsFieldset";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
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

type StudentProfileBase = "/admin/students" | "/staff/students";

/** Queue URL after a successful create (matches admin vs staff student area). */
function registrationsQueuePath(studentBasePath: StudentProfileBase): string {
  return studentBasePath.startsWith("/staff") ? "/staff/registrations" : "/admin/registrations";
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
  afterCreateStudentBasePath = "/admin/students",
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

  useEffect(() => {
    if (state.fieldValues) {
      setDraft(state.fieldValues);
      if (state.fieldValues.guardians.length > 0) {
        setGuardians(state.fieldValues.guardians);
      }
    }
  }, [state.fieldValues]);

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
  };

  const handleGuardianRemove = (index: number) => {
    setGuardians((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((g) => g.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const addGuardian = () => {
    setGuardians((prev) => [...prev, emptyGuardian()]);
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
        <div className="h-2 overflow-hidden rounded-full bg-light-gray">
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
                    onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.firstName })}
                  />
                  {state.errors?.firstName && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.firstName[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, middleName: e.target.value }))}
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
                    onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.lastName })}
                  />
                  {state.errors?.lastName && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.lastName[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, suffix: e.target.value }))}
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
                    onChange={(e) => setDraft((d) => ({ ...d, dateOfBirth: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.dateOfBirth })}
                  />
                  {state.errors?.dateOfBirth && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.dateOfBirth[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.gender })}
                  >
                    <option value="" disabled>
                      Select gender
                    </option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  {state.errors?.gender && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.gender[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
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
                    onChange={(e) => setDraft((d) => ({ ...d, lrn: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.lrn, className: "font-mono" })}
                  />
                  {state.errors?.lrn && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.lrn[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, mobileNumber: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.mobileNumber })}
                  />
                  {state.errors?.mobileNumber && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.mobileNumber[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.email })}
                  />
                  {state.errors?.email && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
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
                    onChange={(e) => setDraft((d) => ({ ...d, nationality: e.target.value }))}
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
                    onChange={(e) => setDraft((d) => ({ ...d, bloodType: e.target.value }))}
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
                    onChange={(e) => setDraft((d) => ({ ...d, religion: e.target.value }))}
                    className={editorialFieldClass()}
                  />
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="previousSchool" className="mb-1.5 block text-sm font-medium text-charcoal">
                    Previous school (transferees)
                  </label>
                  <input
                    id="previousSchool"
                    name="previousSchool"
                    placeholder="Name of last school attended"
                    value={draft.previousSchool ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, previousSchool: e.target.value }))}
                    className={editorialFieldClass({ invalid: !!state.errors?.previousSchool })}
                  />
                  {state.errors?.previousSchool && (
                    <p className="mt-1 text-sm text-red-600">{state.errors.previousSchool[0]}</p>
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
                      setDraft((d) => ({ ...d, submittedDocumentsNotes: e.target.value }))
                    }
                    className={editorialFieldClass({ invalid: !!state.errors?.submittedDocumentsNotes })}
                  />
                  {state.errors?.submittedDocumentsNotes && (
                    <p className="mt-1 text-sm text-red-600">
                      {state.errors.submittedDocumentsNotes[0]}
                    </p>
                  )}
                </div>
              </div>

              {currentSchoolYear ? (
                <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 md:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-charcoal">
                      School year <span className="text-red-600">*</span>
                    </span>
                    <div
                      className={editorialFieldClass({
                        invalid: !!state.errors?.schoolYearId,
                        className: "bg-light-gray text-warm-gray",
                      })}
                    >
                      <strong className="text-charcoal">{currentSchoolYear.label}</strong>
                      <span className="ml-2 text-sm">(active year only)</span>
                    </div>
                    {state.errors?.schoolYearId && (
                      <p className="mt-1 text-sm text-red-600">{state.errors.schoolYearId[0]}</p>
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
                      onChange={(e) => setDraft((d) => ({ ...d, gradeLevelId: e.target.value }))}
                      className={editorialFieldClass({ invalid: !!state.errors?.gradeLevelId })}
                    >
                      <option value="">Select grade level</option>
                      {gradeLevels.map((gl) => (
                        <option key={gl.id} value={gl.id}>
                          {gl.name}
                        </option>
                      ))}
                    </select>
                    {state.errors?.gradeLevelId && (
                      <p className="mt-1 text-sm text-red-600">{state.errors.gradeLevelId[0]}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-charcoal">Enrollment type</span>
                    <div
                      className={editorialFieldClass({
                        invalid: !!state.errors?.registrationStudentType,
                        className: "bg-light-gray",
                      })}
                    >
                      <strong>
                        {lockedRegistrationType === "transferee" ? "Transferee" : "New student"}
                      </strong>
                      <span className="ml-2 text-sm text-warm-gray">(set by the page you opened)</span>
                    </div>
                    {state.errors?.registrationStudentType && (
                      <p className="mt-1 text-sm text-red-600">
                        {state.errors.registrationStudentType[0]}
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

              {state.errors?.guardians && (
                <p className="text-sm text-red-600">{(state.errors.guardians as string[])[0]}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addGuardian}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-charcoal transition-colors hover:bg-light-gray"
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

            <div className="flex items-center justify-between border-t border-gray-200 pt-6">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1) as FormStep)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-warm-gray transition-colors hover:text-charcoal"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.min(4, prev + 1) as FormStep)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 py-2.5 font-medium text-white transition-colors hover:bg-red-700"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={disableSubmit}
                  className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Registering…" : "Register student"}
                </button>
              )}
            </div>
          </DataCardBody>
        </DataCard>
      </form>
    </div>
  );
}
