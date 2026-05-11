"use client";

import Link from "next/link";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";
import { FeeTemplateDetailModal } from "./FeeTemplateDetailModal";

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

type FeeTemplatesTableProps = {
  templates: FeeTemplate[];
};

export function FeeTemplatesTable({ templates }: FeeTemplatesTableProps) {
  if (templates.length === 0) {
    return (
      <div className="fin-panel">
        <div className="fin-empty">
          <p className="fin-empty-text">No fee templates created yet.</p>
          <p className="fin-empty-text">
            Use the Create Template button in the header above to get started.
          </p>
        </div>
      </div>
    );
  }

  // Group by assessment band
  const templatesByBand = templates.reduce(
    (acc, template) => {
      const band = template.assessmentBand;
      if (!acc[band]) acc[band] = [];
      acc[band].push(template);
      return acc;
    },
    {} as Record<string, FeeTemplate[]>
  );

  return (
    <div className="fin-stack">
      {Object.entries(templatesByBand).map(([band, bandTemplates]) => (
        <div key={band} className="fin-panel">
          <div className="fin-panel-head">
            <h2 className="fin-panel-title">
              {FEE_ASSESSMENT_BAND_LABELS[band as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
            </h2>
            <span className="fin-panel-meta">
              {bandTemplates.length} template{bandTemplates.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="fin-template-list">
            {bandTemplates.map((template) => {
              const totalAmount = template.items.reduce((sum, item) => {
                const amount = Number(item.defaultAmount);
                return item.feeItemType.isDiscount ? sum - amount : sum + amount;
              }, 0);

              return (
                <div key={template.id} className="fin-template-row">
                  <div className="fin-template-row-main">
                    <div className="fin-template-row-name-row">
                      <Link
                        href={`/staff/finance/fee-templates/${template.id}`}
                        className="fin-template-name-link"
                      >
                        {template.name}
                      </Link>
                      {!template.isActive && (
                        <span className="fin-badge fin-badge-muted">Inactive</span>
                      )}
                    </div>

                    {template.description && (
                      <p className="fin-template-desc">{template.description}</p>
                    )}

                    <div className="fin-template-stats">
                      <span className="fin-stat-item">{template.items.length} item{template.items.length !== 1 ? "s" : ""}</span>
                      <span className="fin-stat-divider" aria-hidden>·</span>
                      <span className="fin-stat-total">
                        Total:{" "}
                        <strong>
                          {new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          }).format(totalAmount)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="fin-template-row-actions">
                    <FeeTemplateDetailModal template={template} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
