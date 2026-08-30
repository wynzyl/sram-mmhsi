"use client";

import { useActionState, useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, AlertCircle, AlertTriangle, Users } from "lucide-react";
import { batchSendInvoicesAction } from "../../invoices/invoices.actions";
import { getInvoicesForBatchSending, getSectionsForGradeLevel } from "../../invoices/invoices.queries";
import type { BatchSendInvoiceActionState } from "../../invoices/invoices.schema";
import type { BatchSendInvoiceCandidate } from "../../invoices/invoices.queries";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";
import { formatCurrency } from "@/lib/utils/currency";

interface BatchSendInvoiceFormProps {
  gradeLevels: Array<{ id: string; name: string }>;
  schoolYearId: string;
  schoolYearLabel: string;
}

type SectionOption = { id: string; name: string };

const initialState: BatchSendInvoiceActionState = {};

export default function BatchSendInvoiceForm({
  gradeLevels,
  schoolYearId,
  schoolYearLabel,
}: BatchSendInvoiceFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(batchSendInvoicesAction, initialState);

  // Filter state
  const [gradeLevelId, setGradeLevelId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [sections, setSections] = useState<SectionOption[]>([]);

  // Invoice state
  const [invoices, setInvoices] = useState<BatchSendInvoiceCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Loading states
  const [loadingSections, startLoadingSections] = useTransition();
  const [loadingInvoices, startLoadingInvoices] = useTransition();

  // Filter invoices that have emails (can be sent)
  const sendableInvoices = invoices.filter((inv) => inv.guardianEmail);
  const noEmailInvoices = invoices.filter((inv) => !inv.guardianEmail);

  // Show toast on success/error
  useFormToast(state, {
    successMessage: state.sentCount
      ? `Successfully sent ${state.sentCount} invoice(s)`
      : "Invoices sent successfully",
    onSuccess: () => {
      router.refresh();
      // Reload invoices after successful send
      loadInvoices();
    },
  });

  // Load invoices function
  const loadInvoices = useCallback(() => {
    startLoadingInvoices(async () => {
      const data = await getInvoicesForBatchSending({
        schoolYearId,
        gradeLevelId: gradeLevelId || undefined,
        sectionId: sectionId || undefined,
      });
      setInvoices(data);
      setSelectedIds(new Set()); // Clear selection when filters change
    });
  }, [schoolYearId, gradeLevelId, sectionId]);

  // Load sections when grade level changes
  useEffect(() => {
    if (!gradeLevelId) return;

    startLoadingSections(async () => {
      const sectionList = await getSectionsForGradeLevel(gradeLevelId, schoolYearId);
      setSections(sectionList);
    });
  }, [gradeLevelId, schoolYearId]);

  // Load invoices on initial mount
  useEffect(() => {
    loadInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGradeLevelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGradeLevelId = e.target.value;
    setGradeLevelId(newGradeLevelId);
    setSections([]);
    setSectionId("");
    // Trigger invoice reload with new grade level filter (no section)
    startLoadingInvoices(async () => {
      const data = await getInvoicesForBatchSending({
        schoolYearId,
        gradeLevelId: newGradeLevelId || undefined,
        sectionId: undefined,
      });
      setInvoices(data);
      setSelectedIds(new Set());
    });
  }, [schoolYearId]);

  const handleSectionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSectionId = e.target.value;
    setSectionId(newSectionId);
    // Trigger invoice reload with new section filter
    startLoadingInvoices(async () => {
      const data = await getInvoicesForBatchSending({
        schoolYearId,
        gradeLevelId: gradeLevelId || undefined,
        sectionId: newSectionId || undefined,
      });
      setInvoices(data);
      setSelectedIds(new Set());
    });
  }, [schoolYearId, gradeLevelId]);

  const toggleSelection = useCallback((invoiceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sendableInvoices.map((inv) => inv.invoiceId)));
  }, [sendableInvoices]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;
  const canSubmit = selectedCount > 0 && !pending;

  return (
    <>
      {/* Card Header - Inline Controls */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Section Label + Count Badge */}
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Batch Send
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            {sendableInvoices.length} Sendable
          </span>
          {noEmailInvoices.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
              {noEmailInvoices.length} No Email
            </span>
          )}
        </div>

        {/* Right: Filters */}
        <div className="flex items-center gap-2">
          {/* Grade Level Dropdown */}
          <select
            value={gradeLevelId}
            aria-label="Filter by grade level"
            onChange={handleGradeLevelChange}
            disabled={pending || loadingInvoices}
            className="form-control min-h-10 w-32 bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
          >
            <option value="">All grades</option>
            {gradeLevels.map((gl) => (
              <option key={gl.id} value={gl.id}>
                {gl.name}
              </option>
            ))}
          </select>

          {/* Section Dropdown */}
          <select
            value={sectionId}
            aria-label="Filter by section"
            onChange={handleSectionChange}
            disabled={pending || !gradeLevelId || loadingSections || loadingInvoices}
            className="form-control min-h-10 w-32 bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
          >
            <option value="">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>

          {loadingSections && (
            <span className="text-xs text-muted-foreground">Loading...</span>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="mx-4 mt-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-primary">Send Invoices via Email</p>
            <p className="text-sm text-muted-foreground">
              Select invoices to send to primary guardians. School Year: <span className="font-medium">{schoolYearLabel}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {loadingInvoices ? (
              "Loading..."
            ) : (
              <>
                {selectedCount} of {sendableInvoices.length} selected
              </>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={selectAll}
            disabled={pending || sendableInvoices.length === 0 || loadingInvoices}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={selectNone}
            disabled={pending || selectedCount === 0 || loadingInvoices}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Invoice Table */}
      <form action={action} className="mt-4">
        <input
          type="hidden"
          name="invoiceIds"
          value={JSON.stringify(Array.from(selectedIds))}
        />

        {loadingInvoices ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">Loading invoices...</p>
          </div>
        ) : sendableInvoices.length === 0 && noEmailInvoices.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-foreground">No invoices found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No invoices found for the selected filters.
              {sectionId && " Tip: Students without section assignments only appear when 'All Sections' is selected."}
            </p>
          </div>
        ) : sendableInvoices.length === 0 ? (
          <div className="mx-4 my-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-warning mb-2" />
            <p className="text-sm text-warning">
              No invoices with guardian emails found. Make sure students have primary guardians with email addresses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border">
                  <th className="w-12 px-4 py-3 text-left">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Invoice
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Grade / Section
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Guardian Email
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sendableInvoices.map((invoice) => (
                  <tr
                    key={invoice.invoiceId}
                    className={`transition-colors hover:bg-muted/30 cursor-pointer ${
                      selectedIds.has(invoice.invoiceId) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => toggleSelection(invoice.invoiceId)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(invoice.invoiceId)}
                        onChange={() => toggleSelection(invoice.invoiceId)}
                        disabled={pending}
                        className="h-4 w-4 rounded border-input cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{invoice.studentName}</div>
                      <div className="text-xs text-muted-foreground">{invoice.studentRef}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{invoice.gradeLevelName}</div>
                      {invoice.sectionName ? (
                        <div className="text-xs text-muted-foreground">{invoice.sectionName}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground/60 italic">No section</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">
                      {invoice.guardianEmail}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatCurrency(Number(invoice.amountDue))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
                          invoice.status === "sent"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* No Email Warning */}
        {noEmailInvoices.length > 0 && (
          <div className="mx-4 mt-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium text-warning">
                  {noEmailInvoices.length} invoice(s) cannot be sent
                </p>
                <p className="text-xs text-warning/80 mt-1">
                  These students do not have a primary guardian with an email address on file.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form-level Error (toast handles success) */}
        {state.message && !state.success && (
          <div
            role="alert"
            className="mx-4 mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}

        {/* Partial Failures List - show detailed failures for user action */}
        {state.success && state.failures && state.failures.length > 0 && (
          <div className="mx-4 mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
            <p className="text-sm font-medium text-warning mb-2">
              {state.failedCount} invoice(s) failed to send:
            </p>
            <ul className="text-xs text-warning/80 space-y-1">
              {state.failures.map((f, i) => (
                <li key={i}>
                  {f.invoiceNumber}: {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-border px-4 py-4 mt-4">
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
              <>Sending...</>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send {selectedCount > 0 ? `${selectedCount} ` : ""}Invoice{selectedCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
