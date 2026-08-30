"use client";

import { useState, useActionState } from "react";
import { resolveClearanceAction } from "../clearances.actions";
import {
  RESOLUTION_TYPES,
  RESOLUTION_TYPE_LABELS,
  type ResolutionType,
} from "../clearances.schema";
import { useFormToast } from "@/hooks/useFormToast";
import { TextAreaField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { CheckCircle } from "lucide-react";

interface ResolveClearanceFormProps {
  clearanceId: string;
  outstandingAmount: number;
  onSuccess?: () => void;
}

export default function ResolveClearanceForm({
  clearanceId,
  outstandingAmount,
  onSuccess,
}: ResolveClearanceFormProps) {
  const [state, action, pending] = useActionState(resolveClearanceAction, {});
  const [resolutionType, setResolutionType] = useState<ResolutionType | "">("");
  const [resolutionRemarks, setResolutionRemarks] = useState("");

  useFormToast(state, {
    successMessage: "Clearance resolved successfully.",
    onSuccess,
  });

  const resolutionOptions = RESOLUTION_TYPES.map((type) => ({
    value: type,
    label: RESOLUTION_TYPE_LABELS[type],
  }));

  const requiresRemarks = resolutionType === "waived" || resolutionType === "written_off";

  if (state.success) {
    return (
      <Card className="border-success/30 bg-success/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <p className="font-medium">Clearance resolved successfully.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolve Clearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">Outstanding Amount</p>
          <p className="text-2xl font-bold text-warning">
            <CurrencyDisplay amount={outstandingAmount} />
          </p>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="clearanceId" value={clearanceId} />

          <SelectField
            label="Resolution Type"
            name="resolutionType"
            required
            value={resolutionType}
            onChange={(value) => setResolutionType(value as ResolutionType)}
            error={state.errors?.resolutionType}
            options={resolutionOptions}
            placeholder="Select resolution..."
          />

          {resolutionType && (
            <div className={cn(
              "rounded-md p-3 text-sm",
              resolutionType === "paid" ? "bg-success/10 text-success" :
              resolutionType === "waived" ? "bg-info-tint text-info" :
              "bg-warning-tint text-warning"
            )}>
              {resolutionType === "paid" && (
                <p>
                  <strong>Paid:</strong> The student has settled the outstanding balance.
                  Make sure payment has been recorded in the system before marking as paid.
                </p>
              )}
              {resolutionType === "waived" && (
                <p>
                  <strong>Waived:</strong> The balance is being forgiven (scholarship, hardship, etc.).
                  A reason is required for audit purposes.
                </p>
              )}
              {resolutionType === "written_off" && (
                <p>
                  <strong>Written Off:</strong> The balance is being recorded as uncollectible.
                  A reason is required for audit purposes.
                </p>
              )}
            </div>
          )}

          <TextAreaField
            label={requiresRemarks ? "Reason (required)" : "Notes (optional)"}
            name="resolutionRemarks"
            required={requiresRemarks}
            value={resolutionRemarks}
            onChange={setResolutionRemarks}
            error={state.errors?.resolutionRemarks}
            rows={3}
            placeholder={
              requiresRemarks
                ? "Please provide a reason for waiving/writing off the balance (minimum 10 characters)..."
                : "Any additional notes..."
            }
          />

          {state.errors?._form && (
            <p className="text-xs text-destructive">{state.errors._form.join(", ")}</p>
          )}

          {state.message && !state.success && (
            <p className="text-xs text-destructive">{state.message}</p>
          )}

          <Button
            type="submit"
            disabled={pending || !resolutionType}
            className="w-full"
          >
            {pending ? "Resolving..." : "Resolve Clearance"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
