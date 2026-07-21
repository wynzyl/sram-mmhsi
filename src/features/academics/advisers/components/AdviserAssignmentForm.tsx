"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { assignAdviserAction } from "../advisers.actions";
import type {
  SectionOption,
  TeacherOption,
  AssignAdviserFormState,
} from "../advisers.schema";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface AdviserAssignmentFormProps {
  sections: SectionOption[];
  teachers: TeacherOption[];
  schoolYears: SchoolYearOption[];
  onClose: () => void;
}

export default function AdviserAssignmentForm({
  sections,
  teachers,
  schoolYears,
  onClose,
}: AdviserAssignmentFormProps) {
  const router = useRouter();

  // Form state
  const [schoolYearId, setSchoolYearId] = useState(
    schoolYears.find((sy) => sy.isActive)?.id ?? ""
  );
  const [sectionId, setSectionId] = useState("");
  const [userId, setUserId] = useState("");

  const initialState: AssignAdviserFormState = {};

  const [state, action, pending] = useActionState(
    assignAdviserAction,
    initialState
  );

  useFormToast(state, {
    successMessage: "Adviser assigned successfully",
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  // Filter sections by selected school year and without advisers
  const availableSections = sections.filter(
    (s) => s.schoolYearId === schoolYearId && !s.hasAdviser
  );

  return (
    <Modal
      open={true}
      onClose={onClose}
      aria-labelledby="adviser-modal-title"
    >
      <ModalHeader onClose={onClose} kicker="Academics">
        <h2 id="adviser-modal-title">Assign Section Adviser</h2>
      </ModalHeader>

      <ModalBody>
        <form action={action} className="space-y-4">
          <input type="hidden" name="schoolYearId" value={schoolYearId} />

          {/* School Year */}
          <div className="space-y-2">
            <label
              htmlFor="schoolYearSelect"
              className="text-sm font-medium text-foreground"
            >
              School Year
            </label>
            <select
              id="schoolYearSelect"
              value={schoolYearId}
              onChange={(e) => {
                setSchoolYearId(e.target.value);
                setSectionId(""); // Reset section when year changes
              }}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
            >
              <option value="">Select School Year</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.label} {sy.isActive && "(Active)"}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="space-y-2">
            <label
              htmlFor="sectionId"
              className="text-sm font-medium text-foreground"
            >
              Section
            </label>
            <select
              id="sectionId"
              name="sectionId"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              required
              disabled={!schoolYearId}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm disabled:opacity-50"
            >
              <option value="">Select Section</option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.gradeLevelName} - {s.name}
                </option>
              ))}
            </select>
            {availableSections.length === 0 && schoolYearId && (
              <p className="text-xs text-muted-foreground">
                All sections in this school year already have advisers assigned.
              </p>
            )}
            {state.errors?.sectionId && (
              <p className="text-sm text-destructive">
                {state.errors.sectionId[0]}
              </p>
            )}
          </div>

          {/* Teacher */}
          <div className="space-y-2">
            <label
              htmlFor="userId"
              className="text-sm font-medium text-foreground"
            >
              Teacher
            </label>
            <select
              id="userId"
              name="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
            >
              <option value="">Select Teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
            {teachers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No teachers available. Create teacher users first.
              </p>
            )}
            {state.errors?.userId && (
              <p className="text-sm text-destructive">
                {state.errors.userId[0]}
              </p>
            )}
          </div>

          {/* Form-level errors are shown via useFormToast, field errors stay inline */}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={!sectionId || !userId || teachers.length === 0}
            >
              Assign Adviser
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
