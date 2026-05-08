"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFeeScheduleAction } from "@/actions/finance";
import type { FeeScheduleFormState } from "@/lib/validators/finance";
import { FEE_ASSESSMENT_BANDS, FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";

interface FeeScheduleFormProps {
  schoolYears: { id: string; label: string; isActive: boolean }[];
}

export default function FeeScheduleForm({ schoolYears }: FeeScheduleFormProps) {
  const router = useRouter();
  const initialState: FeeScheduleFormState = {};
  const [state, action, pending] = useActionState(createFeeScheduleAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/staff/finance/fee-schedules");
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

      <p className="text-muted mb-4" style={{ fontSize: "0.92rem" }}>
        This catalog applies only to the assessment band you choose (matched from the student’s grade
        level). Add fee lines on the next screen after you create the schedule.
      </p>

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
          <label className="form-label" htmlFor="assessmentBand">
            Assessment band <span className="required">*</span>
          </label>
          <select
            id="assessmentBand"
            name="assessmentBand"
            className={`form-control ${state.errors?.assessmentBand ? "form-control-error" : ""}`}
            required
          >
            <option value="">Select band</option>
            {FEE_ASSESSMENT_BANDS.map((band) => (
              <option key={band} value={band}>
                {FEE_ASSESSMENT_BAND_LABELS[band]}
              </option>
            ))}
          </select>
          {state.errors?.assessmentBand && (
            <p className="form-error">{state.errors.assessmentBand[0]}</p>
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
          placeholder="e.g. SY 2026–2027 standard fees (all grades)"
        />
        {state.errors?.description && (
          <p className="form-error">{state.errors.description[0]}</p>
        )}
      </div>

      <div className="form-group mt-4">
        <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="isActive" defaultChecked={true} />
          <span>Active (available for assessments)</span>
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
