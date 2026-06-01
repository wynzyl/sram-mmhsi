"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";

interface SchoolYear {
  id: string;
  label: string;
}

interface PaymentCollectionFiltersProps {
  schoolYears: SchoolYear[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultSchoolYearId?: string;
  defaultPaymentMethod?: string;
  defaultPaymentStatus?: string;
}

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

export function PaymentCollectionFilters({
  schoolYears,
  defaultStartDate,
  defaultEndDate,
  defaultSchoolYearId,
  defaultPaymentMethod,
  defaultPaymentStatus,
}: PaymentCollectionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize with URL params or defaults
  const [startDate, setStartDate] = useState(
    defaultStartDate || searchParams.get("startDate") || ""
  );
  const [endDate, setEndDate] = useState(
    defaultEndDate || searchParams.get("endDate") || ""
  );
  const [schoolYearId, setSchoolYearId] = useState(
    defaultSchoolYearId || searchParams.get("schoolYearId") || ""
  );
  const [paymentMethod, setPaymentMethod] = useState(
    defaultPaymentMethod || searchParams.get("paymentMethod") || ""
  );
  const [paymentStatus, setPaymentStatus] = useState(
    defaultPaymentStatus || searchParams.get("paymentStatus") || ""
  );

  const handleApply = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    router.push(`/staff/reports/payment-collection?${params.toString()}`);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSchoolYearId("");
    setPaymentMethod("");
    setPaymentStatus("");
    router.push("/staff/reports/payment-collection");
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-card border border-border rounded-lg">
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

      <SelectField
        label="School Year"
        name="schoolYearId"
        value={schoolYearId}
        onChange={setSchoolYearId}
        options={[
          { value: "", label: "All Years" },
          ...schoolYears.map((sy) => ({ value: sy.id, label: sy.label })),
        ]}
      />

      <SelectField
        label="Payment Method"
        name="paymentMethod"
        value={paymentMethod}
        onChange={setPaymentMethod}
        options={PAYMENT_METHOD_OPTIONS}
      />

      <SelectField
        label="Status"
        name="paymentStatus"
        value={paymentStatus}
        onChange={setPaymentStatus}
        options={PAYMENT_STATUS_OPTIONS}
      />

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
