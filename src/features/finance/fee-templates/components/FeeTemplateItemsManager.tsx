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
  displayOrder: number;
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
    <div className="fin-panel">
      <div className="fin-panel-head">
        <h3 className="fin-panel-title">Template Items</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className="fin-panel-meta">
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
        <div className="fin-empty">
          <div style={{
            width: "2.5rem", height: "2.5rem", borderRadius: "50%",
            background: "color-mix(in srgb, var(--color-ops-line) 60%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", color: "var(--color-ops-muted)",
          }} aria-hidden>
            ₱
          </div>
          <p className="fin-empty-text">No items yet.</p>
          <p className="fin-empty-text" style={{ marginTop: "-0.5rem", fontSize: "0.75rem" }}>
            Use the <strong>+ Add Fee Item</strong> button above to build this template.
          </p>
        </div>
      ) : (
        <>
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr>
                  <th scope="col" className="fin-th fin-th-num">#</th>
                  <th scope="col" className="fin-th">Fee Type</th>
                  <th scope="col" className="fin-th">Category</th>
                  <th scope="col" className="fin-th fin-th-num">Default Amount</th>
                  <th scope="col" className="fin-th fin-th-num">Remove</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.id} className="fin-tr">
                    <td className="fin-td fin-td-num fin-td-muted">{item.order}</td>
                    <td className="fin-td">
                      <span className="fin-td-name">{item.feeItemType.name}</span>
                      {item.feeItemType.isDiscount && (
                        <span className="fin-disc-tag">DISC</span>
                      )}
                    </td>
                    <td className="fin-td fin-td-muted capitalize">{item.feeItemType.category}</td>
                    <td className="fin-td fin-td-num fin-td-amount">
                      {item.feeItemType.isDiscount && (
                        <span className="fin-minus">−</span>
                      )}
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(Number(item.defaultAmount))}
                    </td>
                    <td className="fin-td fin-td-num">
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
                <tr className="fin-tfoot-row">
                  <td colSpan={3} className="fin-td">
                    <span className="fin-tfoot-label">Template Total</span>
                  </td>
                  <td className="fin-td fin-td-num fin-tfoot-total">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(templateTotal)}
                  </td>
                  <td className="fin-td" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
