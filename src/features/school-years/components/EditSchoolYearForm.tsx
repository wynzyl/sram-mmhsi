"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateSchoolYearAction } from "../school-years.actions";
import type { UpdateSchoolYearFormState } from "../school-years.schema";
import {
  GRADING_SYSTEM_TYPES,
  GRADING_SYSTEM_LABELS,
  type GradingSystemType,
} from "@/lib/constants/grading-systems";

interface SchoolYear {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  cashDiscountCutoffDate: Date | null;
}

interface EditSchoolYearFormProps {
  schoolYear: SchoolYear;
  gradingSystemType: GradingSystemType;
  redirectPath: string;
}

const initialState: UpdateSchoolYearFormState = {};

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EditSchoolYearForm({
  schoolYear,
  gradingSystemType,
  redirectPath,
}: EditSchoolYearFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateSchoolYearAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.replace(redirectPath);
    }
  }, [state.success, redirectPath, router]);

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
        <label className="form-label" htmlFor="gradingSystemType">
          Grading System
        </label>
        <select
          id="gradingSystemType"
          name="gradingSystemType"
          defaultValue={gradingSystemType}
          className={`form-control ${state.errors?.gradingSystemType ? "form-control-error" : ""}`}
        >
          {GRADING_SYSTEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {GRADING_SYSTEM_LABELS[type]}
            </option>
          ))}
        </select>
        {state.errors?.gradingSystemType && (
          <p className="form-error">{state.errors.gradingSystemType[0]}</p>
        )}
        <p className="form-hint">
          Determines which grading periods are used for grade entry. Quarterly uses Q1-Q4, Trimester uses T1-T3.
        </p>
      </div>

      <div className="form-group mt-4">
        <label className="form-label" htmlFor="cashDiscountCutoffDate">
          Cash Discount Cutoff Date
        </label>
        <input
          type="date"
          id="cashDiscountCutoffDate"
          name="cashDiscountCutoffDate"
          defaultValue={
            schoolYear.cashDiscountCutoffDate
              ? formatDateForInput(schoolYear.cashDiscountCutoffDate)
              : ""
          }
          className={`form-control ${state.errors?.cashDiscountCutoffDate ? "form-control-error" : ""}`}
        />
        {state.errors?.cashDiscountCutoffDate && (
          <p className="form-error">{state.errors.cashDiscountCutoffDate[0]}</p>
        )}
        <p className="form-hint">
          Students who pay their full balance before this date qualify for the
          full payment cash discount. Leave empty to disable the cash discount.
        </p>
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
