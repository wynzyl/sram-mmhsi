import { FEE_ITEM_CATEGORY_LABELS } from "../fee-item-types.schema";
import { EditFeeItemTypeModal } from "./EditFeeItemTypeModal";
import { ToggleFeeItemTypeButton } from "./ToggleFeeItemTypeButton";

type FeeItemType = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDiscount: boolean;
  isRefundable: boolean;
  displayOrder: number;
  isActive: boolean;
};

type Props = {
  feeTypes: FeeItemType[];
  canManage?: boolean;
};

const CATEGORY_DOT: Record<string, string> = {
  tuition: "hsl(var(--primary))",
  fees: "#0891b2",
  materials: "#7c3aed",
  discount: "#22c55e",
  other: "#9ca3af",
};

export function FeeItemTypesList({ feeTypes, canManage = false }: Props) {
  const active = feeTypes.filter((t) => t.isActive);
  const inactive = feeTypes.filter((t) => !t.isActive);

  if (feeTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 text-muted-foreground" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <p className="text-[0.9375rem] font-semibold text-foreground">No fee types yet</p>
        <p className="text-[0.8125rem] text-muted-foreground m-0">
          Use the <strong>+ New Fee Type</strong> button to create your first fee type.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-[0.6875rem] font-semibold px-1.5 py-0.5 bg-muted text-muted-foreground rounded">{count}</span>
      </div>

      <div className="bg-card border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm border-collapse" style={{ opacity: muted ? 0.65 : 1 }}>
          <thead>
            <tr>
              <th className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border" style={{ width: "2.5rem" }}>#</th>
              <th className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Code</th>
              <th className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Name</th>
              <th className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Category</th>
              <th className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Type</th>
              <th className="px-4 py-2.5 text-center text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Refundable</th>
              <th className="px-4 py-2.5 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border">Order</th>
              {canManage && <th className="px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground bg-muted/50 border-b border-border" style={{ width: "8rem" }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {feeTypes.map((ft, idx) => (
              <tr key={ft.id} className="transition-colors hover:bg-muted">
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border text-muted-foreground tabular-nums">
                  {idx + 1}
                </td>
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border">
                  <span className="inline-flex px-2 py-0.5 text-xs font-mono bg-muted text-foreground rounded tracking-wide">{ft.code}</span>
                </td>
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border">
                  <span className="font-medium text-foreground">{ft.name}</span>
                </td>
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: CATEGORY_DOT[ft.category] ?? "#9ca3af" }}
                      aria-hidden
                    />
                    {FEE_ITEM_CATEGORY_LABELS[ft.category as keyof typeof FEE_ITEM_CATEGORY_LABELS] ?? ft.category}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border">
                  {ft.isDiscount ? (
                    <span className="inline-flex px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-green-500 bg-green-500/10 rounded">DISC</span>
                  ) : (
                    <span className="inline-flex px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded">FEE</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border text-center">
                  {ft.isRefundable ? (
                    <span className="inline-flex px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-green-500 bg-green-500/10 rounded">YES</span>
                  ) : (
                    <span className="inline-flex px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-amber-500 bg-amber-500/10 rounded">NO</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border text-right tabular-nums">
                  {ft.displayOrder}
                </td>
                {canManage && (
                  <td className="px-4 py-2.5 text-[0.8125rem] border-b border-border">
                    <div className="flex gap-2">
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
