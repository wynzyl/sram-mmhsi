"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/shared/Modal";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";

type FeeItemType = {
  id: string;
  name: string;
  category: string;
  isDiscount: boolean;
};

type FeeTemplateItem = {
  id: string;
  defaultAmount: string;
  order: number;
  feeItemType: FeeItemType;
};

type FeeTemplate = {
  id: string;
  name: string;
  assessmentBand: string;
  description: string | null;
  isActive: boolean;
  items: FeeTemplateItem[];
};

type FeeTemplateDetailModalProps = {
  template: FeeTemplate;
};

const CATEGORY_LABELS: Record<string, string> = {
  tuition: "Tuition",
  fees: "Fees",
  materials: "Materials",
  discount: "Discount",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  tuition: "hsl(var(--primary))",
  fees: "hsl(var(--foreground))",
  materials: "#f59e0b",
  discount: "hsl(var(--success))",
  other: "#9ca3af",
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function FeeTemplateDetailModal({ template }: FeeTemplateDetailModalProps) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const sortedItems = [...template.items].sort((a, b) => a.order - b.order);

  const totalAmount = sortedItems.reduce((sum, item) => {
    const amount = Number(item.defaultAmount);
    return item.feeItemType.isDiscount ? sum - amount : sum + amount;
  }, 0);

  const grossAmount = sortedItems.reduce((sum, item) => {
    const amount = Number(item.defaultAmount);
    return item.feeItemType.isDiscount ? sum : sum + amount;
  }, 0);

  const totalDiscount = sortedItems.reduce((sum, item) => {
    const amount = Number(item.defaultAmount);
    return item.feeItemType.isDiscount ? sum + amount : sum;
  }, 0);

  const bandLabel =
    FEE_ASSESSMENT_BAND_LABELS[
      template.assessmentBand as keyof typeof FEE_ASSESSMENT_BAND_LABELS
    ] ?? template.assessmentBand;

  // Group items by category for the breakdown
  const byCategory = sortedItems.reduce(
    (acc, item) => {
      const cat = item.feeItemType.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, FeeTemplateItem[]>
  );

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openModal}>
        View Details
      </Button>

      <Modal
        open={open}
        onClose={closeModal}
        size="lg"
        aria-labelledby="fee-template-detail-title"
      >
        {/* ── Header ── */}
        <ModalHeader onClose={closeModal} kicker="Finance · Fee Management">
          <h2 id="fee-template-detail-title">{template.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">{bandLabel}</span>
            {!template.isActive && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">Inactive</span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-1.5">{template.description}</p>
          )}
        </ModalHeader>

        {/* ── KPI Strip ── */}
        <div className="flex items-stretch px-5 py-4 bg-muted/50 border-b border-border">
          <div className="flex flex-col gap-1 px-4 first:pl-0">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Net Total</span>
            <span className="text-lg font-bold text-foreground">{formatPHP(totalAmount)}</span>
          </div>
          <div className="w-px bg-border my-0.5" aria-hidden />
          <div className="flex flex-col gap-1 px-4">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Gross Fees</span>
            <span className="text-lg font-semibold text-muted-foreground">
              {formatPHP(grossAmount)}
            </span>
          </div>
          {totalDiscount > 0 && (
            <>
              <div className="w-px bg-border my-0.5" aria-hidden />
              <div className="flex flex-col gap-1 px-4">
                <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Discounts</span>
                <span className="text-lg font-bold text-success">
                  −{formatPHP(totalDiscount)}
                </span>
              </div>
            </>
          )}
          <div className="w-px bg-border my-0.5" aria-hidden />
          <div className="flex flex-col gap-1 px-4">
            <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Line Items</span>
            <span className="text-lg font-semibold text-muted-foreground">
              {template.items.length}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <ModalBody className="pt-0">
          {sortedItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground mb-2">No fee items in this template.</p>
            </div>
          ) : (
                <div className="flex flex-col">
              {/* Category sections */}
              {Object.entries(byCategory).map(([category, items]) => {
                const catTotal = items.reduce((sum, item) => {
                  const amount = Number(item.defaultAmount);
                  return item.feeItemType.isDiscount ? sum - amount : sum + amount;
                }, 0);

                return (
                  <div key={category} className="border-b border-border last:border-b-0">
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/30">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: CATEGORY_COLORS[category] ?? "#9ca3af" }}
                        aria-hidden
                      />
                      <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[category] ?? category}
                      </span>
                      <span className="text-[0.8125rem] font-semibold text-muted-foreground">
                        {formatPHP(catTotal)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      {items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 px-4 py-2.5 border-b border-border last:border-b-0">
                          <span className="text-[0.6875rem] font-semibold text-muted-foreground tabular-nums">
                            {item.order}
                          </span>
                          <span className="text-foreground inline-flex items-center gap-2">
                            {item.feeItemType.name}
                            {item.feeItemType.isDiscount && (
                              <span className="inline-flex px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-success bg-success/10 rounded">DISC</span>
                            )}
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${item.feeItemType.isDiscount ? "text-success" : "text-foreground"}`}
                          >
                            {item.feeItemType.isDiscount && (
                              <span className="mr-0.5">−</span>
                            )}
                            {formatPHP(Number(item.defaultAmount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Net total row */}
              <div className="flex justify-between items-center px-4 py-4 bg-muted/50 border-t border-border">
                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Net Total</span>
                <span className="text-xl font-bold text-primary">{formatPHP(totalAmount)}</span>
              </div>
            </div>
          )}

        </ModalBody>

        {/* ── Footer ── */}
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal}>
            Close
          </Button>
          <a
            href={`/staff/finance/fee-templates/${template.id}`}
            className="btn btn-primary"
          >
            Manage Template →
          </a>
        </ModalFooter>
      </Modal>
    </>
  );
}
