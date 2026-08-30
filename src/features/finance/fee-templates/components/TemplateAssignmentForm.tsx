"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [state, action, isPending] = useActionState(assignTemplateToSchoolYearAction, {});
  const [schoolYearId, setSchoolYearId] = useState("");
  const [assessmentBand, setAssessmentBand] = useState("");
  const [feeTemplateId, setFeeTemplateId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  useFormToast(state, {
    successMessage: "Template assigned successfully",
    onSuccess: () => {
      // Navigate to the detail page of the newly created schedule
      if (state.scheduleId) {
        router.push(`/staff/finance/fee-schedules/${state.scheduleId}`);
      } else {
        router.push("/staff/finance/fee-schedules");
        router.refresh();
      }
    },
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
    <form action={action} className="flex flex-col gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
          <p className="text-xs text-muted-foreground mt-1">When this schedule becomes active</p>
          {state.errors?.effectiveDate && (
            <p className="form-error">{state.errors.effectiveDate[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="expiryDate" className="form-label">
            Expiry Date{" "}
            <span className="text-muted-foreground font-normal">
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
          <p className="text-xs text-muted-foreground mt-1">Leave blank for no expiry</p>
          {state.errors?.expiryDate && (
            <p className="form-error">{state.errors.expiryDate[0]}</p>
          )}
        </div>
      </div>

      {/* Template preview */}
      {selectedTemplate && (
        <div className="border border-border rounded-md overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-muted/50 border-b border-border">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template Preview</span>
            <span className="text-sm font-semibold text-foreground">{selectedTemplate.name}</span>
          </div>

          <div className="divide-y divide-border">
            {selectedTemplate.items
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((item) => (
                <div key={item.id} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-foreground">
                    {item.feeItemType.name}
                    {item.feeItemType.isDiscount && (
                      <span className="inline-flex ml-2 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-success bg-success/10 rounded">DISC</span>
                    )}
                  </span>
                  <span className={`text-sm font-medium tabular-nums ${item.feeItemType.isDiscount ? "text-success" : "text-foreground"}`}>
                    {item.feeItemType.isDiscount && "−"}
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(Number(item.defaultAmount))}
                  </span>
                </div>
              ))}
          </div>

          <div className="flex justify-between items-center px-4 py-3 bg-muted/50 border-t border-border">
            <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-primary">
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(previewTotal)}
            </span>
          </div>

          <p className="px-4 py-2 text-xs text-muted-foreground bg-muted/30">
            You can add overrides for specific items after assigning this template.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-border">
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
