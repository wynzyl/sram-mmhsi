"use client";

import Link from "next/link";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";
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
      <div className="bg-card border border-border rounded-md">
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">No fee templates created yet.</p>
          <p className="text-sm text-muted-foreground mb-2">
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
    <div className="flex flex-col gap-6">
      {Object.entries(templatesByBand).map(([band, bandTemplates]) => (
        <div key={band} className="bg-card border border-border rounded-md">
          <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              {FEE_ASSESSMENT_BAND_LABELS[band as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
            </h2>
            <span className="text-xs text-muted-foreground">
              {bandTemplates.length} template{bandTemplates.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex flex-col">
            {bandTemplates.map((template) => {
              const totalAmount = template.items.reduce((sum, item) => {
                const amount = Number(item.defaultAmount);
                return item.feeItemType.isDiscount ? sum - amount : sum + amount;
              }, 0);

              return (
                <div key={template.id} className="flex justify-between items-center py-4 px-5 border-b border-border last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/staff/finance/fee-templates/${template.id}`}
                        className="text-[0.9375rem] font-semibold text-foreground no-underline hover:text-primary hover:underline"
                      >
                        {template.name}
                      </Link>
                      {!template.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">Inactive</span>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-[0.8125rem] text-muted-foreground mt-1">{template.description}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{template.items.length} item{template.items.length !== 1 ? "s" : ""}</span>
                      <span className="text-border" aria-hidden>·</span>
                      <span className="text-foreground">
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

                  <div className="flex gap-2 shrink-0">
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
