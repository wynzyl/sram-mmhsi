"use client";

import { useActionState, useState } from "react";
import { createFeeTemplateAction } from "../fee-templates.actions";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { TextInputField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";
import { Button } from "@/components/ui/button";

export function FeeTemplateForm() {
  const [state, action, isPending] = useActionState(createFeeTemplateAction, {});
  const [name, setName] = useState("");
  const [assessmentBand, setAssessmentBand] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form action={action} className="space-y-6">
      <FormStateAlert state={state} />

      <div className="space-y-4">
        <TextInputField
          label="Template Name"
          name="name"
          required
          value={name}
          onChange={setName}
          placeholder="e.g., Standard Casa Fees 2024+"
          error={state.errors?.name}
        />

        <SelectField
          label="Assessment Band"
          name="assessmentBand"
          required
          value={assessmentBand}
          onChange={setAssessmentBand}
          options={[
            { value: "", label: "Select assessment band..." },
            ...Object.entries(FEE_ASSESSMENT_BAND_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
          error={state.errors?.assessmentBand}
        />

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-medium">
            Description <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Add any notes about this template..."
          />
          {state.errors?.description && (
            <p className="text-sm text-red-600">{state.errors.description[0]}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3 border-t pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Template"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
      </div>

      {state.success && state.templateId && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">
            Template created successfully! You can now add fee items to it.
          </p>
        </div>
      )}
    </form>
  );
}
