import "server-only";
import { logAudit } from "@/lib/utils/audit-logger";
import type { ReportFormat } from "./report-response";

type ReportActor = { id?: string; userId?: string; role: string };

interface LogReportExportParams {
  /** Current session user (from getCurrentUser/requireSession). */
  actor: ReportActor;
  /** Stable report identifier, e.g. "payment-collection", "balance-forward". */
  report: string;
  format: ReportFormat;
  /** Number of rows included in the export. */
  rowCount?: number;
  /** Optional specific target id (e.g. invoice id for a single document). */
  targetId?: string;
  /** Filter params used to produce the export (for traceability). */
  filters?: Record<string, unknown>;
}

/**
 * Audit a report/document export.
 *
 * Financial reporting is sensitive — every export writes a `reports:export`
 * entry capturing who exported what, in which format, with which filters.
 */
export async function logReportExport({
  actor,
  report,
  format,
  rowCount,
  targetId,
  filters,
}: LogReportExportParams): Promise<void> {
  await logAudit({
    actor: actor.id ?? actor.userId ?? null,
    actorRole: actor.role,
    action: "reports:export",
    targetEntity: "reports",
    targetId: targetId ?? report,
    newState: { report, format, rowCount, filters },
  });
}
