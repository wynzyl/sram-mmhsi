export type ReceiptBookletStatus = "active" | "exhausted" | "voided" | string;

export function getReceiptStatusClasses(status: ReceiptBookletStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-500/35 bg-emerald-500/15 text-emerald-300";
    case "exhausted":
      return "border-(--color-ops-line) bg-(--color-ops-panel-muted) text-(--color-ops-muted)";
    case "voided":
      return "border-rose-500/35 bg-rose-500/15 text-rose-300";
    default:
      return "border-(--color-ops-line) bg-(--color-ops-panel-muted) text-(--color-ops-muted)";
  }
}

export function receiptProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
