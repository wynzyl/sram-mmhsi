import { NextResponse } from "next/server";

/**
 * Standard HTTP responses for report/document exports.
 *
 * Every export route returns through these helpers so headers
 * (`Content-Type`, `Content-Disposition`) stay consistent.
 */

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Bytes = Buffer | Uint8Array | ArrayBuffer;

function toUint8Array(bytes: Bytes): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  return new Uint8Array(bytes);
}

function fileResponse(
  bytes: Bytes,
  filename: string,
  contentType: string,
  disposition: "attachment" | "inline",
) {
  return new NextResponse(toUint8Array(bytes) as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}

/**
 * Return a PDF buffer.
 * @param opts.inline When true, display in the browser (for print/preview)
 *   instead of forcing a download. Defaults to attachment (download).
 */
export function pdfResponse(
  bytes: Bytes,
  filename: string,
  opts: { inline?: boolean } = {},
): NextResponse {
  return fileResponse(
    bytes,
    ensureExt(filename, ".pdf"),
    "application/pdf",
    opts.inline ? "inline" : "attachment",
  );
}

/** Return an XLSX buffer as a downloadable attachment. */
export function xlsxResponse(bytes: Bytes, filename: string): NextResponse {
  return fileResponse(bytes, ensureExt(filename, ".xlsx"), XLSX_MIME, "attachment");
}

function ensureExt(filename: string, ext: string): string {
  return filename.toLowerCase().endsWith(ext) ? filename : `${filename}${ext}`;
}

/** Supported export formats. */
export type ReportFormat = "pdf" | "xlsx";

/** Parse + validate the `format` query param. Defaults to "pdf". */
export function parseReportFormat(value: string | null): ReportFormat {
  return value === "xlsx" ? "xlsx" : "pdf";
}
