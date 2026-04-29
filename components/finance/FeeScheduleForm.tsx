"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFeeScheduleAction } from "@/actions/finance";
import type { FeeScheduleFormState } from "@/lib/validators/finance";

interface FeeScheduleFormProps {
  schoolYears: { id: string; label: string; isActive: boolean }[];
  gradeLevels: { id: string; name: string }[];
}

export default function FeeScheduleForm({
  schoolYears,
  gradeLevels,
}: FeeScheduleFormProps) {
  const router = useRouter();
  const initialState: FeeScheduleFormState = {};
  const [state, action, pending] = useActionState(createFeeScheduleAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/admin/finance/fee-schedules");
    }
  }, [state.success, router]);

  return (
    <form action={action} className="form-card">
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

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="schoolYearId">
            School Year <span className="required">*</span>
          </label>
          <select
            id="schoolYearId"
            name="schoolYearId"
            className={`form-control ${state.errors?.schoolYearId ? "form-control-error" : ""}`}
            required
          >
            <option value="">Select school year</option>
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.label} {sy.isActive ? "(Current)" : ""}
              </option>
            ))}
          </select>
          {state.errors?.schoolYearId && (
            <p className="form-error">{state.errors.schoolYearId[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="gradeLevelId">
            Grade Level <span className="required">*</span>
          </label>
          <select
            id="gradeLevelId"
            name="gradeLevelId"
            className={`form-control ${state.errors?.gradeLevelId ? "form-control-error" : ""}`}
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
        </div>
      </div>

      <div className="form-group mt-4">
        <label className="form-label" htmlFor="description">
          Description
        </label>
        <input
          type="text"
          id="description"
          name="description"
          className={`form-control ${state.errors?.description ? "form-control-error" : ""}`}
          placeholder="e.g., Standard Grade 7 Fees"
        />
        {state.errors?.description && (
          <p className="form-error">{state.errors.description[0]}</p>
        )}
      </div>

      <div className="form-group mt-4">
        <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={true}
          />
          <span>Active (Available for assessment generation)</span>
        </label>
      </div>

      <div className="form-actions mt-6" style={{ display: "flex", gap: "1rem" }}>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating..." : "Create Fee Schedule"}
        </button>
      </div>
    </form>
  );
}
