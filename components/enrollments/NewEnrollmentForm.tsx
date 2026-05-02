"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createEnrollmentAction } from "@/actions/enrollments";
import type { EnrollmentFormState } from "@/lib/validators/enrollment";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  referenceNumber: string;
}
interface SchoolYear {
  id: string;
  label: string;
}
interface GradeLevel {
  id: string;
  name: string;
  order: number;
}

type PromotionHint = {
  lastGradeLevelId: string;
  lastGradeName: string;
  nextGradeLevelId: string;
  hasNextGradeLevel: boolean;
};

interface NewEnrollmentFormProps {
  students: Student[];
  currentSchoolYear: SchoolYear | null;
  gradeLevels: GradeLevel[];
  promotionByStudentId: Record<string, PromotionHint>;
  prefillStudentId: string | null;
}

const initialState: EnrollmentFormState = {};

function promotedGradeIdForStudent(
  sid: string,
  promotionByStudentId: Record<string, PromotionHint>
): string {
  if (!sid) return "";
  const hint = promotionByStudentId[sid];
  if (!hint) return "";
  return hint.hasNextGradeLevel ? hint.nextGradeLevelId : hint.lastGradeLevelId;
}

function studentTypeForSelection(
  sid: string,
  promotionByStudentId: Record<string, PromotionHint>
): "new_student" | "transferee" | "old_student" {
  return sid && promotionByStudentId[sid] ? "old_student" : "new_student";
}

export default function NewEnrollmentForm({
  students,
  currentSchoolYear,
  gradeLevels,
  promotionByStudentId,
  prefillStudentId,
}: NewEnrollmentFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createEnrollmentAction, initialState);

  const initialStudentId = prefillStudentId ?? "";
  const [studentId, setStudentId] = useState(initialStudentId);
  const [studentType, setStudentType] = useState<
    "new_student" | "transferee" | "old_student"
  >(() => studentTypeForSelection(initialStudentId, promotionByStudentId));
  const [gradeLevelId, setGradeLevelId] = useState(() =>
    promotedGradeIdForStudent(initialStudentId, promotionByStudentId)
  );

  useEffect(() => {
    if (state.success && state.enrollmentId) {
      router.push(`/admin/enrollments`);
    }
  }, [state.success, state.enrollmentId, router]);

  const disableSubmit = !currentSchoolYear || pending;
  const promotionHint = studentId ? promotionByStudentId[studentId] : undefined;

  return (
    <form action={action} className="student-form" noValidate>
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
          No <strong>active</strong> school year is configured. Add or activate the current school year
          under School Years before enrolling students.
        </div>
      )}

      <section className="form-section">
        <h3 className="form-section-title">Enrollment Details</h3>

        {currentSchoolYear && (
          <input type="hidden" name="schoolYearId" value={currentSchoolYear.id} />
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="studentId">
            Student <span className="required">*</span>
          </label>
          <select
            id="studentId"
            name="studentId"
            className={`form-control ${state.errors?.studentId ? "form-control-error" : ""}`}
            value={studentId}
            onChange={(e) => {
              const id = e.target.value;
              setStudentId(id);
              setGradeLevelId(promotedGradeIdForStudent(id, promotionByStudentId));
              setStudentType(studentTypeForSelection(id, promotionByStudentId));
            }}
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
            <span className="form-label">
              School Year <span className="required">*</span>
            </span>
            <div
              className={`form-control ${state.errors?.schoolYearId ? "form-control-error" : ""}`}
              style={{ background: "var(--color-surface-2)" }}
              aria-live="polite"
            >
              {currentSchoolYear ? (
                <>
                  <strong>{currentSchoolYear.label}</strong>
                  <span className="text-muted ml-2">(current year only)</span>
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>
            {state.errors?.schoolYearId && (
              <p className="form-error">{state.errors.schoolYearId[0]}</p>
            )}
            <p className="form-hint text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
              Past school years cannot be selected for new enrollments.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="gradeLevelId">
              Grade Level <span className="required">*</span>
            </label>
            <select
              id="gradeLevelId"
              name="gradeLevelId"
              className={`form-control ${state.errors?.gradeLevelId ? "form-control-error" : ""}`}
              value={gradeLevelId}
              onChange={(e) => setGradeLevelId(e.target.value)}
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
            {promotionHint && (
              <p className="form-hint text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                {promotionHint.hasNextGradeLevel
                  ? `Prior enrollment (${promotionHint.lastGradeName}). Default grade is the next level — change only when appropriate.`
                  : `${promotionHint.lastGradeName} matches the highest grade in the catalog. Confirm with admin before enrolling again.`}
              </p>
            )}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label">
            Enrollment type <span className="required">*</span>
          </span>
          {promotionHint ? (
            <>
              <input type="hidden" name="studentType" value="old_student" />
              <div
                id="enrollment-type-display"
                className={`form-control ${state.errors?.studentType ? "form-control-error" : ""}`}
                style={{ background: "var(--color-surface-2)" }}
                aria-live="polite"
              >
                <strong>Old</strong>
                <span className="text-muted ml-2">(returning — prior enrollment on file)</span>
              </div>
              <p className="form-hint text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                Enrollment type is fixed for learners who already have a record in a previous school year.
              </p>
            </>
          ) : (
            <>
              <select
                id="studentType"
                name="studentType"
                className={`form-control ${state.errors?.studentType ? "form-control-error" : ""}`}
                value={studentType}
                onChange={(e) => {
                  setStudentType(e.target.value as typeof studentType);
                }}
                required
              >
                <option value="new_student">New</option>
                <option value="transferee">Transferee</option>
              </select>
              <p className="form-hint text-muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                Transferee enrollments require “Previous school” on the student profile.
              </p>
            </>
          )}
          {state.errors?.studentType && (
            <p className="form-error">{state.errors.studentType[0]}</p>
          )}
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
          disabled={disableSubmit}
        >
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" /> Creating...
            </>
          ) : (
            "Create Enrollment"
          )}
        </button>
      </div>
    </form>
  );
}
