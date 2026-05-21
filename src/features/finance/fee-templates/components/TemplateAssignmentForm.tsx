"use client";

import { useActionState, useState } from "react";
import { assignTemplateToSchoolYearAction } from "../fee-templates.actions";
import { useFormToast } from "@/hooks/useFormToast";
import { SelectField } from "@/components/forms/SelectField";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";
import { Button } from "@/components/ui/button";

type FeeTemplate = {
  id: string;
  name: string;
  assessmentBand: string;
  items: Array<{
    id: string;
    defaultAmount: string;
    feeItemType: {
      name: string;
      isDiscount: boolean;
    };
  }>;
};

type SchoolYear = {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};

type TemplateAssignmentFormProps = {
  templates: FeeTemplate[];
  schoolYears: SchoolYear[];
};

export function TemplateAssignmentForm({
  templates,
  schoolYears,
}: TemplateAssignmentFormProps) {
  const [state, action, isPending] = useActionState(assignTemplateToSchoolYearAction, {});
  const [schoolYearId, setSchoolYearId] = useState("");
  const [assessmentBand, setAssessmentBand] = useState("");
  const [feeTemplateId, setFeeTemplateId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  useFormToast(state, {
    successMessage: "Template assigned successfully",
  });

  const filteredTemplates = templates.filter(
    (t) => !assessmentBand || t.assessmentBand === assessmentBand
  );

  const selectedTemplate = templates.find((t) => t.id === feeTemplateId);

  const handleSchoolYearChange = (value: string) => {
    const selectedSY = schoolYears.find((sy) => sy.id === value);
    setSchoolYearId(value);
    if (selectedSY) {
      // Format dates using local timezone to avoid off-by-one day issues
      const formatLocalDate = (date: Date | string) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      setEffectiveDate(formatLocalDate(selectedSY.startDate));
      setExpiryDate(formatLocalDate(selectedSY.endDate));
    }
  };

  const previewTotal = selectedTemplate
    ? selectedTemplate.items.reduce((sum, item) => {
        const amount = Number(item.defaultAmount);
        return item.feeItemType.isDiscount ? sum - amount : sum + amount;
      }, 0)
    : 0;

  return (
    <form action={action} className="fin-form-stack">
      <SelectField
        label="School Year"
        name="schoolYearId"
        required
        value={schoolYearId}
        onChange={handleSchoolYearChange}
        options={[
          { value: "", label: "Select school year..." },
          ...schoolYears.map((sy) => ({
            value: sy.id,
            label: `${sy.label}${sy.isActive ? " (Active)" : ""}`,
          })),
        ]}
        error={state.errors?.schoolYearId}
      />

      <SelectField
        label="Assessment Band"
        name="assessmentBand"
        required
        value={assessmentBand}
        onChange={(value) => {
          setAssessmentBand(value);
          setFeeTemplateId("");
        }}
        options={[
          { value: "", label: "Select assessment band..." },
          ...Object.entries(FEE_ASSESSMENT_BAND_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        error={state.errors?.assessmentBand}
      />

      <SelectField
        label="Fee Template"
        name="feeTemplateId"
        required
        value={feeTemplateId}
        onChange={setFeeTemplateId}
        options={[
          { value: "", label: assessmentBand ? "Select fee template..." : "Select a band first..." },
          ...filteredTemplates.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.items.length} items)`,
          })),
        ]}
        error={state.errors?.feeTemplateId}
        disabled={!assessmentBand}
      />

      {/* Date range */}
      <div className="fin-date-grid">
        <div className="form-group">
          <label htmlFor="effectiveDate" className="form-label">
            Effective Date <span className="required">*</span>
          </label>
          <input
            type="date"
            id="effectiveDate"
            name="effectiveDate"
            required
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="form-control"
          />
          <p className="fin-field-hint">When this schedule becomes active</p>
          {state.errors?.effectiveDate && (
            <p className="form-error">{state.errors.effectiveDate[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="expiryDate" className="form-label">
            Expiry Date{" "}
            <span style={{ color: "var(--color-ops-muted)", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <input
            type="date"
            id="expiryDate"
            name="expiryDate"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="form-control"
          />
          <p className="fin-field-hint">Leave blank for no expiry</p>
          {state.errors?.expiryDate && (
            <p className="form-error">{state.errors.expiryDate[0]}</p>
          )}
        </div>
      </div>

      {/* Template preview */}
      {selectedTemplate && (
        <div className="fin-preview-panel">
          <div className="fin-preview-head">
            <span className="fin-preview-label">Template Preview</span>
            <span className="fin-preview-name">{selectedTemplate.name}</span>
          </div>

          <div className="fin-preview-body">
            {selectedTemplate.items
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((item) => (
                <div key={item.id} className="fin-preview-row">
                  <span className="fin-preview-row-name">
                    {item.feeItemType.name}
                    {item.feeItemType.isDiscount && (
                      <span className="fin-disc-tag">DISC</span>
                    )}
                  </span>
                  <span className={`fin-preview-row-amount${item.feeItemType.isDiscount ? " fin-preview-row-discount" : ""}`}>
                    {item.feeItemType.isDiscount && "−"}
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(Number(item.defaultAmount))}
                  </span>
                </div>
              ))}
          </div>

          <div className="fin-preview-total-row">
            <span className="fin-preview-total-label">Total</span>
            <span className="fin-preview-total-value">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(previewTotal)}
            </span>
          </div>

          <p className="fin-preview-hint">
            You can add overrides for specific items after assigning this template.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="fin-form-actions fin-form-actions-border">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Assigning..." : "Assign Template"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
