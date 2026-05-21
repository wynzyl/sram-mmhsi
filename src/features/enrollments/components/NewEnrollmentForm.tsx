"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createEnrollmentAction } from "../enrollments.actions";
import type { EnrollmentFormState } from "../enrollments.schema";
import { IntakeRequirementsFieldset } from "@/features/enrollments";
import { useFormToast } from "@/hooks/useFormToast";
import type { RegistrationEnrollmentContext } from "@/lib/types/registration-enrollment-context";
import { enrollmentIntakeDocumentsToPreserved } from "@/lib/utils/intake-documents";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  referenceNumber: string;
  previousSchool: string | null;
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
  registrationContextByStudentId?: Record<string, RegistrationEnrollmentContext>;
  prefillStudentId: string | null;
  /** Post-success client navigation target (default admin enrollments list). */
  afterSuccessRedirect?: string;
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

function gradeLevelIdForStudent(
  sid: string,
  promotionByStudentId: Record<string, PromotionHint>,
  registrationContextByStudentId: Record<string, RegistrationEnrollmentContext>
): string {
  if (!sid) return "";
  if (promotionByStudentId[sid]) {
    return promotedGradeIdForStudent(sid, promotionByStudentId);
  }
  const reg = registrationContextByStudentId[sid];
  return reg?.gradeLevelId ?? "";
}

function studentTypeForSelection(
  sid: string,
  promotionByStudentId: Record<string, PromotionHint>,
  registrationContextByStudentId: Record<string, RegistrationEnrollmentContext>
): "new_student" | "transferee" | "old_student" {
  if (sid && promotionByStudentId[sid]) return "old_student";
  const reg = sid ? registrationContextByStudentId[sid] : undefined;
  if (reg?.studentType === "new_student" || reg?.studentType === "transferee") {
    return reg.studentType;
  }
  return "new_student";
}

function previousSchoolDefaultForStudent(
  sid: string,
  studentList: Student[],
  promotionByStudentId: Record<string, PromotionHint>,
  registrationContextByStudentId: Record<string, RegistrationEnrollmentContext>
): string {
  const st = studentTypeForSelection(sid, promotionByStudentId, registrationContextByStudentId);
  if (st !== "transferee") return "";
  const s = studentList.find((x) => x.id === sid);
  return s?.previousSchool ?? "";
}

export default function NewEnrollmentForm({
  students,
  currentSchoolYear,
  gradeLevels,
  promotionByStudentId,
  registrationContextByStudentId: registrationContextByStudentIdProp,
  prefillStudentId,
  afterSuccessRedirect = "/staff/enrollments",
}: NewEnrollmentFormProps) {
  const registrationContextByStudentId = registrationContextByStudentIdProp ?? {};

  const router = useRouter();
  const [state, action, pending] = useActionState(createEnrollmentAction, initialState);

  const initialStudentId = prefillStudentId ?? "";
  const [studentId, setStudentId] = useState(initialStudentId);
  const [studentType, setStudentType] = useState<
    "new_student" | "transferee" | "old_student"
  >(() =>
    studentTypeForSelection(initialStudentId, promotionByStudentId, registrationContextByStudentId)
  );
  const [gradeLevelId, setGradeLevelId] = useState(() =>
    gradeLevelIdForStudent(initialStudentId, promotionByStudentId, registrationContextByStudentId)
  );
  const [previousSchoolInput, setPreviousSchoolInput] = useState(() =>
    previousSchoolDefaultForStudent(
      initialStudentId,
      students,
      promotionByStudentId,
      registrationContextByStudentId
    )
  );

  useFormToast(state, {
    successMessage: "Enrollment created successfully",
    onSuccess: () => router.push(afterSuccessRedirect),
  });

  const disableSubmit = !currentSchoolYear || pending;
  const promotionHint = studentId ? promotionByStudentId[studentId] : undefined;
  const regCtx = studentId ? registrationContextByStudentId[studentId] : undefined;

  const intakePreserved =
    regCtx?.intakeDocuments != null
      ? enrollmentIntakeDocumentsToPreserved(regCtx.intakeDocuments)
      : undefined;

  return (
    <form action={action} className="student-form">
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
        {regCtx && <input type="hidden" name="registrationId" value={regCtx.registrationId} />}

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
              setGradeLevelId(
                gradeLevelIdForStudent(id, promotionByStudentId, registrationContextByStudentId)
              );
              const nextType = studentTypeForSelection(
                id,
                promotionByStudentId,
                registrationContextByStudentId
              );
              setStudentType(nextType);
              if (nextType === "transferee") {
                const s = students.find((x) => x.id === id);
                setPreviousSchoolInput(s?.previousSchool ?? "");
              } else {
                setPreviousSchoolInput("");
              }
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
              className={`form-control bg-[var(--color-surface-2)] ${state.errors?.schoolYearId ? "form-control-error" : ""}`}
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
            {regCtx && currentSchoolYear && (
              <p className="form-hint text-muted text-sm mt-1">
                Same school year as the student&apos;s <strong>approved registration</strong>.
              </p>
            )}
            <p className="form-hint text-muted text-sm mt-1">
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
              <p className="form-hint text-muted text-sm mt-1">
                {promotionHint.hasNextGradeLevel
                  ? `Prior enrollment (${promotionHint.lastGradeName}). Default grade is the next level — change only when appropriate.`
                  : `${promotionHint.lastGradeName} matches the highest grade in the catalog. Confirm with admin before enrolling again.`}
              </p>
            )}
            {!promotionHint && regCtx && (
              <p className="form-hint text-muted text-sm mt-1">
                Default grade matches the <strong>approved registration</strong>; change if enrollment
                differs.
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
                className={`form-control bg-[var(--color-surface-2)] ${state.errors?.studentType ? "form-control-error" : ""}`}
                aria-live="polite"
              >
                <strong>Old</strong>
                <span className="text-muted ml-2">(returning — prior enrollment on file)</span>
              </div>
              <p className="form-hint text-muted text-sm mt-1">
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
                  const v = e.target.value as typeof studentType;
                  setStudentType(v);
                  if (v === "transferee" && studentId) {
                    const s = students.find((x) => x.id === studentId);
                    setPreviousSchoolInput(s?.previousSchool ?? "");
                  }
                  if (v === "new_student") setPreviousSchoolInput("");
                }}
                required
              >
                <option value="new_student">New</option>
                <option value="transferee">Transferee</option>
              </select>
              <p className="form-hint text-muted text-sm mt-1">
                For <strong>Transferee</strong>, enter the previous school below (saved on the student
                record).
              </p>
            </>
          )}
          {state.errors?.studentType && (
            <p className="form-error">{state.errors.studentType[0]}</p>
          )}
        </div>

        {Boolean(studentId) && !promotionHint && studentType === "transferee" && (
          <div className="form-group">
            <label className="form-label" htmlFor="previousSchool">
              Previous school <span className="required">*</span>
            </label>
            <input
              id="previousSchool"
              name="previousSchool"
              className={`form-control ${state.errors?.previousSchool ? "form-control-error" : ""}`}
              value={previousSchoolInput}
              onChange={(e) => setPreviousSchoolInput(e.target.value)}
              required
              autoComplete="organization"
              placeholder="Name of school last attended"
            />
            {state.errors?.previousSchool && (
              <p className="form-error">{state.errors.previousSchool[0]}</p>
            )}
          </div>
        )}

        {Boolean(studentId) &&
          !promotionHint &&
          (studentType === "new_student" || studentType === "transferee") && (
            <IntakeRequirementsFieldset
              key={`intake-${studentId}-${regCtx?.registrationId ?? "none"}`}
              errors={state.errors}
              preserved={intakePreserved}
              description={
                <>
                  Values below reflect the <strong>approved registration</strong> intake checklist for this
                  school year; adjust if documents changed since approval. Qualified Voucher and ESC
                  certificates are optional per learner; choose <strong>Not applicable</strong> when none
                  applies.
                </>
              }
            />
          )}

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
