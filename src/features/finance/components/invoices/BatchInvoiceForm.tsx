"use client";

import { useActionState, useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { batchGenerateInvoicesAction } from "../../invoices/invoices.actions";
import { getSectionsForGradeLevel, getBatchInvoiceCandidateCount } from "../../invoices/invoices.queries";
import type { BatchInvoiceActionState } from "../../invoices/invoices.schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormToast } from "@/hooks/useFormToast";

interface BatchInvoiceFormProps {
  gradeLevels: Array<{ id: string; name: string }>;
  schoolYearId: string;
  schoolYearLabel: string;
}

type SectionOption = { id: string; name: string };

const initialState: BatchInvoiceActionState = {};

export default function BatchInvoiceForm({
  gradeLevels,
  schoolYearId,
  schoolYearLabel,
}: BatchInvoiceFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(batchGenerateInvoicesAction, initialState);

  // Form state
  const [gradeLevelId, setGradeLevelId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);

  // Loading states for async operations
  const [loadingSections, startLoadingSections] = useTransition();
  const [loadingCount, startLoadingCount] = useTransition();

  // Show toast on success/error
  useFormToast(state, {
    successMessage: state.generatedCount
      ? `Successfully generated ${state.generatedCount} invoice(s)`
      : "Invoices generated successfully",
    onSuccess: () => {
      router.push("/staff/finance/invoices");
      router.refresh();
    },
  });

  // Load sections when grade level changes
  useEffect(() => {
    if (!gradeLevelId) return;

    startLoadingSections(async () => {
      const sectionList = await getSectionsForGradeLevel(gradeLevelId, schoolYearId);
      setSections(sectionList);
    });
  }, [gradeLevelId, schoolYearId]);

  // Load eligible count when filters change
  useEffect(() => {
    if (!gradeLevelId) return;

    startLoadingCount(async () => {
      const count = await getBatchInvoiceCandidateCount({
        gradeLevelId,
        sectionId: sectionId || undefined,
        schoolYearId,
      });
      setEligibleCount(count);
    });
  }, [gradeLevelId, sectionId, schoolYearId]);

  const handleGradeLevelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGradeLevelId = e.target.value;
    setGradeLevelId(newGradeLevelId);
    // Reset dependent state when grade level changes
    setSections([]);
    setSectionId("");
    setEligibleCount(null);
  }, []);

  const handleSectionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSectionId(e.target.value);
  }, []);

  const canSubmit = gradeLevelId && eligibleCount !== null && eligibleCount > 0 && !pending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Batch Invoice Generation
        </CardTitle>
        <CardDescription>
          Generate invoices for all eligible assessments in a grade level or section.
          Only assessments without existing invoices and with outstanding balances will be processed.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={action} className="space-y-6">
          <input type="hidden" name="schoolYearId" value={schoolYearId} />

          {/* School Year Display */}
          <div className="rounded-md border border-border bg-muted/50 px-4 py-3">
            <div className="text-sm text-muted-foreground">School Year</div>
            <div className="font-medium">{schoolYearLabel}</div>
          </div>

          {/* Grade Level Selection */}
          <div className="space-y-2">
            <label
              htmlFor="gradeLevelId"
              className="block text-sm font-medium text-foreground"
            >
              Grade Level <span className="text-destructive">*</span>
            </label>
            <select
              id="gradeLevelId"
              name="gradeLevelId"
              value={gradeLevelId}
              onChange={handleGradeLevelChange}
              required
              disabled={pending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select Grade Level</option>
              {gradeLevels.map((gl) => (
                <option key={gl.id} value={gl.id}>
                  {gl.name}
                </option>
              ))}
            </select>
            {state.errors?.gradeLevelId && (
              <p className="text-xs text-destructive">{state.errors.gradeLevelId[0]}</p>
            )}
          </div>

          {/* Section Selection (Optional) */}
          <div className="space-y-2">
            <label
              htmlFor="sectionId"
              className="block text-sm font-medium text-foreground"
            >
              Section <span className="text-muted-foreground">(Optional)</span>
            </label>
            <select
              id="sectionId"
              name="sectionId"
              value={sectionId}
              onChange={handleSectionChange}
              disabled={pending || !gradeLevelId || loadingSections}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">All Sections</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
            {loadingSections && (
              <p className="text-xs text-muted-foreground">Loading sections...</p>
            )}
            {state.errors?.sectionId && (
              <p className="text-xs text-destructive">{state.errors.sectionId[0]}</p>
            )}
          </div>

          {/* Preview Count */}
          {gradeLevelId && (
            <div
              className={`rounded-md border px-4 py-3 ${
                eligibleCount === 0
                  ? "border-warning/30 bg-warning/10"
                  : eligibleCount !== null
                  ? "border-success/30 bg-success/10"
                  : "border-border bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Eligible Assessments</span>
              </div>
              <div className="mt-1">
                {loadingCount ? (
                  <span className="text-sm text-muted-foreground">Counting...</span>
                ) : eligibleCount !== null ? (
                  <span className="text-lg font-semibold">
                    {eligibleCount} assessment{eligibleCount !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Select a grade level</span>
                )}
              </div>
              {eligibleCount === 0 && (
                <p className="mt-2 text-xs text-warning-foreground">
                  No eligible assessments found. All assessments may already have invoices
                  or have zero balance.
                </p>
              )}
            </div>
          )}

          {/* Form-level Error */}
          {state.message && !state.success && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          {/* Success Message */}
          {state.success && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {state.message}
                {state.skippedCount !== undefined && state.skippedCount > 0 && (
                  <> ({state.skippedCount} already had invoices)</>
                )}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit}
            >
              {pending ? (
                <>Generating...</>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate {eligibleCount !== null && eligibleCount > 0 ? `${eligibleCount} ` : ""}Invoice{eligibleCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
