import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  isReportExportRateLimited,
  getReportExportResetSeconds,
} from "@/lib/security/rateLimit";
import { getDocumentExportData } from "@/features/documents/document-requests.queries";
import {
  generateDocument,
  getDocumentFilename,
} from "@/features/documents/document.export";
import { pdfResponse } from "@/features/reports/shared/report-response";
import { logReportExport } from "@/features/reports/shared/audit-report";
import { DOCUMENT_REQUEST_TYPE_LABELS } from "@/lib/constants/document-requests";

/**
 * Official document PDF export.
 *
 *   GET /staff/archive/documents/{id}/export?format=pdf
 *
 * Generates the appropriate official document (Form 137, Good Moral, etc.)
 * based on the document request type. Served inline for print/preview.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // documents:release permission is required to export/print documents
  if (!hasPermission(user.role, "documents:release")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Rate limit: 10 exports per minute per user
  if (isReportExportRateLimited(user.id)) {
    const resetSeconds = getReportExportResetSeconds(user.id);
    return NextResponse.json(
      { error: `Too many export requests. Try again in ${resetSeconds} seconds.` },
      { status: 429 }
    );
  }

  const { id } = await params;

  // Fetch document data
  const data = await getDocumentExportData(id);

  if (!data) {
    return new NextResponse("Document request not found", { status: 404 });
  }

  // Generate the PDF document
  const documentElement = generateDocument(data);
  const buffer = await renderToBuffer(documentElement);

  // Log the export
  await logReportExport({
    actor: user,
    report: `document-${data.documentType}`,
    format: "pdf",
    targetId: id,
    filters: {
      documentType: DOCUMENT_REQUEST_TYPE_LABELS[data.documentType],
      studentRef: data.studentReferenceNumber,
      documentNumber: data.documentNumber,
    },
  });

  // Return the PDF
  const filename = getDocumentFilename(data);
  return pdfResponse(buffer, filename, { inline: true });
}
