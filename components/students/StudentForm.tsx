"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStudentAction } from "@/actions/students";
import type {
  CreateStudentFormFieldSnapshot,
  CreateStudentFormState,
  GuardianInput,
} from "@/lib/validators/student";
import GuardianForm from "./GuardianForm";
import IntakeRequirementsFieldset from "@/components/enrollments/IntakeRequirementsFieldset";

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

interface GradeLevelOption {
  id: string;
  name: string;
  order: number;
}

type StudentFormProps = {
  afterCreateStudentBasePath?: StudentProfileBase;
  /** Active school year only; registration is stored against this year. */
  currentSchoolYear: { id: string; label: string } | null;
  gradeLevels: GradeLevelOption[];
  /** From route: New Student vs Transferee — fixed for this submission. */
  lockedRegistrationType: "new_student" | "transferee";
};

export default function StudentForm({
  afterCreateStudentBasePath = "/admin/students",
  currentSchoolYear,
  gradeLevels,
  lockedRegistrationType,
}: StudentFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStudentAction, initialState);
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
      router.push(`${afterCreateStudentBasePath}/${state.studentId}`);
    }
  }, [state.success, state.studentId, router, afterCreateStudentBasePath]);

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

  return (
    <form action={action} className="student-form" noValidate>
      <input type="hidden" name="guardians" value={JSON.stringify(guardians)} />

      {state.message && (
        <div className="alert alert-error" role="alert">
          {state.message}
        </div>
      )}
      {state.errors?._form && (
        <div className="alert alert-error" role="alert">
          {state.errors._form.join(" ")}
        </div>
      )}

      {!currentSchoolYear && (
        <div className="alert alert-error" role="alert">
          No <strong>active</strong> school year is configured. Add or activate the current school year under{" "}
          <strong>School Years</strong> before registering students.
        </div>
      )}

      {lockedRegistrationType === "transferee" && (
        <div className="alert alert-info" role="note">
          <strong>Transferee:</strong> Enter the learner&apos;s last school in <strong>Previous school</strong> below.
          Enrollment type for this registration is fixed to <strong>Transferee</strong>.
        </div>
      )}

      <section className="form-section">
        <h3 className="form-section-title">Student Information</h3>
        <div className="form-grid form-grid-3">
          <div className="form-group">
            <label className="form-label" htmlFor="firstName">
              First Name <span className="required">*</span>
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              className={`form-control ${state.errors?.firstName ? "form-control-error" : ""}`}
              autoComplete="given-name"
              required
              value={draft.firstName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
            />
            {state.errors?.firstName && (
              <p className="form-error">{state.errors.firstName[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="middleName">
              Middle Name
            </label>
            <input
              id="middleName"
              name="middleName"
              type="text"
              className="form-control"
              autoComplete="additional-name"
              value={draft.middleName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, middleName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="lastName">
              Last Name <span className="required">*</span>
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              className={`form-control ${state.errors?.lastName ? "form-control-error" : ""}`}
              autoComplete="family-name"
              required
              value={draft.lastName ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
            />
            {state.errors?.lastName && (
              <p className="form-error">{state.errors.lastName[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="suffix">
              Suffix
            </label>
            <select
              id="suffix"
              name="suffix"
              className="form-control"
              value={draft.suffix ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, suffix: e.target.value }))}
            >
              <option value="">None</option>
              <option value="Jr.">Jr.</option>
              <option value="Sr.">Sr.</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="dateOfBirth">
              Date of Birth <span className="required">*</span>
            </label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              className={`form-control ${state.errors?.dateOfBirth ? "form-control-error" : ""}`}
              required
              value={draft.dateOfBirth ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, dateOfBirth: e.target.value }))}
            />
            {state.errors?.dateOfBirth && (
              <p className="form-error">{state.errors.dateOfBirth[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gender">
              Gender <span className="required">*</span>
            </label>
            <select
              id="gender"
              name="gender"
              className={`form-control ${state.errors?.gender ? "form-control-error" : ""}`}
              required
              value={draft.gender ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
            >
              <option value="" disabled>
                Select gender
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
            {state.errors?.gender && <p className="form-error">{state.errors.gender[0]}</p>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="address">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            className="form-control"
            rows={2}
            value={draft.address ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
          />
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Contact & Additional Information</h3>
        <div className="form-grid form-grid-3">
          <div className="form-group">
            <label className="form-label" htmlFor="lrn">
              Learner Reference Number (LRN)
            </label>
            <input
              id="lrn"
              name="lrn"
              type="text"
              className={`form-control ${state.errors?.lrn ? "form-control-error" : ""}`}
              placeholder="12-digit DepEd LRN"
              maxLength={12}
              value={draft.lrn ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, lrn: e.target.value }))}
            />
            {state.errors?.lrn && <p className="form-error">{state.errors.lrn[0]}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="mobileNumber">
              Mobile Number
            </label>
            <input
              id="mobileNumber"
              name="mobileNumber"
              type="tel"
              className={`form-control ${state.errors?.mobileNumber ? "form-control-error" : ""}`}
              placeholder="09171234567"
              autoComplete="tel"
              value={draft.mobileNumber ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, mobileNumber: e.target.value }))}
            />
            {state.errors?.mobileNumber && (
              <p className="form-error">{state.errors.mobileNumber[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`form-control ${state.errors?.email ? "form-control-error" : ""}`}
              autoComplete="email"
              placeholder="student@example.com"
              value={draft.email ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
            {state.errors?.email && <p className="form-error">{state.errors.email[0]}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="nationality">
              Nationality
            </label>
            <input
              id="nationality"
              name="nationality"
              className="form-control"
              placeholder="Filipino"
              value={draft.nationality ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, nationality: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bloodType">
              Blood Type
            </label>
            <select
              id="bloodType"
              name="bloodType"
              className="form-control"
              value={draft.bloodType ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, bloodType: e.target.value }))}
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

          <div className="form-group">
            <label className="form-label" htmlFor="religion">
              Religion
            </label>
            <input
              id="religion"
              name="religion"
              className="form-control"
              placeholder="Roman Catholic"
              value={draft.religion ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, religion: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Registration / transfer notes</h3>
        <p className="text-muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          For transferees, the previous school is required. Optional notes on hardcopy documents can go in{" "}
          <strong>Submitted documents</strong>.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="previousSchool">
            Previous school (transferees)
          </label>
          <input
            id="previousSchool"
            name="previousSchool"
            className={`form-control ${state.errors?.previousSchool ? "form-control-error" : ""}`}
            placeholder="Name of last school attended"
            value={draft.previousSchool ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, previousSchool: e.target.value }))}
          />
          {state.errors?.previousSchool && (
            <p className="form-error">{state.errors.previousSchool[0]}</p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="submittedDocumentsNotes">
            Submitted documents (notes)
          </label>
          <textarea
            id="submittedDocumentsNotes"
            name="submittedDocumentsNotes"
            className={`form-control ${state.errors?.submittedDocumentsNotes ? "form-control-error" : ""}`}
            rows={3}
            placeholder="e.g. Birth certificate on file, Form 137 pending"
            value={draft.submittedDocumentsNotes ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, submittedDocumentsNotes: e.target.value }))}
          />
          {state.errors?.submittedDocumentsNotes && (
            <p className="form-error">{state.errors.submittedDocumentsNotes[0]}</p>
          )}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-header">
          <h3 className="form-section-title">Parents / Guardians</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={addGuardian}>
            + Add Guardian
          </button>
        </div>

        {state.errors?.guardians && (
          <p className="form-error">{(state.errors.guardians as string[])[0]}</p>
        )}

        <div className="guardian-list">
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
      </section>

      {currentSchoolYear && (
      <section className="form-section">
        <input type="hidden" name="schoolYearId" value={currentSchoolYear.id} />
        <input type="hidden" name="registrationIntent" value={lockedRegistrationType} />
        <input type="hidden" name="registrationStudentType" value={lockedRegistrationType} />

        <h3 className="form-section-title">Application (current school year)</h3>
        <p className="text-muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          This records the official registration for the <strong>active</strong> school year. School year and
          enrollment type cannot be changed from this page; use the correct sidebar link (New vs Transferee) before
          you start.
        </p>

        <div className="form-grid form-grid-2">
          <div className="form-group">
            <span className="form-label">
              School year <span className="required">*</span>
            </span>
            <div
              className={`form-control ${state.errors?.schoolYearId ? "form-control-error" : ""}`}
              style={{ background: "var(--color-surface-2)" }}
              aria-live="polite"
            >
              {currentSchoolYear ? (
                <>
                  <strong>{currentSchoolYear.label}</strong>
                  <span className="text-muted ml-2">(active year only)</span>
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>
            {state.errors?.schoolYearId && (
              <p className="form-error">{state.errors.schoolYearId[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gradeLevelId">
              Grade level <span className="required">*</span>
            </label>
            <select
              id="gradeLevelId"
              name="gradeLevelId"
              className={`form-control ${state.errors?.gradeLevelId ? "form-control-error" : ""}`}
              required
              value={draft.gradeLevelId ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, gradeLevelId: e.target.value }))}
            >
              <option value="">Select grade level</option>
              {gradeLevels.map((gl) => (
                <option key={gl.id} value={gl.id}>
                  {gl.name}
                </option>
              ))}
            </select>
            {state.errors?.gradeLevelId && (
              <p className="form-error">{state.errors.gradeLevelId[0]}</p>
            )}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label">Enrollment type</span>
          <div
            className={`form-control ${state.errors?.registrationStudentType ? "form-control-error" : ""}`}
            style={{ background: "var(--color-surface-2)" }}
            aria-live="polite"
            id="student-registration-type-display"
          >
            <strong>{lockedRegistrationType === "transferee" ? "Transferee" : "New student"}</strong>
            <span className="text-muted ml-2">(set by the page you opened)</span>
          </div>
          {state.errors?.registrationStudentType && (
            <p className="form-error">{state.errors.registrationStudentType[0]}</p>
          )}
        </div>

        <IntakeRequirementsFieldset
          key={
            state.fieldValues
              ? `intake-${state.fieldValues.intakeForm138}-${state.fieldValues.intakeBirthCertificatePsa}-${state.fieldValues.intakeGoodMoralCharacter}-${state.fieldValues.intakeQualifiedVoucher}-${state.fieldValues.intakeEscCertificate}`
              : "intake"
          }
          errors={state.errors}
          legend="Requirements (new / transferee)"
          preserved={
            state.fieldValues
              ? {
                  intakeForm138: state.fieldValues.intakeForm138,
                  intakeBirthCertificatePsa: state.fieldValues.intakeBirthCertificatePsa,
                  intakeGoodMoralCharacter: state.fieldValues.intakeGoodMoralCharacter,
                  intakeQualifiedVoucher: state.fieldValues.intakeQualifiedVoucher,
                  intakeEscCertificate: state.fieldValues.intakeEscCertificate,
                }
              : undefined
          }
          description={
            <>
              Set each intake item to <strong>Received</strong>, <strong>Not applicable</strong>, or{" "}
              <strong>To follow</strong> when documents are still pending.
            </>
          }
        />
      </section>
      )}

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" id="submit-student" disabled={disableSubmit}>
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Saving...
            </>
          ) : (
            "Register Student"
          )}
        </button>
      </div>
    </form>
  );
}
