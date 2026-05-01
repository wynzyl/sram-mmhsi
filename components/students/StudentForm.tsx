"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStudentAction } from "@/actions/students";
import type { CreateStudentFormState } from "@/lib/validators/student";
import type { GuardianInput } from "@/lib/validators/student";
import GuardianForm from "./GuardianForm";

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

export default function StudentForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStudentAction, initialState);
  const [guardians, setGuardians] = useState<GuardianInput[]>([
    { ...emptyGuardian(), isPrimary: true },
  ]);

  useEffect(() => {
    if (state.success && state.studentId) {
      router.push(`/admin/students/${state.studentId}`);
    }
  }, [state.success, state.studentId, router]);

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
            />
            {state.errors?.lastName && (
              <p className="form-error">{state.errors.lastName[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="suffix">
              Suffix
            </label>
            <select id="suffix" name="suffix" className="form-control">
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
              Date of Birth
            </label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" className="form-control" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gender">
              Gender
            </label>
            <select id="gender" name="gender" className="form-control">
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="address">
            Address
          </label>
          <textarea id="address" name="address" className="form-control" rows={2} />
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
            />
            {state.errors?.email && <p className="form-error">{state.errors.email[0]}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="nationality">
              Nationality
            </label>
            <input id="nationality" name="nationality" className="form-control" placeholder="Filipino" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bloodType">
              Blood Type
            </label>
            <select id="bloodType" name="bloodType" className="form-control">
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
            <input id="religion" name="religion" className="form-control" placeholder="Roman Catholic" />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Registration / transfer notes</h3>
        <p className="text-muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          School year and grade are chosen when you create an enrollment, not here. For transferees,
          record the previous school so finance can validate before assessment.
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

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" id="submit-student" disabled={pending}>
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
