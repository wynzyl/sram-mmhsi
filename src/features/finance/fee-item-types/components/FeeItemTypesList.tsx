import { FEE_ITEM_CATEGORY_LABELS } from "../fee-item-types.schema";
import { EditFeeItemTypeModal } from "./EditFeeItemTypeModal";
import { ToggleFeeItemTypeButton } from "./ToggleFeeItemTypeButton";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date | string;
};

type Props = {
  feeTypes: FeeItemType[];
  canManage?: boolean;
};

const CATEGORY_DOT: Record<string, string> = {
  tuition: "var(--color-primary)",
  fees: "#0891b2",
  materials: "#7c3aed",
  discount: "var(--color-ops-positive)",
  other: "var(--color-ops-muted)",
};

export function FeeItemTypesList({ feeTypes, canManage = false }: Props) {
  const active = feeTypes.filter((t) => t.isActive);
  const inactive = feeTypes.filter((t) => !t.isActive);

  if (feeTypes.length === 0) {
    return (
      <div className="fin-empty">
        <div className="fit-empty-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <p className="fit-empty-title">No fee types yet</p>
        <p className="fit-empty-sub">
          Use the <strong>+ New Fee Type</strong> button to create your first fee type.
        </p>
      </div>
    );
  }

  return (
    <div className="fit-list-wrap">
      {active.length > 0 && (
        <FeeTypeGroup label="Active" count={active.length} feeTypes={active} canManage={canManage} />
      )}
      {inactive.length > 0 && (
        <FeeTypeGroup label="Inactive" count={inactive.length} feeTypes={inactive} muted canManage={canManage} />
      )}
    </div>
  );
}

function FeeTypeGroup({
  label,
  count,
  feeTypes,
  muted = false,
  canManage = false,
}: {
  label: string;
  count: number;
  feeTypes: FeeItemType[];
  muted?: boolean;
  canManage?: boolean;
}) {
  return (
    <section className="fit-group">
      <div className="fit-group-head">
        <span className="fit-group-label">{label}</span>
        <span className="fit-group-count">{count}</span>
      </div>

      <div className="fin-panel" style={{ overflow: "hidden" }}>
        <table className="fin-table" style={{ opacity: muted ? 0.65 : 1 }}>
          <thead>
            <tr>
              <th className="fin-th" style={{ width: "2.5rem" }}>#</th>
              <th className="fin-th">Code</th>
              <th className="fin-th">Name</th>
              <th className="fin-th">Category</th>
              <th className="fin-th">Type</th>
              <th className="fin-th fin-th-num">Order</th>
              {canManage && <th className="fin-th" style={{ width: "8rem" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {feeTypes.map((ft, idx) => (
              <tr key={ft.id} className="fit-table-row">
                <td className="fin-td fin-td-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {idx + 1}
                </td>
                <td className="fin-td">
                  <span className="fit-code-pill">{ft.code}</span>
                </td>
                <td className="fin-td">
                  <span className="fit-name">{ft.name}</span>
                </td>
                <td className="fin-td">
                  <span className="fit-category-tag">
                    <span
                      className="fit-category-dot"
                      style={{ background: CATEGORY_DOT[ft.category] ?? "var(--color-ops-muted)" }}
                      aria-hidden
                    />
                    {FEE_ITEM_CATEGORY_LABELS[ft.category as keyof typeof FEE_ITEM_CATEGORY_LABELS] ?? ft.category}
                  </span>
                </td>
                <td className="fin-td">
                  {ft.isDiscount ? (
                    <span className="fin-disc-tag">DISC</span>
                  ) : (
                    <span className="fit-fee-tag">FEE</span>
                  )}
                </td>
                <td className="fin-td fin-td-num">
                  {ft.displayOrder}
                </td>
                {canManage && (
                  <td className="fin-td">
                    <div className="fit-actions">
                      <EditFeeItemTypeModal feeType={ft} />
                      <ToggleFeeItemTypeButton id={ft.id} isActive={ft.isActive} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
