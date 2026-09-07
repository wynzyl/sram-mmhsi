import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { desc, eq, and, isNull } from "drizzle-orm";
import { ReceiptBookletManagementView } from "@/features/finance/components/ReceiptBookletManagementView";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { receiptBooklets, users } from "@/lib/db/schema";
import { hasPermission } from "@/lib/rbac/permissions";
import { ROLES } from "@/lib/constants/roles";
import { getCashiersForBookletAssignment } from "@/features/payments/payments.queries";
import { Skeleton } from "@/components/ui/skeleton";

// Instant navigation enabled - uses Suspense for streaming

export const metadata: Metadata = {
  title: "Receipt Booklet Management",
  description: "Register and oversee official receipt booklets.",
};

/**
 * Static shell - page wrapper renders immediately.
 */
export default function StaffBookletsPage() {
  return (
    <Suspense fallback={<BookletsPageSkeleton />}>
      <BookletsPageContent />
    </Suspense>
  );
}

function BookletsPageSkeleton() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Series</th>
              <th>Range</th>
              <th>Next OR</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((i) => (
              <tr key={i}>
                <td><Skeleton className="h-4 w-16" /></td>
                <td><Skeleton className="h-4 w-32" /></td>
                <td><Skeleton className="h-4 w-20" /></td>
                <td><Skeleton className="h-4 w-16" /></td>
                <td><Skeleton className="h-4 w-24" /></td>
                <td><Skeleton className="h-4 w-16" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function BookletsPageContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "booklets:manage")) {
    redirect("/staff/finance");
  }

  // Determine if user is admin
  const isAdmin = session.role === ROLES.ADMIN || session.role === ROLES.SUPER_ADMIN;

  const [bookletRows, cashiers] = await Promise.all([
    // Left join to get assigned user for each booklet
    db
      .select({
        id: receiptBooklets.id,
        series: receiptBooklets.series,
        prefix: receiptBooklets.prefix,
        startNumber: receiptBooklets.startNumber,
        endNumber: receiptBooklets.endNumber,
        nextNumber: receiptBooklets.nextNumber,
        status: receiptBooklets.status,
        usageMode: receiptBooklets.usageMode,
        createdAt: receiptBooklets.createdAt,
        assignedToUsername: users.username,
        assignedToCashierId: users.id,
      })
      .from(receiptBooklets)
      .leftJoin(
        users,
        and(
          eq(users.defaultBookletId, receiptBooklets.id),
          isNull(users.deletedAt)
        )
      )
      .orderBy(desc(receiptBooklets.createdAt)),
    getCashiersForBookletAssignment(),
  ]);

  // Transform to expected shape
  const booklets = bookletRows.map((row) => ({
    ...row,
    assignedToUsername: row.assignedToUsername ?? null,
    assignedToCashierId: row.assignedToCashierId ?? null,
  }));

  return (
    <ReceiptBookletManagementView
      booklets={booklets}
      cashiers={cashiers}
      isAdmin={isAdmin}
      footerNote="Staff operations panel now matches the receipt booklet reference layout."
    />
  );
}
