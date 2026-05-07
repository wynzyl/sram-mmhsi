"use client";

import { useActionState, useEffect, useState } from "react";
import { generateInvoiceAction } from "@/actions/invoices";
import { useRouter } from "next/navigation";

interface GenerateInvoiceButtonProps {
  assessmentId: string;
}

export default function GenerateInvoiceButton({ assessmentId }: GenerateInvoiceButtonProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg("");
    try {
      const result = await generateInvoiceAction(assessmentId);
      if (result.success && result.invoiceId) {
        router.push(`/staff/finance/invoices/${result.invoiceId}`);
      } else {
        setErrorMsg(result.message || "Failed to generate invoice.");
      }
    } catch (error) {
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? "Generating..." : "Generate Invoice"}
      </button>
      {errorMsg && <p className="form-error" style={{ fontSize: "0.75rem", margin: 0 }}>{errorMsg}</p>}
    </div>
  );
}
