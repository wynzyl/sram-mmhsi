import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getAllPaymentCollectionData,
  getPaymentCollectionSummary,
} from "@/features/reports/payment-collection-report.queries";
import { PAYMENT_METHOD_LABELS } from "@/features/reports/payment-collection-report.types";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}

export async function GET(request: NextRequest) {
  // Auth check
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Permission check
  if (!hasPermission(user.role, "reports:view")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const schoolYearId = searchParams.get("schoolYearId") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const paymentStatus = searchParams.get("paymentStatus") || undefined;

  // Parse dates with defaults (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const parsedStartDate = startDateParam ? new Date(startDateParam) : null;
  const startDate =
    parsedStartDate && !isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : thirtyDaysAgo;
  startDate.setHours(0, 0, 0, 0);

  const parsedEndDate = endDateParam ? new Date(endDateParam) : null;
  const endDate =
    parsedEndDate && !isNaN(parsedEndDate.getTime()) ? parsedEndDate : today;
  endDate.setHours(23, 59, 59, 999);

  try {
    // Fetch data
    const [rows, summary] = await Promise.all([
      getAllPaymentCollectionData({
        startDate,
        endDate,
        schoolYearId,
        paymentMethod,
        paymentStatus,
      }),
      getPaymentCollectionSummary({
        startDate,
        endDate,
        schoolYearId,
        paymentMethod,
        paymentStatus,
      }),
    ]);

    // Generate table rows HTML (reduced columns for portrait orientation)
    const tableRows = rows
      .map(
        (row, index) => `
      <tr style="background: ${index % 2 === 0 ? "#fff" : "#f9fafb"};">
        <td class="col-or">${row.orNumber || "—"}</td>
        <td class="col-date">${formatShortDate(row.collectionDate)}</td>
        <td class="col-student">${row.studentName}</td>
        <td class="col-grade">${row.gradeLevel}</td>
        <td class="col-amount">${formatAmount(Number(row.amount))}</td>
        <td class="col-method">${PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod}</td>
        <td class="col-processed">${row.processedBy || "—"}</td>
      </tr>
    `
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Collection Report - SRAMS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111827;
      background: #fff;
    }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: portrait; margin: 0.5in; }
      .no-print { display: none !important; }
    }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    /* Column widths for portrait layout */
    .col-or { width: 12%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 11px; }
    .col-date { width: 12%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
    .col-student { width: 22%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
    .col-grade { width: 10%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
    .col-amount { width: 14%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500; white-space: nowrap; }
    .col-method { width: 12%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
    .col-processed { width: 18%; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
    .header {
      padding: 24px;
      border-bottom: 2px solid #dc2626;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 24px; font-weight: 700; color: #111827; }
    .header p { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .meta { text-align: right; font-size: 12px; color: #6b7280; }
    .summary {
      background: #f9fafb;
      padding: 20px 24px;
      border-radius: 8px;
      margin-bottom: 24px;
      border: 1px solid #e5e7eb;
    }
    .summary h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .summary-grid { display: flex; gap: 32px; flex-wrap: wrap; }
    .summary-item { }
    .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 500; }
    .summary-value { font-size: 24px; font-weight: 700; color: #111827; margin-top: 4px; }
    .summary-value.primary { color: #dc2626; }
    .method-breakdown {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    .method-item {
      background: #fff;
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .method-label { font-size: 10px; color: #6b7280; }
    .method-value { font-size: 13px; font-weight: 600; color: #111827; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #f3f4f6; }
    th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #d1d5db;
    }
    th.right { text-align: right; }
    tfoot tr { background: #f3f4f6; font-weight: 600; }
    tfoot td { padding: 10px 12px; border-top: 2px solid #d1d5db; }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #6b7280;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .print-btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print Report</button>

  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1>Payment Collection Report</h1>
          <p>SRAMS - School Registration and Accounts Monitoring System</p>
        </div>
        <div class="meta">
          <p><strong>Period:</strong> ${formatDate(summary.periodStart)} - ${formatDate(summary.periodEnd)}</p>
          <p style="margin-top: 4px;"><strong>Generated:</strong> ${formatDateTime(new Date())}</p>
        </div>
      </div>
    </div>

    <div class="summary">
      <h2>Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">Total Payments</div>
          <div class="summary-value">${summary.totalCount.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Total Amount</div>
          <div class="summary-value primary">${formatAmount(summary.totalAmount)}</div>
        </div>
      </div>

      <div class="method-breakdown">
        <div class="method-item">
          <div class="method-label">Cash</div>
          <div class="method-value">${formatAmount(summary.byMethod.cash)}</div>
        </div>
        <div class="method-item">
          <div class="method-label">GCash</div>
          <div class="method-value">${formatAmount(summary.byMethod.gcash)}</div>
        </div>
        <div class="method-item">
          <div class="method-label">Bank Transfer</div>
          <div class="method-value">${formatAmount(summary.byMethod.bank_transfer)}</div>
        </div>
        <div class="method-item">
          <div class="method-label">Check</div>
          <div class="method-value">${formatAmount(summary.byMethod.check)}</div>
        </div>
        <div class="method-item">
          <div class="method-label">Other</div>
          <div class="method-value">${formatAmount(summary.byMethod.other)}</div>
        </div>
      </div>
    </div>

    <h2 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">
      Payment Details (${rows.length.toLocaleString()} records)
    </h2>

    ${
      rows.length === 0
        ? '<p style="text-align: center; padding: 40px; color: #6b7280;">No payments found for the selected period.</p>'
        : `
    <table>
      <thead>
        <tr>
          <th class="col-or">OR #</th>
          <th class="col-date">Date</th>
          <th class="col-student">Student</th>
          <th class="col-grade">Grade</th>
          <th class="col-amount" style="text-align: right;">Amount</th>
          <th class="col-method">Method</th>
          <th class="col-processed">Processed By</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="text-align: right;">Total:</td>
          <td style="text-align: right; color: #dc2626; padding: 8px 6px;">${formatAmount(summary.totalAmount)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    `
    }

    <div class="footer">
      <span>SRAMS Payment Collection Report</span>
      <span>Page 1 of 1</span>
    </div>
  </div>

  <script>
    // Auto-print on load
    window.onload = function() {
      // Small delay to ensure styles are loaded
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Print page error:", error);
    return new NextResponse("Failed to generate print page", { status: 500 });
  }
}
