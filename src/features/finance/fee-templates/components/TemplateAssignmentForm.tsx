"use client";

import { useActionState, useState } from "react";
import { assignTemplateToSchoolYearAction } from "../fee-templates.actions";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { SelectField } from "@/components/forms/SelectField";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";
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
  const [state, action, isPending] = useActionState(
    assignTemplateToSchoolYearAction,
    {}
  );
  const [schoolYearId, setSchoolYearId] = useState("");
  const [assessmentBand, setAssessmentBand] = useState("");
  const [feeTemplateId, setFeeTemplateId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // Filter templates by selected assessment band
  const filteredTemplates = templates.filter(
    (t) => !assessmentBand || t.assessmentBand === assessmentBand
  );

  // Get selected template for preview
  const selectedTemplate = templates.find((t) => t.id === feeTemplateId);

  // Auto-populate dates when school year is selected
  const handleSchoolYearChange = (value: string) => {
    const selectedSY = schoolYears.find((sy) => sy.id === value);
    setSchoolYearId(value);

    if (selectedSY) {
      setEffectiveDate(
        new Date(selectedSY.startDate).toISOString().split("T")[0]
      );
      setExpiryDate(new Date(selectedSY.endDate).toISOString().split("T")[0]);
    }
  };

  return (
    <form action={action} className="space-y-6">
      <FormStateAlert state={state} />

      <div className="space-y-4">
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
            setFeeTemplateId(""); // Reset template selection
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
            { value: "", label: "Select fee template..." },
            ...filteredTemplates.map((t) => ({
              value: t.id,
              label: `${t.name} (${t.items.length} items)`,
            })),
          ]}
          error={state.errors?.feeTemplateId}
          disabled={!assessmentBand}
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="effectiveDate" className="block text-sm font-medium">
              Effective Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              id="effectiveDate"
              name="effectiveDate"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-sm text-gray-500">When this schedule becomes active</p>
            {state.errors?.effectiveDate && (
              <p className="text-sm text-red-600">{state.errors.effectiveDate[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="expiryDate" className="block text-sm font-medium">
              Expiry Date <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="date"
              id="expiryDate"
              name="expiryDate"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-sm text-gray-500">
              When this schedule expires (leave blank for no expiry)
            </p>
            {state.errors?.expiryDate && (
              <p className="text-sm text-red-600">{state.errors.expiryDate[0]}</p>
            )}
          </div>
        </div>
      </div>

      {/* Template Preview */}
      {selectedTemplate && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <h4 className="mb-3 font-medium">Template Preview</h4>
          <div className="space-y-2">
            {selectedTemplate.items
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {item.feeItemType.name}
                    {item.feeItemType.isDiscount && (
                      <span className="ml-2 text-green-600">(Discount)</span>
                    )}
                  </span>
                  <span className="font-medium">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(Number(item.defaultAmount))}
                  </span>
                </div>
              ))}

            <div className="border-t pt-2">
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>
                  {new Intl.NumberFormat("en-PH", {
                    style: "currency",
                    currency: "PHP",
                  }).format(
                    selectedTemplate.items.reduce((sum, item) => {
                      const amount = Number(item.defaultAmount);
                      return item.feeItemType.isDiscount
                        ? sum - amount
                        : sum + amount;
                    }, 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-600">
            You can add overrides for specific items after assigning this template.
          </p>
        </div>
      )}

      <div className="flex gap-3 border-t pt-4">
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

      {state.success && state.scheduleId && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">
            Template assigned successfully! The fee schedule is now active for the selected
            school year and band.
          </p>
        </div>
      )}
    </form>
  );
}
