"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectOption {
  id: string;
  label: string;
}

interface FilterState {
  startDate: string;
  endDate: string;
  schoolYearId: string;
  gradeLevelId: string;
  paymentMethod: string;
  paymentStatus: string;
}

/**
 * Configuration for which filter fields to display
 */
export interface ReportFiltersConfig {
  /** Enable date range filters (startDate + endDate) */
  dateRange?: boolean;
  /** School year dropdown options. Pass array to enable, omit to hide */
  schoolYears?: SelectOption[];
  /** School year field label override */
  schoolYearLabel?: string;
  /** Whether school year is required (no "All Years" option) */
  schoolYearRequired?: boolean;
  /** Grade level dropdown options. Pass array to enable, omit to hide */
  gradeLevels?: SelectOption[];
  /** Enable payment method filter */
  paymentMethod?: boolean;
  /** Enable payment status filter */
  paymentStatus?: boolean;
}

interface ReportFiltersProps {
  /** Base path for navigation (e.g., "/staff/reports/payment-collection") */
  basePath: string;
  /** Configuration for which filters to display */
  config: ReportFiltersConfig;
  /** Default filter values from URL or server */
  defaults?: Partial<FilterState>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "posted", label: "Posted" },
  { value: "pending_confirmation", label: "Pending" },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Composable report filters component with URL-synced state
 *
 * Configure which filters to display via the `config` prop. All filters
 * sync to URL query parameters on apply, and reset navigates to base path.
 *
 * @example
 * ```tsx
 * // Payment collection: date range + school year + payment filters
 * <ReportFilters
 *   basePath="/staff/reports/payment-collection"
 *   config={{
 *     dateRange: true,
 *     schoolYears: schoolYearOptions,
 *     paymentMethod: true,
 *     paymentStatus: true,
 *   }}
 *   defaults={{
 *     startDate: "2026-01-01",
 *     endDate: "2026-01-31",
 *   }}
 * />
 *
 * // Student list: school year (required) + grade level
 * <ReportFilters
 *   basePath="/staff/reports/student-list"
 *   config={{
 *     schoolYears: schoolYearOptions,
 *     schoolYearRequired: true,
 *     gradeLevels: gradeLevelOptions,
 *   }}
 *   defaults={{ schoolYearId: activeSchoolYearId }}
 * />
 * ```
 */
export function ReportFilters({
  basePath,
  config,
  defaults = {},
}: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from defaults or URL params
  const getInitialValue = useCallback(
    (key: keyof FilterState): string => {
      return defaults[key] ?? searchParams.get(key) ?? "";
    },
    [defaults, searchParams]
  );

  const [startDate, setStartDate] = useState(getInitialValue("startDate"));
  const [endDate, setEndDate] = useState(getInitialValue("endDate"));
  const [schoolYearId, setSchoolYearId] = useState(getInitialValue("schoolYearId"));
  const [gradeLevelId, setGradeLevelId] = useState(getInitialValue("gradeLevelId"));
  const [paymentMethod, setPaymentMethod] = useState(getInitialValue("paymentMethod"));
  const [paymentStatus, setPaymentStatus] = useState(getInitialValue("paymentStatus"));

  const handleApply = () => {
    const params = new URLSearchParams();

    if (config.dateRange) {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }
    if (config.schoolYears && schoolYearId) {
      params.set("schoolYearId", schoolYearId);
    }
    if (config.gradeLevels && gradeLevelId) {
      params.set("gradeLevelId", gradeLevelId);
    }
    if (config.paymentMethod && paymentMethod) {
      params.set("paymentMethod", paymentMethod);
    }
    if (config.paymentStatus && paymentStatus) {
      params.set("paymentStatus", paymentStatus);
    }

    const queryString = params.toString();
    router.push(queryString ? `${basePath}?${queryString}` : basePath);
  };

  const handleReset = () => {
    // Reset all state
    setStartDate("");
    setEndDate("");
    // For required school year, reset to default; otherwise clear
    setSchoolYearId(config.schoolYearRequired ? (defaults.schoolYearId ?? "") : "");
    setGradeLevelId("");
    setPaymentMethod("");
    setPaymentStatus("");
    router.push(basePath);
  };

  // Build school year options
  const schoolYearOptions = config.schoolYears
    ? config.schoolYearRequired
      ? config.schoolYears.map((sy) => ({ value: sy.id, label: sy.label }))
      : [
          { value: "", label: "All Years" },
          ...config.schoolYears.map((sy) => ({ value: sy.id, label: sy.label })),
        ]
    : [];

  // Build grade level options
  const gradeLevelOptions = config.gradeLevels
    ? [
        { value: "", label: "All Grades" },
        ...config.gradeLevels.map((g) => ({ value: g.id, label: g.label })),
      ]
    : [];

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-card border border-border rounded-lg">
      {/* Date Range */}
      {config.dateRange && (
        <>
          <TextInputField
            label="Start Date"
            name="startDate"
            type="date"
            value={startDate}
            onChange={setStartDate}
            className="w-40"
          />
          <TextInputField
            label="End Date"
            name="endDate"
            type="date"
            value={endDate}
            onChange={setEndDate}
            className="w-40"
          />
        </>
      )}

      {/* School Year */}
      {config.schoolYears && (
        <SelectField
          label={config.schoolYearLabel ?? "School Year"}
          name="schoolYearId"
          value={schoolYearId}
          onChange={setSchoolYearId}
          options={schoolYearOptions}
        />
      )}

      {/* Grade Level */}
      {config.gradeLevels && (
        <SelectField
          label="Grade Level"
          name="gradeLevelId"
          value={gradeLevelId}
          onChange={setGradeLevelId}
          options={gradeLevelOptions}
        />
      )}

      {/* Payment Method */}
      {config.paymentMethod && (
        <SelectField
          label="Payment Method"
          name="paymentMethod"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={PAYMENT_METHOD_OPTIONS}
        />
      )}

      {/* Payment Status */}
      {config.paymentStatus && (
        <SelectField
          label="Status"
          name="paymentStatus"
          value={paymentStatus}
          onChange={setPaymentStatus}
          options={PAYMENT_STATUS_OPTIONS}
        />
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="button" onClick={handleApply}>
          Apply Filters
        </Button>
        <Button type="button" variant="secondary" onClick={handleReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
