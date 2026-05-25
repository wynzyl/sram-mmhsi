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
  tuition: "var(--color-primary)",
  fees: "var(--color-ops-ink)",
  materials: "var(--color-ops-warning, #f59e0b)",
  discount: "var(--color-ops-positive, #16a34a)",
  other: "var(--color-ops-muted)",
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
            <span className="fin-band-pill">{bandLabel}</span>
            {!template.isActive && (
              <span className="fin-badge fin-badge-muted">Inactive</span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-[var(--muted-foreground)] mt-1.5">{template.description}</p>
          )}
        </ModalHeader>

        {/* ── KPI Strip ── */}
        <div className="fin-detail-kpi-strip">
          <div className="fin-detail-kpi-item">
            <span className="fin-detail-kpi-label">Net Total</span>
            <span className="fin-detail-kpi-value">{formatPHP(totalAmount)}</span>
          </div>
          <div className="fin-detail-kpi-divider" aria-hidden />
          <div className="fin-detail-kpi-item">
            <span className="fin-detail-kpi-label">Gross Fees</span>
            <span className="fin-detail-kpi-value fin-detail-kpi-secondary">
              {formatPHP(grossAmount)}
            </span>
          </div>
          {totalDiscount > 0 && (
            <>
              <div className="fin-detail-kpi-divider" aria-hidden />
              <div className="fin-detail-kpi-item">
                <span className="fin-detail-kpi-label">Discounts</span>
                <span className="fin-detail-kpi-value fin-detail-kpi-discount">
                  −{formatPHP(totalDiscount)}
                </span>
              </div>
            </>
          )}
          <div className="fin-detail-kpi-divider" aria-hidden />
          <div className="fin-detail-kpi-item">
            <span className="fin-detail-kpi-label">Line Items</span>
            <span className="fin-detail-kpi-value fin-detail-kpi-secondary">
              {template.items.length}
            </span>
          </div>
        </div>

        {/* ── Body ── */}
        <ModalBody className="pt-0">
          {sortedItems.length === 0 ? (
            <div className="fin-empty">
              <p className="fin-empty-text">No fee items in this template.</p>
            </div>
          ) : (
                <div className="fin-detail-items-section">
              {/* Category sections */}
              {Object.entries(byCategory).map(([category, items]) => {
                const catTotal = items.reduce((sum, item) => {
                  const amount = Number(item.defaultAmount);
                  return item.feeItemType.isDiscount ? sum - amount : sum + amount;
                }, 0);

                return (
                  <div key={category} className="fin-detail-category-group">
                    <div className="fin-detail-category-head">
                      <span
                        className="fin-detail-category-dot"
                        style={{ background: CATEGORY_COLORS[category] ?? "var(--color-ops-muted)" }}
                        aria-hidden
                      />
                      <span className="fin-detail-category-label">
                        {CATEGORY_LABELS[category] ?? category}
                      </span>
                      <span className="fin-detail-category-subtotal">
                        {formatPHP(catTotal)}
                      </span>
                    </div>

                    <div className="fin-detail-item-list">
                      {items.map((item) => (
                        <div key={item.id} className="fin-detail-item-row">
                          <span className="fin-detail-item-order">
                            {item.order}
                          </span>
                          <span className="fin-detail-item-name">
                            {item.feeItemType.name}
                            {item.feeItemType.isDiscount && (
                              <span className="fin-disc-tag">DISC</span>
                            )}
                          </span>
                          <span
                            className={
                              item.feeItemType.isDiscount
                                ? "fin-detail-item-amount fin-detail-item-amount-disc"
                                : "fin-detail-item-amount"
                            }
                          >
                            {item.feeItemType.isDiscount && (
                              <span className="fin-minus">−</span>
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
              <div className="fin-detail-total-row">
                <span className="fin-detail-total-label">Net Total</span>
                <span className="fin-detail-total-value">{formatPHP(totalAmount)}</span>
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
