import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { ReceiptBookletManagementView } from "@/components/finance/ReceiptBookletManagementView";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { receiptBooklets } from "@/lib/db/schema";
import { hasPermission } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Receipt Booklet Management",
  description: "Register and oversee official receipt booklets.",
};

export default async function BookletsPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "booklets:manage")) {
    redirect("/admin/dashboard");
  }

  const booklets = await db.select().from(receiptBooklets).orderBy(desc(receiptBooklets.createdAt));
  return <ReceiptBookletManagementView booklets={booklets} footerNote="Operations panel visual is aligned with your receipt booklet reference layout." />;
}
