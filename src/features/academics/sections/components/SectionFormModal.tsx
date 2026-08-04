"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSectionAction,
  updateSectionAction,
} from "../sections.actions";
import type {
  SectionView,
  CreateSectionFormState,
  UpdateSectionFormState,
} from "../sections.schema";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface SectionFormModalProps {
  section?: SectionView;
  gradeLevels: GradeLevelOption[];
  schoolYears: SchoolYearOption[];
  onClose: () => void;
}

export default function SectionFormModal({
  section,
  gradeLevels,
  schoolYears,
  onClose,
}: SectionFormModalProps) {
  const router = useRouter();
  const isEditing = !!section;

  // Form state
  const [name, setName] = useState(section?.name ?? "");
  const [gradeLevelId, setGradeLevelId] = useState(section?.gradeLevelId ?? "");
  const [schoolYearId, setSchoolYearId] = useState(
    section?.schoolYearId ?? schoolYears.find((sy) => sy.isActive)?.id ?? ""
  );

  const initialState: CreateSectionFormState | UpdateSectionFormState = {};

  const [state, action, pending] = useActionState(
    isEditing ? updateSectionAction : createSectionAction,
    initialState
  );

  useFormToast(state, {
    successMessage: isEditing
      ? "Section updated successfully"
      : "Section created successfully",
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  return (
    <Modal
      open={true}
      onClose={onClose}
      aria-labelledby="section-modal-title"
    >
      <ModalHeader onClose={onClose} kicker="Academics">
        <h2 id="section-modal-title">
          {isEditing ? "Edit Section" : "Create Section"}
        </h2>
      </ModalHeader>

      <ModalBody>
        <form action={action} className="space-y-4">
          {isEditing && (
            <input type="hidden" name="id" value={section.id} />
          )}

          {/* Section Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
            >
              Section Name
            </label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Section A"
              required
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              A unique name for this section (e.g., Section A, Sampaguita, Einstein)
            </p>
            {(state.errors as CreateSectionFormState["errors"])?.name && (
              <p className="text-sm text-destructive">
                {(state.errors as CreateSectionFormState["errors"])!.name![0]}
              </p>
            )}
          </div>

          {/* Grade Level */}
          <div className="space-y-2">
            <label
              htmlFor="gradeLevelId"
              className="text-sm font-medium text-foreground"
            >
              Grade Level
            </label>
            <select
              id="gradeLevelId"
              name="gradeLevelId"
              value={gradeLevelId}
              onChange={(e) => setGradeLevelId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
            >
              <option value="">Select Grade Level</option>
              {gradeLevels.map((gl) => (
                <option key={gl.id} value={gl.id}>
                  {gl.name}
                </option>
              ))}
            </select>
            {(state.errors as CreateSectionFormState["errors"])?.gradeLevelId && (
              <p className="text-sm text-destructive">
                {(state.errors as CreateSectionFormState["errors"])!.gradeLevelId![0]}
              </p>
            )}
          </div>

          {/* School Year */}
          <div className="space-y-2">
            <label
              htmlFor="schoolYearId"
              className="text-sm font-medium text-foreground"
            >
              School Year
            </label>
            <select
              id="schoolYearId"
              name="schoolYearId"
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
            {(state.errors as CreateSectionFormState["errors"])?.schoolYearId && (
              <p className="text-sm text-destructive">
                {(state.errors as CreateSectionFormState["errors"])!.schoolYearId![0]}
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
            <Button type="submit" variant="primary" loading={pending}>
              {isEditing ? "Save Changes" : "Create Section"}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
