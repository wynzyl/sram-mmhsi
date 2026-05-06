"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  UserSearch,
} from "lucide-react";
import { createEnrollmentAction } from "@/actions/enrollments";
import type { EnrollmentFormState } from "@/lib/validators/enrollment";
import IntakeRequirementsFieldset from "@/components/enrollments/IntakeRequirementsFieldset";
import { DataCard, DataCardBody } from "@/components/ui/editorial/DataCard";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
import { enrollmentIntakeDocumentsToPreserved } from "@/lib/utils/intake-documents";
import type { RegistrationEnrollmentContext } from "@/lib/types/registration-enrollment-context";
import { cn } from "@/lib/utils/cn";
import {
  EnrollmentStepper,
  type StepDescriptor,
} from "@/components/enrollments/EnrollmentStepper";
import {
  PlacementPreviewCard,
  type PlacementType,
} from "@/components/enrollments/PlacementPreviewCard";
import {
  StudentPicker,
  type StudentPickerOption,
} from "@/components/enrollments/StudentPicker";

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

interface EnrollmentWizardFormProps {
  students: Student[];
  currentSchoolYear: SchoolYear | null;
  gradeLevels: GradeLevel[];
  promotionByStudentId: Record<string, PromotionHint>;
  registrationContextByStudentId?: Record<string, RegistrationEnrollmentContext>;
  prefillStudentId: string | null;
  /** Post-success client navigation target. */
  afterSuccessRedirect?: string;
}

type WizardStep = 1 | 2 | 3;

const STEPS: StepDescriptor[] = [
  {
    index: 1,
    title: "Student",
    description: "Pick the learner being enrolled.",
  },
  {
    index: 2,
    title: "Placement",
    description: "School year, grade, type.",
  },
  {
    index: 3,
    title: "Intake & Confirm",
    description: "Documents and final review.",
  },
];

const initialState: EnrollmentFormState = {};

function defaultStudentType(
  sid: string,
  promotionByStudentId: Record<string, PromotionHint>,
  registrationContextByStudentId: Record<string, RegistrationEnrollmentContext>
): PlacementType {
  if (sid && promotionByStudentId[sid]) return "old_student";
  const reg = sid ? registrationContextByStudentId[sid] : undefined;
  if (reg?.studentType === "new_student" || reg?.studentType === "transferee") {
    return reg.studentType;
  }
  return "new_student";
}

function defaultGradeLevelId(
  sid: string,
  promotionByStudentId: Record<string, PromotionHint>,
  registrationContextByStudentId: Record<string, RegistrationEnrollmentContext>
): string {
  if (!sid) return "";
  const hint = promotionByStudentId[sid];
  if (hint) return hint.hasNextGradeLevel ? hint.nextGradeLevelId : hint.lastGradeLevelId;
  const reg = registrationContextByStudentId[sid];
  return reg?.gradeLevelId ?? "";
}

function defaultPreviousSchool(
  sid: string,
  studentList: Student[],
  studentType: PlacementType
): string {
  if (studentType !== "transferee") return "";
  return studentList.find((x) => x.id === sid)?.previousSchool ?? "";
}

const TYPE_LABEL: Record<PlacementType, string> = {
  new_student: "New",
  transferee: "Transferee",
  old_student: "Returning",
};

export default function EnrollmentWizardForm({
  students,
  currentSchoolYear,
  gradeLevels,
  promotionByStudentId,
  registrationContextByStudentId: registrationContextByStudentIdProp,
  prefillStudentId,
  afterSuccessRedirect = "/admin/enrollments",
}: EnrollmentWizardFormProps) {
  const registrationContextByStudentId = registrationContextByStudentIdProp ?? {};

  const router = useRouter();
  const [state, action, pending] = useActionState(createEnrollmentAction, initialState);

  const initialStudentId = prefillStudentId ?? "";

  const [studentId, setStudentId] = useState(initialStudentId);
  const [studentType, setStudentType] = useState<PlacementType>(() =>
    defaultStudentType(initialStudentId, promotionByStudentId, registrationContextByStudentId)
  );
  const [gradeLevelId, setGradeLevelId] = useState(() =>
    defaultGradeLevelId(initialStudentId, promotionByStudentId, registrationContextByStudentId)
  );
  const [previousSchool, setPreviousSchool] = useState(() =>
    defaultPreviousSchool(
      initialStudentId,
      students,
      defaultStudentType(initialStudentId, promotionByStudentId, registrationContextByStudentId)
    )
  );

  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStudentId ? 2 : 1);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(initialStudentId ? 2 : 1);

  // Surface server-side errors by jumping back to the relevant step.
  useEffect(() => {
    const errs = state.errors;
    if (!errs) return;
    if (errs.studentId) {
      setCurrentStep(1);
    } else if (
      errs.gradeLevelId ||
      errs.schoolYearId ||
      errs.studentType ||
      errs.previousSchool
    ) {
      setCurrentStep(2);
    } else if (
      errs.intakeForm138 ||
      errs.intakeBirthCertificatePsa ||
      errs.intakeGoodMoralCharacter ||
      errs.intakeQualifiedVoucher ||
      errs.intakeEscCertificate
    ) {
      setCurrentStep(3);
    }
  }, [state.errors]);

  useEffect(() => {
    if (state.success && state.enrollmentId) {
      router.push(afterSuccessRedirect);
    }
  }, [state.success, state.enrollmentId, router, afterSuccessRedirect]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId]
  );
  const promotionHint = studentId ? promotionByStudentId[studentId] : undefined;
  const regCtx = studentId ? registrationContextByStudentId[studentId] : undefined;

  const lockedToOldStudent = Boolean(promotionHint);

  // Build picker options with inline context for each student row.
  const pickerOptions: StudentPickerOption[] = useMemo(
    () =>
      students.map<StudentPickerOption>((s) => {
        const type = defaultStudentType(
          s.id,
          promotionByStudentId,
          registrationContextByStudentId
        );
        const hint = promotionByStudentId[s.id];
        const reg = registrationContextByStudentId[s.id];
        let contextLabel: string | null = null;
        if (hint) {
          contextLabel = `Last grade: ${hint.lastGradeName}`;
        } else if (reg) {
          contextLabel = "Approved registration on file";
        }
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          referenceNumber: s.referenceNumber,
          typeLabel: TYPE_LABEL[type],
          contextLabel,
        };
      }),
    [students, promotionByStudentId, registrationContextByStudentId]
  );

  const gradeLevelName = useMemo(() => {
    if (!gradeLevelId) return null;
    return gradeLevels.find((g) => g.id === gradeLevelId)?.name ?? null;
  }, [gradeLevelId, gradeLevels]);

  const previewName = selectedStudent
    ? `${selectedStudent.lastName}, ${selectedStudent.firstName}`
    : null;

  const previewContextHint = lockedToOldStudent
    ? `Returning learner. ${
        promotionHint?.hasNextGradeLevel
          ? `Promoted from ${promotionHint.lastGradeName}.`
          : `${promotionHint?.lastGradeName} is the highest grade — confirm with admin.`
      }`
    : regCtx
    ? "Mirrors the approved registration for the active school year."
    : selectedStudent && !regCtx
    ? "No approved registration on file for this school year."
    : null;

  const handleStudentChange = (id: string) => {
    setStudentId(id);
    const nextType = defaultStudentType(
      id,
      promotionByStudentId,
      registrationContextByStudentId
    );
    setStudentType(nextType);
    setGradeLevelId(
      defaultGradeLevelId(id, promotionByStudentId, registrationContextByStudentId)
    );
    setPreviousSchool(defaultPreviousSchool(id, students, nextType));
  };

  const handleTypeChange = (next: PlacementType) => {
    setStudentType(next);
    if (next !== "transferee") {
      setPreviousSchool("");
    } else if (studentId) {
      setPreviousSchool(students.find((s) => s.id === studentId)?.previousSchool ?? "");
    }
  };

  const advanceTo = (step: WizardStep) => {
    setCurrentStep(step);
    setFurthestStep((prev) => (step > prev ? step : prev));
  };

  const canAdvanceFromStep1 = Boolean(studentId);
  const canAdvanceFromStep2 =
    Boolean(currentSchoolYear) &&
    Boolean(gradeLevelId) &&
    Boolean(studentType) &&
    (studentType !== "transferee" || previousSchool.trim().length > 0);

  const intakePreserved =
    regCtx?.intakeDocuments != null
      ? enrollmentIntakeDocumentsToPreserved(regCtx.intakeDocuments)
      : undefined;

  const showIntake =
    !lockedToOldStudent &&
    (studentType === "new_student" || studentType === "transferee");

  const disableSubmit = !currentSchoolYear || pending || !canAdvanceFromStep1 || !canAdvanceFromStep2;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left rail: vertical stepper */}
      <aside className="lg:col-span-3">
        <div className="lg:sticky lg:top-6">
          <EnrollmentStepper
            steps={STEPS}
            currentStep={currentStep}
            furthestStep={furthestStep}
            onStepClick={(i) => setCurrentStep(i as WizardStep)}
          />
        </div>
      </aside>

      {/* Center: wizard surface */}
      <section className="lg:col-span-6">
        <form action={action} noValidate className="space-y-4">
          {currentSchoolYear && (
            <input type="hidden" name="schoolYearId" value={currentSchoolYear.id} />
          )}
          {regCtx && (
            <input type="hidden" name="registrationId" value={regCtx.registrationId} />
          )}
          <input type="hidden" name="studentId" value={studentId} />
          <input
            type="hidden"
            name="studentType"
            value={lockedToOldStudent ? "old_student" : studentType}
          />
          <input type="hidden" name="gradeLevelId" value={gradeLevelId} />
          {studentType === "transferee" && !lockedToOldStudent && (
            <input type="hidden" name="previousSchool" value={previousSchool} />
          )}

          <FormStateAlert state={state} />

          {!currentSchoolYear && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                No <strong>active</strong> school year is configured. Add or activate the current school
                year under <strong>School Years</strong> before enrolling students.
              </p>
            </div>
          )}

          <DataCard>
            <DataCardBody className="px-6 py-6 sm:px-8 sm:py-8">
              {/* All steps stay mounted so uncontrolled radios in IntakeRequirementsFieldset preserve their state across navigation. */}
              <div className={cn(currentStep !== 1 && "hidden")}>
                <StepStudent
                  students={pickerOptions}
                  studentId={studentId}
                  onStudentChange={handleStudentChange}
                  errors={state.errors}
                />
              </div>

              <div className={cn(currentStep !== 2 && "hidden")}>
                <StepPlacement
                  currentSchoolYear={currentSchoolYear}
                  gradeLevels={gradeLevels}
                  gradeLevelId={gradeLevelId}
                  onGradeLevelChange={setGradeLevelId}
                  studentType={studentType}
                  onStudentTypeChange={handleTypeChange}
                  lockedToOldStudent={lockedToOldStudent}
                  promotionHint={promotionHint}
                  hasRegistrationContext={Boolean(regCtx)}
                  previousSchool={previousSchool}
                  onPreviousSchoolChange={setPreviousSchool}
                  errors={state.errors}
                />
              </div>

              <div className={cn(currentStep !== 3 && "hidden")}>
                <StepIntakeAndReview
                  showIntake={showIntake}
                  intakePreserved={intakePreserved}
                  errors={state.errors}
                  selectedStudentName={previewName}
                  referenceNumber={selectedStudent?.referenceNumber ?? null}
                  schoolYearLabel={currentSchoolYear?.label ?? null}
                  gradeLevelName={gradeLevelName}
                  studentType={lockedToOldStudent ? "old_student" : studentType}
                  previousSchool={
                    studentType === "transferee" && !lockedToOldStudent
                      ? previousSchool
                      : null
                  }
                />
              </div>

              <WizardFooter
                currentStep={currentStep}
                onBack={() => advanceTo((currentStep - 1) as WizardStep)}
                onContinue={() => advanceTo((currentStep + 1) as WizardStep)}
                onCancel={() => router.back()}
                canContinue={
                  currentStep === 1
                    ? canAdvanceFromStep1
                    : currentStep === 2
                    ? canAdvanceFromStep2
                    : true
                }
                pending={pending}
                disableSubmit={disableSubmit}
              />
            </DataCardBody>
          </DataCard>
        </form>
      </section>

      {/* Right rail: live placement preview */}
      <aside className="lg:col-span-3">
        <div className="lg:sticky lg:top-6">
          <PlacementPreviewCard
            studentName={previewName}
            referenceNumber={selectedStudent?.referenceNumber ?? null}
            schoolYearLabel={currentSchoolYear?.label ?? null}
            gradeLevelName={gradeLevelName}
            studentType={lockedToOldStudent ? "old_student" : studentType}
            contextHint={previewContextHint}
          />
        </div>
      </aside>
    </div>
  );
}

// ──────────────────────── Step components ────────────────────────

function StepHeader({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start gap-4 border-l-4 border-[var(--color-primary)] pl-5">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
        {icon}
      </span>
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-charcoal">
          {title}
        </h2>
        <p className="mt-1 text-sm text-warm-gray">{description}</p>
      </div>
    </header>
  );
}

function StepStudent({
  students,
  studentId,
  onStudentChange,
  errors,
}: {
  students: StudentPickerOption[];
  studentId: string;
  onStudentChange: (id: string) => void;
  errors?: EnrollmentFormState["errors"];
}) {
  return (
    <div>
      <StepHeader
        eyebrow="Step 01 / Student"
        title="Pick the learner"
        description="Search by family name or student reference. Suggestions auto-resolve type from prior records."
        icon={<UserSearch className="h-5 w-5" />}
      />

      <div className="space-y-2">
        <label
          htmlFor="studentId"
          className="mb-1.5 block text-sm font-medium text-charcoal"
        >
          Student <span className="text-red-600">*</span>
        </label>
        <StudentPicker
          students={students}
          value={studentId}
          onChange={onStudentChange}
          invalid={Boolean(errors?.studentId)}
          errorMessage={errors?.studentId?.[0]}
        />
        <p className="text-xs leading-relaxed text-warm-gray">
          Only active students appear. To enroll a new arrival, register them first under{" "}
          <strong className="text-charcoal">Registrations</strong>.
        </p>
      </div>
    </div>
  );
}

function StepPlacement({
  currentSchoolYear,
  gradeLevels,
  gradeLevelId,
  onGradeLevelChange,
  studentType,
  onStudentTypeChange,
  lockedToOldStudent,
  promotionHint,
  hasRegistrationContext,
  previousSchool,
  onPreviousSchoolChange,
  errors,
}: {
  currentSchoolYear: SchoolYear | null;
  gradeLevels: GradeLevel[];
  gradeLevelId: string;
  onGradeLevelChange: (v: string) => void;
  studentType: PlacementType;
  onStudentTypeChange: (v: PlacementType) => void;
  lockedToOldStudent: boolean;
  promotionHint?: PromotionHint;
  hasRegistrationContext: boolean;
  previousSchool: string;
  onPreviousSchoolChange: (v: string) => void;
  errors?: EnrollmentFormState["errors"];
}) {
  const promotionMessage = promotionHint
    ? promotionHint.hasNextGradeLevel
      ? `Prior enrollment: ${promotionHint.lastGradeName}. Default is the next level — change only when appropriate.`
      : `${promotionHint.lastGradeName} matches the highest grade in the catalog. Confirm with admin.`
    : hasRegistrationContext
    ? "Default grade matches the approved registration; change if enrollment differs."
    : null;

  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 02 / Placement"
        title="Confirm academic placement"
        description="Active school year is fixed. Set grade and enrollment type before continuing."
        icon={<GraduationCap className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-charcoal">
            School Year <span className="text-red-600">*</span>
          </span>
          <div
            className={editorialFieldClass({
              invalid: Boolean(errors?.schoolYearId),
              className: "bg-light-gray",
            })}
            aria-live="polite"
          >
            {currentSchoolYear ? (
              <>
                <strong className="text-charcoal">{currentSchoolYear.label}</strong>
                <span className="ml-2 text-xs text-warm-gray">(active year only)</span>
              </>
            ) : (
              <span className="text-warm-gray">—</span>
            )}
          </div>
          {errors?.schoolYearId && (
            <p className="mt-1 text-sm text-red-600">{errors.schoolYearId[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="gradeLevelIdSelect"
            className="mb-1.5 block text-sm font-medium text-charcoal"
          >
            Grade Level <span className="text-red-600">*</span>
          </label>
          <select
            id="gradeLevelIdSelect"
            value={gradeLevelId}
            onChange={(e) => onGradeLevelChange(e.target.value)}
            required
            className={editorialFieldClass({ invalid: Boolean(errors?.gradeLevelId) })}
          >
            <option value="">Select grade level</option>
            {gradeLevels.map((gl) => (
              <option key={gl.id} value={gl.id}>
                {gl.name}
              </option>
            ))}
          </select>
          {errors?.gradeLevelId && (
            <p className="mt-1 text-sm text-red-600">{errors.gradeLevelId[0]}</p>
          )}
          {promotionMessage && (
            <p className="mt-1 text-xs leading-relaxed text-warm-gray">{promotionMessage}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className="mb-1.5 block text-sm font-medium text-charcoal">
          Enrollment Type <span className="text-red-600">*</span>
        </span>

        {lockedToOldStudent ? (
          <div
            className={editorialFieldClass({
              invalid: Boolean(errors?.studentType),
              className: "bg-light-gray",
            })}
          >
            <strong className="text-charcoal">Returning</strong>
            <span className="ml-2 text-xs text-warm-gray">(prior enrollment on file — fixed)</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TypeRadioCard
              label="New"
              caption="First time at this school."
              checked={studentType === "new_student"}
              onChange={() => onStudentTypeChange("new_student")}
              suggested={!hasRegistrationContext && studentType === "new_student"}
            />
            <TypeRadioCard
              label="Transferee"
              caption="Coming from another school."
              checked={studentType === "transferee"}
              onChange={() => onStudentTypeChange("transferee")}
              suggested={hasRegistrationContext && studentType === "transferee"}
            />
          </div>
        )}
        {errors?.studentType && (
          <p className="mt-1 text-sm text-red-600">{errors.studentType[0]}</p>
        )}
      </div>

      {!lockedToOldStudent && studentType === "transferee" && (
        <div>
          <label
            htmlFor="previousSchoolInput"
            className="mb-1.5 block text-sm font-medium text-charcoal"
          >
            Previous school <span className="text-red-600">*</span>
          </label>
          <input
            id="previousSchoolInput"
            value={previousSchool}
            onChange={(e) => onPreviousSchoolChange(e.target.value)}
            placeholder="Name of school last attended"
            autoComplete="organization"
            required
            className={editorialFieldClass({ invalid: Boolean(errors?.previousSchool) })}
          />
          {errors?.previousSchool && (
            <p className="mt-1 text-sm text-red-600">{errors.previousSchool[0]}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TypeRadioCard({
  label,
  caption,
  checked,
  onChange,
  suggested,
}: {
  label: string;
  caption: string;
  checked: boolean;
  onChange: () => void;
  suggested: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={cn(
        "group flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/15",
        checked
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.04] shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={cn(
            "font-display text-base font-bold",
            checked ? "text-[var(--color-primary)]" : "text-charcoal"
          )}
        >
          {label}
        </span>
        {suggested && (
          <span className="rounded-full bg-[var(--color-accent-amber)]/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent-amber)]">
            Suggested
          </span>
        )}
      </div>
      <span className="text-xs leading-relaxed text-warm-gray">{caption}</span>
    </button>
  );
}

function StepIntakeAndReview({
  showIntake,
  intakePreserved,
  errors,
  selectedStudentName,
  referenceNumber,
  schoolYearLabel,
  gradeLevelName,
  studentType,
  previousSchool,
}: {
  showIntake: boolean;
  intakePreserved: ReturnType<typeof enrollmentIntakeDocumentsToPreserved> | undefined;
  errors?: EnrollmentFormState["errors"];
  selectedStudentName: string | null;
  referenceNumber: string | null;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  studentType: PlacementType;
  previousSchool: string | null;
}) {
  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 03 / Confirm"
        title="Intake & final review"
        description="Set the document checklist (when applicable), confirm the placement, and create the enrollment."
        icon={<ClipboardCheck className="h-5 w-5" />}
      />

      {showIntake ? (
        <IntakeRequirementsFieldset
          key={`intake-${selectedStudentName ?? "none"}-${studentType}`}
          errors={errors}
          preserved={intakePreserved}
          legend="Requirements (new / transferee)"
          description={
            <>
              Set each item to <strong>Received</strong>, <strong>Not applicable</strong>, or{" "}
              <strong>To follow</strong> when documents are still pending. Voucher and ESC certificates
              are optional per learner.
            </>
          }
        />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-light-gray/50 p-5">
          <p className="text-sm text-warm-gray">
            <strong className="text-charcoal">Returning learners</strong> reuse intake records from
            their original registration — no new checklist required.
          </p>
        </div>
      )}

      <ReviewSummary
        selectedStudentName={selectedStudentName}
        referenceNumber={referenceNumber}
        schoolYearLabel={schoolYearLabel}
        gradeLevelName={gradeLevelName}
        studentType={studentType}
        previousSchool={previousSchool}
      />

      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-accent-amber)]/30 bg-[var(--color-accent-amber)]/[0.06] p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-amber)]" />
        <p className="text-charcoal">
          The enrollment will be created as <strong>Pending</strong>. The next step in the workflow is
          building the assessment — fees and the official receipt are recorded separately by the
          finance officer and cashier.
        </p>
      </div>
    </div>
  );
}

function ReviewSummary({
  selectedStudentName,
  referenceNumber,
  schoolYearLabel,
  gradeLevelName,
  studentType,
  previousSchool,
}: {
  selectedStudentName: string | null;
  referenceNumber: string | null;
  schoolYearLabel: string | null;
  gradeLevelName: string | null;
  studentType: PlacementType;
  previousSchool: string | null;
}) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Student", value: selectedStudentName ?? "—" },
    { label: "Reference", value: referenceNumber ?? "—" },
    { label: "School Year", value: schoolYearLabel ?? "—" },
    { label: "Grade Level", value: gradeLevelName ?? "—" },
    { label: "Type", value: TYPE_LABEL[studentType] },
  ];
  if (studentType === "transferee" && previousSchool) {
    rows.push({ label: "Previous School", value: previousSchool });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <CheckCircle2 className="h-4 w-4 text-[var(--color-accent-emerald)]" />
        <h3 className="font-display text-base font-bold text-charcoal">
          Confirm placement before saving
        </h3>
      </div>
      <dl className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-3 gap-4 px-5 py-3 text-sm"
          >
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-warm-gray">
              {row.label}
            </dt>
            <dd
              className={cn(
                "col-span-2 text-charcoal",
                row.label === "Reference" && "font-mono",
                row.label === "Student" && "font-display text-base font-semibold uppercase"
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function WizardFooter({
  currentStep,
  onBack,
  onContinue,
  onCancel,
  canContinue,
  pending,
  disableSubmit,
}: {
  currentStep: WizardStep;
  onBack: () => void;
  onContinue: () => void;
  onCancel: () => void;
  canContinue: boolean;
  pending: boolean;
  disableSubmit: boolean;
}) {
  const isFinalStep = currentStep === 3;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-warm-gray transition-colors hover:bg-light-gray hover:text-charcoal disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-warm-gray transition-colors hover:bg-light-gray hover:text-charcoal disabled:opacity-50"
        >
          Cancel
        </button>
      )}

      {isFinalStep ? (
        <button
          type="submit"
          disabled={disableSubmit}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all",
            "bg-[var(--color-primary)] hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {pending ? (
            <>
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
              Creating enrollment…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Confirm & create enrollment
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || pending}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all",
            "bg-[var(--color-primary)] hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
