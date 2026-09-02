export type ReceiptBookletStatus = "active" | "exhausted" | "voided" | "inactive" | string;

export function getReceiptStatusClasses(status: ReceiptBookletStatus): string {
  switch (status) {
    case "active":
      return "border-success/35 bg-success/15 text-success";
    case "exhausted":
      return "border-[var(--color-ops-line)] bg-[var(--color-ops-panel-muted)] text-[var(--color-ops-muted)]";
    case "voided":
      return "border-destructive/35 bg-destructive/15 text-destructive";
    case "inactive":
      return "border-warning/35 bg-warning/15 text-warning";
    default:
      return "border-[var(--color-ops-line)] bg-[var(--color-ops-panel-muted)] text-[var(--color-ops-muted)]";
  }
}

export function receiptProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
