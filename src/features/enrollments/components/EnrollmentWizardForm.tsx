"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createEnrollmentAction } from "../enrollments.actions";
import type { EnrollmentFormState } from "../enrollments.schema";
import { DataCard, DataCardBody } from "@/components/ui/editorial/DataCard";
import { useFormToast } from "@/hooks/useFormToast";
import { enrollmentIntakeDocumentsToPreserved } from "@/lib/utils/intake-documents";
import type { RegistrationEnrollmentContext } from "@/lib/types/registration-enrollment-context";
import { cn } from "@/lib/utils/cn";
import {
  EnrollmentStepper,
  type StepDescriptor,
} from "@/features/enrollments";
import {
  PlacementPreviewCard,
  type PlacementType,
} from "@/features/enrollments";
import type { StudentPickerOption } from "@/features/enrollments";
import { TYPE_LABEL, type WizardStep } from "../wizard.types";
import WizardFooter from "./WizardFooter";
import WizardStepStudent from "./WizardStepStudent";
import WizardStepPlacement from "./WizardStepPlacement";
import WizardStepIntakeAndReview from "./WizardStepIntakeAndReview";

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

export default function EnrollmentWizardForm({
  students,
  currentSchoolYear,
  gradeLevels,
  promotionByStudentId,
  registrationContextByStudentId: registrationContextByStudentIdProp,
  prefillStudentId,
  afterSuccessRedirect = "/staff/enrollments",
}: EnrollmentWizardFormProps) {
  // Memoize to prevent unstable reference in useMemo dependencies
  const registrationContextByStudentId = useMemo(
    () => registrationContextByStudentIdProp ?? {},
    [registrationContextByStudentIdProp]
  );

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
      setCurrentStep(1); // eslint-disable-line react-hooks/set-state-in-effect -- Navigate to error step
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

  useFormToast(state, {
    successMessage: "Enrollment created successfully",
    onSuccess: () => router.push(afterSuccessRedirect),
  });

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
                <WizardStepStudent
                  students={pickerOptions}
                  studentId={studentId}
                  onStudentChange={handleStudentChange}
                  errors={state.errors}
                />
              </div>

              <div className={cn(currentStep !== 2 && "hidden")}>
                <WizardStepPlacement
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
                <WizardStepIntakeAndReview
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
