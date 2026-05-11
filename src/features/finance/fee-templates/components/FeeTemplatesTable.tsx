"use client";

import Link from "next/link";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/fee-schedule/bands";
import { Button } from "@/components/ui/button";

type FeeItemType = {
  id: string;
  name: string;
  isDiscount: boolean;
};

type FeeTemplateItem = {
  id: string;
  defaultAmount: string;
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
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="mb-4 text-gray-600">No fee templates created yet.</p>
        <Link href="/staff/finance/fee-templates/new">
          <Button>Create First Template</Button>
        </Link>
      </div>
    );
  }

  // Group by assessment band
  const templatesByBand = templates.reduce(
    (acc, template) => {
      const band = template.assessmentBand;
      if (!acc[band]) {
        acc[band] = [];
      }
      acc[band].push(template);
      return acc;
    },
    {} as Record<string, FeeTemplate[]>
  );

  return (
    <div className="space-y-6">
      {Object.entries(templatesByBand).map(([band, bandTemplates]) => (
        <div key={band} className="rounded-lg border bg-white">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h3 className="text-lg font-semibold">
              {FEE_ASSESSMENT_BAND_LABELS[band as keyof typeof FEE_ASSESSMENT_BAND_LABELS]}
            </h3>
          </div>

          <div className="divide-y">
            {bandTemplates.map((template) => {
              const totalAmount = template.items.reduce((sum, item) => {
                const amount = Number(item.defaultAmount);
                return item.feeItemType.isDiscount ? sum - amount : sum + amount;
              }, 0);

              return (
                <div
                  key={template.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/staff/finance/fee-templates/${template.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {template.name}
                      </Link>
                      {!template.isActive && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                          Inactive
                        </span>
                      )}
                    </div>

                    {template.description && (
                      <p className="mt-1 text-sm text-gray-600">{template.description}</p>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span>{template.items.length} items</span>
                      <span className="font-medium">
                        Total:{" "}
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: "PHP",
                        }).format(totalAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/staff/finance/fee-templates/${template.id}`}>
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                    </Link>
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
