"use client";

import { removeFeeTemplateItemAction } from "../fee-templates.actions";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import { AddFeeItemModal } from "./AddFeeItemModal";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
};

type FeeTemplateItem = {
  id: string;
  feeItemTypeId: string;
  defaultAmount: string;
  order: number;
  feeItemType: FeeItemType;
};

type FeeTemplateItemsManagerProps = {
  templateId: string;
  items: FeeTemplateItem[];
  availableFeeTypes: FeeItemType[];
};

export function FeeTemplateItemsManager({
  templateId,
  items,
  availableFeeTypes,
}: FeeTemplateItemsManagerProps) {
  const usedFeeTypeIds = new Set(items.map((item) => item.feeItemTypeId));
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  const templateTotal = sortedItems.reduce((sum, item) => {
    const amount = Number(item.defaultAmount);
    return item.feeItemType.isDiscount ? sum - amount : sum + amount;
  }, 0);

  return (
    <div className="bg-card border border-border rounded-md">
      <div className="flex justify-between items-center gap-4 px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">Template Items</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
          <AddFeeItemModal
            templateId={templateId}
            availableFeeTypes={availableFeeTypes}
            usedFeeTypeIds={usedFeeTypeIds}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-border/60 flex items-center justify-center text-lg text-gray-400 dark:text-gray-500 mx-auto mb-3" aria-hidden>
            ₱
          </div>
          <p className="text-sm text-muted-foreground mb-2">No items yet.</p>
          <p className="text-xs text-muted-foreground">
            Use the <strong>+ Add Fee Item</strong> button above to build this template.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">#</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Fee Type</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Category</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Default Amount</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Remove</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-[0.8125rem] text-muted-foreground text-right tabular-nums">{item.order}</td>
                    <td className="px-4 py-2.5 text-[0.8125rem] text-foreground">
                      <span className="font-medium">{item.feeItemType.name}</span>
                      {item.feeItemType.isDiscount && (
                        <span className="inline-flex ml-2 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-success bg-success/10 rounded">DISC</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[0.8125rem] text-muted-foreground capitalize">{item.feeItemType.category}</td>
                    <td className="px-4 py-2.5 text-[0.8125rem] text-foreground text-right tabular-nums font-medium">
                      {item.feeItemType.isDiscount && (
                        <span className="mr-0.5">−</span>
                      )}
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(Number(item.defaultAmount))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <InlineConfirmButton
                        action={removeFeeTemplateItemAction}
                        confirmMessage={`Remove ${item.feeItemType.name} from this template?`}
                        hiddenFields={{ id: item.id }}
                        label="Remove"
                        loadingLabel="Removing…"
                        variant="danger"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30">
                  <td colSpan={3} className="px-4 py-3 text-[0.8125rem]">
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">Template Total</span>
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-primary">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(templateTotal)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
