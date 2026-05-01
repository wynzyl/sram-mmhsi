"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEnrollmentAction } from "@/actions/enrollments";
import type { EnrollmentFormState } from "@/lib/validators/enrollment";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  referenceNumber: string;
}
interface SchoolYear { id: string; label: string; isActive: boolean; }
interface GradeLevel { id: string; name: string; order: number; }

interface NewEnrollmentFormProps {
  students: Student[];
  schoolYears: SchoolYear[];
  gradeLevels: GradeLevel[];
  prefillStudentId: string | null;
  prefillSchoolYearId: string | null;
  prefillGradeLevelId: string | null;
}

const initialState: EnrollmentFormState = {};

export default function NewEnrollmentForm({
  students,
  schoolYears,
  gradeLevels,
  prefillStudentId,
  prefillSchoolYearId,
  prefillGradeLevelId,
}: NewEnrollmentFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createEnrollmentAction, initialState);

  useEffect(() => {
    if (state.success && state.enrollmentId) {
      router.push(`/admin/enrollments`);
    }
  }, [state.success, state.enrollmentId, router]);

  const activeYear = schoolYears.find((sy) => sy.isActive);

  return (
    <form action={action} className="student-form" noValidate>
      {state.message && (
        <div className="alert alert-error" role="alert">{state.message}</div>
      )}
      {state.errors?._form && (
        <div className="alert alert-error" role="alert">
          {state.errors._form.join(" ")}
        </div>
      )}

      <section className="form-section">
        <h3 className="form-section-title">Enrollment Details</h3>

        <div className="form-group">
          <label className="form-label" htmlFor="studentId">
            Student <span className="required">*</span>
          </label>
          <select
            id="studentId"
            name="studentId"
            className={`form-control ${state.errors?.studentId ? "form-control-error" : ""}`}
            defaultValue={prefillStudentId ?? ""}
            required
          >
            <option value="">— Select a student —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName}, {s.firstName} ({s.referenceNumber})
              </option>
            ))}
          </select>
          {state.errors?.studentId && (
            <p className="form-error">{state.errors.studentId[0]}</p>
          )}
        </div>

        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="schoolYearId">
              School Year <span className="required">*</span>
            </label>
            <select
              id="schoolYearId"
              name="schoolYearId"
              className={`form-control ${state.errors?.schoolYearId ? "form-control-error" : ""}`}
              defaultValue={prefillSchoolYearId ?? activeYear?.id ?? ""}
              required
            >
              <option value="">Select school year</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.label} {sy.isActive ? "(Current)" : ""}
                </option>
              ))}
            </select>
            {state.errors?.schoolYearId && (
              <p className="form-error">{state.errors.schoolYearId[0]}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gradeLevelId">
              Grade Level <span className="required">*</span>
            </label>
            <select
              id="gradeLevelId"
              name="gradeLevelId"
              className={`form-control ${state.errors?.gradeLevelId ? "form-control-error" : ""}`}
              defaultValue={prefillGradeLevelId ?? ""}
              required
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
          <label className="form-label" htmlFor="studentType">
            Enrollment student type <span className="required">*</span>
          </label>
          <select
            id="studentType"
            name="studentType"
            className={`form-control ${state.errors?.studentType ? "form-control-error" : ""}`}
            defaultValue="new_student"
            required
          >
            <option value="new_student">New student</option>
            <option value="transferee">Transferee</option>
            <option value="old_student">Returning (old student)</option>
          </select>
          {state.errors?.studentType && (
            <p className="form-error">{state.errors.studentType[0]}</p>
          )}
          <p className="form-hint text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Transferee enrollments require “Previous school” on the student profile.
          </p>
        </div>

        <div className="alert alert-info">
          The enrollment starts as <strong>Pending</strong>. Use{" "}
          <strong>Assessments → Awaiting assessment</strong> to build fees, then the cashier marks{" "}
          <strong>Enrolled</strong> after payment (or admin override).
        </div>
      </section>

      <div className="form-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          id="submit-enrollment"
          disabled={pending}
        >
          {pending ? (
            <><span className="spinner" aria-hidden="true" /> Creating...</>
          ) : (
            "Create Enrollment"
          )}
        </button>
      </div>
    </form>
  );
}
