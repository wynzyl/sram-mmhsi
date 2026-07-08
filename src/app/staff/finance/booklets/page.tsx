import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq, and, isNull } from "drizzle-orm";
import { ReceiptBookletManagementView } from "@/features/finance/components/ReceiptBookletManagementView";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { receiptBooklets, users } from "@/lib/db/schema";
import { hasPermission } from "@/lib/rbac/permissions";
import { getCashiersForBookletAssignment } from "@/features/payments/payments.queries";

export const metadata: Metadata = {
  title: "Receipt Booklet Management",
  description: "Register and oversee official receipt booklets.",
};

export default async function StaffBookletsPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "booklets:manage")) {
    redirect("/staff/finance");
  }

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

  // Transform to expected shape (assignedToUsername may be null)
  const booklets = bookletRows.map((row) => ({
    ...row,
    assignedToUsername: row.assignedToUsername ?? null,
  }));

  return (
    <ReceiptBookletManagementView
      booklets={booklets}
      cashiers={cashiers}
      footerNote="Staff operations panel now matches the receipt booklet reference layout."
    />
  );
}
