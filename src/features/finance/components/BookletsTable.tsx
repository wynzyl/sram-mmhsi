"use client";

import { Download, Pencil, SlidersHorizontal } from "lucide-react";
import { formatStoredOrNumber, orNumberPadWidth } from "@/lib/utils/or-number";
import { getReceiptStatusClasses } from "@/lib/utils/receipt-theme";
import { formatDate } from "@/lib/utils/date";

interface ReceiptBooklet {
  id: string;
  series: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  nextNumber: number;
  status: string;
  usageMode: "auto_only" | "manual_only";
  createdAt: Date;
  assignedToUsername: string | null;
}

interface BookletsTableProps {
  booklets: ReceiptBooklet[];
  variant?: "default" | "dashboard";
}

export default function BookletsTable({ booklets, variant = "default" }: BookletsTableProps) {
  if (variant !== "dashboard") {
    return (
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Series</th>
              <th>OR prefix</th>
              <th>Start Number</th>
              <th>End Number</th>
              <th>Next OR</th>
              <th>Mode</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {booklets.length === 0 ? (
              <tr>
                <td colSpan={9} className="table-empty">
                  No receipt booklets found.
                </td>
              </tr>
            ) : (
              booklets.map((booklet) => {
                const w = orNumberPadWidth();
                return (
                  <tr key={booklet.id} className="table-row-hover">
                    <td className="font-semibold">{booklet.series}</td>
                    <td className="font-semibold">{booklet.prefix}</td>
                    <td className="font-mono">{String(booklet.startNumber).padStart(w, "0")}</td>
                    <td className="font-mono">{String(booklet.endNumber).padStart(w, "0")}</td>
                    <td className={`font-mono ${booklet.status === "active" ? "text-primary" : ""}`}>
                      {booklet.status === "active" ? formatStoredOrNumber(booklet.prefix, booklet.nextNumber) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${booklet.usageMode === "auto_only" ? "badge-info" : "badge-warning"}`}>
                        {booklet.usageMode === "auto_only" ? "Auto" : "Manual"}
                      </span>
                    </td>
                    <td>
                      {booklet.assignedToUsername ? (
                        <span className="badge badge-purple">{booklet.assignedToUsername}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge capitalize ${getReceiptStatusClasses(booklet.status)}`}>{booklet.status}</span>
                    </td>
                    <td className="text-muted">{formatDate(booklet.createdAt, { year: "numeric", month: "numeric", day: "numeric" })}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const w = orNumberPadWidth();

  return (
    <div className="bg-card border border-border rounded-md p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-3xl text-foreground">Active Booklets</h2>
        <div className="flex items-center gap-2">
          <button type="button" className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted" aria-label="Filter">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button type="button" className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted" aria-label="Download">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="bg-transparent border-b border-border [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
              <th className="px-4 py-3 font-medium">Booklet ID</th>
              <th className="px-4 py-3 font-medium">Range</th>
              <th className="px-4 py-3 font-medium">Current</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Assigned To</th>
              <th className="px-4 py-3 font-medium">Date Issued</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {booklets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No receipt booklets found.
                </td>
              </tr>
            ) : (
              booklets.map((booklet) => (
                <tr key={booklet.id} className="border-b border-border transition-colors hover:bg-muted last:border-b-0">
                  <td className="p-4 align-middle">
                    <p className="font-semibold tracking-wide text-foreground">{booklet.prefix}</p>
                    <p className="mt-1 font-mono text-[13px] text-muted-foreground">{booklet.series}</p>
                  </td>
                  <td className="p-4 align-middle font-mono text-foreground">
                    <span>{String(booklet.startNumber).padStart(w, "0")}</span>
                    <span className="text-muted-foreground"> – {String(booklet.endNumber).padStart(w, "0")}</span>
                  </td>
                  <td className="p-4 align-middle">
                    <span className="inline-flex min-w-[92px] items-center justify-center border border-border bg-muted px-2 py-1 font-mono text-[13px] text-foreground">
                      {booklet.status === "active" ? formatStoredOrNumber(booklet.prefix, booklet.nextNumber) : "--"}
                    </span>
                  </td>
                  <td className="p-4 align-middle">
                    <span className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium ${
                      booklet.usageMode === "auto_only"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }`}>
                      {booklet.usageMode === "auto_only" ? "Auto" : "Manual"}
                    </span>
                  </td>
                  <td className="p-4 align-middle">
                    {booklet.assignedToUsername ? (
                      <span className="inline-flex items-center rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
                        {booklet.assignedToUsername}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-4 align-middle text-sm text-muted-foreground">
                    {formatDate(booklet.createdAt, { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="p-4 align-middle">
                    <span className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium capitalize ${getReceiptStatusClasses(booklet.status)}`}>
                      {booklet.status}
                    </span>
                  </td>
                  <td className="p-4 align-middle text-right">
                    <button type="button" className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
