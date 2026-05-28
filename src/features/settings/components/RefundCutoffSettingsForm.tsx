"use client";

import { useState, useActionState } from "react";
import { useFormToast } from "@/hooks/useFormToast";
import { updateRefundCutoffSettingsAction } from "../system-settings.actions";
import type { RefundCutoffSettingsFormState } from "../system-settings.schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Info } from "lucide-react";

interface Props {
  initialStartDate: string | null;
  initialCutoffDays: number | null;
}

const initialState: RefundCutoffSettingsFormState = {};

export function RefundCutoffSettingsForm({ initialStartDate, initialCutoffDays }: Props) {
  const [state, action, isPending] = useActionState(updateRefundCutoffSettingsAction, initialState);

  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [cutoffDays, setCutoffDays] = useState(initialCutoffDays?.toString() ?? "30");

  useFormToast(state, {
    successMessage: "Refund cutoff settings saved successfully.",
  });

  // Calculate cutoff date for preview
  const cutoffDate = startDate && cutoffDays
    ? (() => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + parseInt(cutoffDays, 10));
        return date.toLocaleDateString("en-PH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      })()
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          Refund Cutoff Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure the refund eligibility window for enrollment cancellations.
          Students who cancel within the cutoff period can receive refunds for refundable fee items.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          {/* Info Box */}
          <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">How refund cutoff works</p>
              <p className="mt-1 text-blue-700">
                When an enrollment is cancelled, the system checks if the cancellation date
                is before the cutoff date. If yes, payments for fee items marked as "refundable"
                can be refunded. Non-refundable fees (like registration) are always kept.
              </p>
            </div>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-2">
            <label htmlFor="refundCutoffStartDate" className="text-sm font-medium text-foreground">
              School Year Start Date <span className="text-destructive">*</span>
            </label>
            <input
              id="refundCutoffStartDate"
              name="refundCutoffStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="block w-full max-w-xs px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            <p className="text-xs text-muted-foreground">
              Typically the first day of classes for the school year.
            </p>
            {state.errors?.refundCutoffStartDate && (
              <p className="text-xs text-destructive">{state.errors.refundCutoffStartDate[0]}</p>
            )}
          </div>

          {/* Cutoff Days */}
          <div className="flex flex-col gap-2">
            <label htmlFor="refundCutoffDays" className="text-sm font-medium text-foreground">
              Cutoff Period (Days) <span className="text-destructive">*</span>
            </label>
            <input
              id="refundCutoffDays"
              name="refundCutoffDays"
              type="number"
              value={cutoffDays}
              onChange={(e) => setCutoffDays(e.target.value)}
              min={0}
              max={365}
              required
              className="block w-full max-w-[120px] px-3 py-2 text-sm text-foreground bg-background border border-border rounded-md focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
            />
            <p className="text-xs text-muted-foreground">
              Number of days from start date during which refunds are allowed (e.g., 30 days).
            </p>
            {state.errors?.refundCutoffDays && (
              <p className="text-xs text-destructive">{state.errors.refundCutoffDays[0]}</p>
            )}
          </div>

          {/* Cutoff Date Preview */}
          {cutoffDate && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Refund Cutoff Date</p>
                <p className="text-sm text-amber-700">{cutoffDate}</p>
                <p className="text-xs text-amber-600 mt-1">
                  Cancellations after this date will not be eligible for refunds on refundable items.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {state.message && !state.success && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          {/* Submit */}
          <div className="pt-4 border-t">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
