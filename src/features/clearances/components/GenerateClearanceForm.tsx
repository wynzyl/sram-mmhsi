"use client";

import { useState, useActionState } from "react";
import { generateClearanceAction } from "../clearances.actions";
import {
  CLEARANCE_TYPES,
  CLEARANCE_TYPE_LABELS,
  type ClearanceType,
} from "../clearances.schema";
import { useFormToast } from "@/hooks/useFormToast";
import { SelectField } from "@/components/forms/SelectField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Plus } from "lucide-react";

interface GenerateClearanceFormProps {
  studentId: string;
  enrollmentId?: string;
  schoolYearId?: string;
  onSuccess?: () => void;
}

export default function GenerateClearanceForm({
  studentId,
  enrollmentId,
  schoolYearId,
  onSuccess,
}: GenerateClearanceFormProps) {
  const [state, action, pending] = useActionState(generateClearanceAction, {});
  const [clearanceType, setClearanceType] = useState<ClearanceType | "">("");

  useFormToast(state, {
    successMessage: "Clearance record created successfully.",
    onSuccess,
  });

  const typeOptions = CLEARANCE_TYPES.map((type) => ({
    value: type,
    label: CLEARANCE_TYPE_LABELS[type],
  }));

  if (state.success) {
    return (
      <Card className="border-success/30 bg-success/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <p className="font-medium">Clearance record created.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" />
          Generate Clearance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          {enrollmentId && (
            <input type="hidden" name="enrollmentId" value={enrollmentId} />
          )}
          {schoolYearId && (
            <input type="hidden" name="schoolYearId" value={schoolYearId} />
          )}

          <SelectField
            label="Clearance Type"
            name="clearanceType"
            required
            value={clearanceType}
            onChange={(value) => setClearanceType(value as ClearanceType)}
            error={state.errors?.clearanceType}
            options={typeOptions}
            placeholder="Select clearance type..."
          />

          {state.errors?._form && (
            <p className="text-xs text-destructive">{state.errors._form.join(", ")}</p>
          )}

          {state.message && !state.success && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}

          <Button
            type="submit"
            disabled={pending || !clearanceType}
            className="w-full"
          >
            {pending ? "Creating..." : "Create Clearance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
