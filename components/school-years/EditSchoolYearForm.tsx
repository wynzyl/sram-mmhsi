"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSchoolYearAction } from "@/actions/school-years";
import type { UpdateSchoolYearFormState } from "@/lib/validators/school-year";

interface SchoolYear {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

interface EditSchoolYearFormProps {
  schoolYear: SchoolYear;
}

const initialState: UpdateSchoolYearFormState = {};

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EditSchoolYearForm({ schoolYear }: EditSchoolYearFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateSchoolYearAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/staff/school-years");
    }
  }, [state.success, router]);

  return (
    <form action={action} className="form-card" noValidate>
      <input type="hidden" name="schoolYearId" value={schoolYear.id} />

      {state.errors?._form && (
        <div className="alert alert-error mb-4">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div className="alert alert-error mb-4">{state.message}</div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="label">
          Label <span className="required">*</span>
        </label>
        <input
          type="text"
          id="label"
          name="label"
          defaultValue={schoolYear.label}
          className={`form-control ${state.errors?.label ? "form-control-error" : ""}`}
          required
        />
        {state.errors?.label && (
          <p className="form-error">{state.errors.label[0]}</p>
        )}
        <p className="form-hint">Format: YYYY-YYYY (e.g., 2024-2025)</p>
      </div>

      <div className="form-grid mt-4">
        <div className="form-group">
          <label className="form-label" htmlFor="startDate">
            Start Date <span className="required">*</span>
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            defaultValue={formatDateForInput(schoolYear.startDate)}
            className={`form-control ${state.errors?.startDate ? "form-control-error" : ""}`}
            required
          />
          {state.errors?.startDate && (
            <p className="form-error">{state.errors.startDate[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="endDate">
            End Date <span className="required">*</span>
          </label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            defaultValue={formatDateForInput(schoolYear.endDate)}
            className={`form-control ${state.errors?.endDate ? "form-control-error" : ""}`}
            required
          />
          {state.errors?.endDate && (
            <p className="form-error">{state.errors.endDate[0]}</p>
          )}
        </div>
      </div>

      <div className="form-group mt-4">
        <label className="form-checkbox">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            defaultChecked={schoolYear.isActive}
          />
          <span>Active school year</span>
        </label>
        <p className="form-hint">
          Note: Only one school year can be active at a time. Activating this will
          deactivate all other school years.
        </p>
      </div>

      <div className="form-actions mt-6" style={{ display: "flex", gap: "1rem" }}>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
