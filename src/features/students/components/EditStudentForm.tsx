"use client";

import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Home, User, Users } from "lucide-react";
import { updateStudentAction } from "../students.actions";
import type { UpdateStudentFormState, GuardianInput } from "../students.schema";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { cn } from "@/lib/utils/cn";
import GuardianForm from "./GuardianForm";

interface StudentData {
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;

  lrn: string | null;
  mobileNumber: string | null;
  email: string | null;
  nationality: string | null;
  bloodType: string | null;
  religion: string | null;

  previousSchool: string | null;
  submittedDocumentsNotes: string | null;

  isActive: boolean;
}

interface EditStudentFormProps {
  student: StudentData;
  initialGuardians: GuardianInput[];
  /** When true, Active cannot be toggled (enforced server-side too). */
  isActiveLocked?: boolean;
  /** Client redirect after successful save (default admin student profile). */
  afterSaveRedirect?: string;
  /** Explicit cancel target (profile). */
  cancelHref: string;
}

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

const initialState: UpdateStudentFormState = {};

export default function EditStudentForm({
  student,
  initialGuardians,
  isActiveLocked = false,
  afterSaveRedirect,
  cancelHref,
}: EditStudentFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateStudentAction, initialState);
  const [guardians, setGuardians] = useState<GuardianInput[]>(
    initialGuardians.length > 0 ? initialGuardians : [{ ...emptyGuardian(), isPrimary: true }]
  );

  useEffect(() => {
    if (state.success) {
      router.push(afterSaveRedirect ?? `/staff/students/${student.id}`);
    }
  }, [state.success, student.id, router, afterSaveRedirect]);

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
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="studentId" value={student.id} />
      <input type="hidden" name="guardians" value={JSON.stringify(guardians)} />

      <FormStateAlert state={state} />

      <DataCard className="p-6">
        <h2 className="mb-5 flex items-center gap-3 border-b border-[var(--color-border)] pb-4 font-display text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-xl">
          <User className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          Student information
        </h2>
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
              defaultValue={student.firstName}
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
              defaultValue={student.middleName || ""}
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
              defaultValue={student.lastName}
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
            <select id="suffix" name="suffix" className="form-control" defaultValue={student.suffix || ""}>
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
              defaultValue={student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split("T")[0] : ""}
              required
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
              defaultValue={student.gender && student.gender !== "" ? student.gender : ""}
              required
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

        <div className="form-group mt-4">
          <label className="form-label" htmlFor="address">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            className="form-control"
            rows={2}
            defaultValue={student.address || ""}
          />
        </div>
      </DataCard>

      <DataCard className="p-6">
        <h2 className="mb-5 flex items-center gap-3 border-b border-[var(--color-border)] pb-4 font-display text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-xl">
          <Home className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          Contact &amp; additional information
        </h2>
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
              defaultValue={student.lrn || ""}
              placeholder="12-digit DepEd LRN"
              maxLength={12}
              pattern="[0-9]{12}"
            />
            {state.errors?.lrn && (
              <p className="form-error">{state.errors.lrn[0]}</p>
            )}
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
              defaultValue={student.mobileNumber || ""}
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
              defaultValue={student.email || ""}
              autoComplete="email"
              placeholder="student@example.com"
            />
            {state.errors?.email && (
              <p className="form-error">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="nationality">
              Nationality
            </label>
            <input
              id="nationality"
              name="nationality"
              type="text"
              className="form-control"
              defaultValue={student.nationality || ""}
              placeholder="Filipino"
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
              defaultValue={student.bloodType || ""}
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
              type="text"
              className="form-control"
              defaultValue={student.religion || ""}
              placeholder="Roman Catholic"
            />
          </div>
        </div>
      </DataCard>

      <DataCard className="p-6">
        <h2 className="mb-5 flex items-center gap-3 border-b border-[var(--color-border)] pb-4 font-display text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-xl">
          <FileText className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
          Registration / transfer notes
        </h2>
        <div className="form-group">
          <label className="form-label" htmlFor="previousSchool">
            Previous school
          </label>
          <input
            id="previousSchool"
            name="previousSchool"
            type="text"
            className="form-control"
            defaultValue={student.previousSchool || ""}
            placeholder="For transferee enrollments, record prior school before assessment"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="submittedDocumentsNotes">
            Submitted documents (notes)
          </label>
          <textarea
            id="submittedDocumentsNotes"
            name="submittedDocumentsNotes"
            className="form-control"
            rows={3}
            defaultValue={student.submittedDocumentsNotes || ""}
          />
        </div>
      </DataCard>

      <DataCard className="p-6">
        <h2 className="mb-4 font-display text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-xl">
          Record status
        </h2>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <div className="flex flex-row items-start gap-3">
            {isActiveLocked && (
              <input type="hidden" name="isActive" value={student.isActive ? "true" : "false"} />
            )}
            <input
              id="isActive"
              name={isActiveLocked ? undefined : "isActive"}
              type="checkbox"
              defaultChecked={student.isActive}
              disabled={isActiveLocked}
              className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-border-2)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30 disabled:cursor-not-allowed"
            />
            <div className="min-w-0">
              <label className="form-label m-0 cursor-pointer" htmlFor="isActive">
                Active student
              </label>
              {isActiveLocked ? (
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Active cannot be changed while this student has an enrollment in{" "}
                  <strong className="text-[var(--color-text)]">Enrolled</strong> status.
                </p>
              ) : null}
              {state.errors?.isActive?.[0] && (
                <p className="form-error mt-1" role="alert">
                  {state.errors.isActive[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      </DataCard>

      <DataCard className="p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <h2 className="flex items-center gap-3 font-display text-lg font-bold tracking-tight text-[var(--color-text)] sm:text-xl">
            <Users className="h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
            Parents / guardians
          </h2>
          <button
            type="button"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm transition-colors hover:bg-[var(--color-surface-2)]"
            onClick={addGuardian}
          >
            + Add guardian
          </button>
        </div>

        {state.errors?.guardians && (
          <p className="form-error mb-4">{(state.errors.guardians as string[])[0]}</p>
        )}

        <div className="guardian-list flex flex-col gap-4">
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
      </DataCard>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] pt-6">
        <Link
          href={cancelHref}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]",
            pending && "pointer-events-none opacity-50"
          )}
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="btn btn-primary"
          id="submit-student"
          disabled={pending}
        >
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </form>
  );
}
