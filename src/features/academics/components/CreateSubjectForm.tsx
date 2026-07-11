"use client";

import { useActionState } from "react";
import { createSubjectAction } from "../subjects/subjects.actions";
import { useFormToast } from "@/hooks/useFormToast";

interface CreateSubjectFormProps {
  gradeLevels: { id: string; name: string }[];
  onSuccess?: () => void;
}

export default function CreateSubjectForm({
  gradeLevels,
  onSuccess,
}: CreateSubjectFormProps) {
  const [state, formAction, isPending] = useActionState(createSubjectAction, {});

  useFormToast(state, {
    successMessage: "Subject created successfully",
    onSuccess,
  });

  return (
    <form action={formAction} className="space-y-4">
      <div className="form-group">
        <label className="form-label">
          Grade Level <span className="required">*</span>
        </label>
        <select name="gradeLevelId" required className="form-control">
          <option value="">Select Grade Level</option>
          {gradeLevels.map((gl) => (
            <option key={gl.id} value={gl.id}>
              {gl.name}
            </option>
          ))}
        </select>
        {state.errors?.gradeLevelId && (
          <p className="form-error">{state.errors.gradeLevelId.join(", ")}</p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">
          Subject Code <span className="required">*</span>
        </label>
        <input
          type="text"
          name="code"
          required
          className="form-control"
          placeholder="e.g. MATH1"
        />
        {state.errors?.code && (
          <p className="form-error">{state.errors.code.join(", ")}</p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">
          Subject Name <span className="required">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          className="form-control"
          placeholder="e.g. Mathematics"
        />
        {state.errors?.name && (
          <p className="form-error">{state.errors.name.join(", ")}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Creating..." : "Create Subject"}
        </button>
      </div>
    </form>
  );
}
