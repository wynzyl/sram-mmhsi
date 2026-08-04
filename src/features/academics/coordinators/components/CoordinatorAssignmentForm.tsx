"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { assignCoordinatorAction } from "../coordinators.actions";
import type {
  CoordinatorUserOption,
  AssignCoordinatorFormState,
} from "../coordinators.schema";
import { GRADE_GROUPS, GRADE_GROUP_LABELS, type GradeGroup } from "@/lib/constants/grade-groups";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface CoordinatorAssignmentFormProps {
  coordinators: CoordinatorUserOption[];
  schoolYears: SchoolYearOption[];
  assignedGroups: GradeGroup[];
  onClose: () => void;
}

export default function CoordinatorAssignmentForm({
  coordinators,
  schoolYears,
  assignedGroups,
  onClose,
}: CoordinatorAssignmentFormProps) {
  const router = useRouter();

  const [schoolYearId, setSchoolYearId] = useState(
    schoolYears.find((sy) => sy.isActive)?.id ?? ""
  );
  const [gradeGroup, setGradeGroup] = useState<GradeGroup | "">("");
  const [userId, setUserId] = useState("");

  const initialState: AssignCoordinatorFormState = {};

  const [state, action, pending] = useActionState(
    assignCoordinatorAction,
    initialState
  );

  useFormToast(state, {
    successMessage: "Coordinator assigned successfully",
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  // Filter out already assigned grade groups
  const availableGroups = GRADE_GROUPS.filter(
    (g) => !assignedGroups.includes(g)
  );

  return (
    <Modal
      open={true}
      onClose={onClose}
      aria-labelledby="coordinator-modal-title"
    >
      <ModalHeader onClose={onClose} kicker="Academics">
        <h2 id="coordinator-modal-title">Assign Coordinator</h2>
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
              onChange={(e) => setSchoolYearId(e.target.value)}
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

          {/* Grade Group */}
          <div className="space-y-2">
            <label
              htmlFor="gradeGroup"
              className="text-sm font-medium text-foreground"
            >
              Grade Group
            </label>
            <select
              id="gradeGroup"
              name="gradeGroup"
              value={gradeGroup}
              onChange={(e) => setGradeGroup(e.target.value as GradeGroup | "")}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
            >
              <option value="">Select Grade Group</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {GRADE_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
            {availableGroups.length === 0 && (
              <p className="text-xs text-muted-foreground">
                All grade groups have coordinators assigned for this school year.
              </p>
            )}
            {state.errors?.gradeGroup && (
              <p className="text-sm text-destructive">
                {state.errors.gradeGroup[0]}
              </p>
            )}
          </div>

          {/* Coordinator */}
          <div className="space-y-2">
            <label
              htmlFor="userId"
              className="text-sm font-medium text-foreground"
            >
              Coordinator
            </label>
            <select
              id="userId"
              name="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
            >
              <option value="">Select Coordinator</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
            {coordinators.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No users with coordinator role available. Create coordinator users first.
              </p>
            )}
            {state.errors?.userId && (
              <p className="text-sm text-destructive">
                {state.errors.userId[0]}
              </p>
            )}
          </div>

          {/* Form-level error */}
          {state.message && !state.success && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={!gradeGroup || !userId || coordinators.length === 0}
            >
              Assign Coordinator
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
