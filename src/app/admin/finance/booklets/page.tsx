import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { receiptBooklets } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import BookletsTable from "@/components/finance/BookletsTable";

export const metadata: Metadata = {
  title: "Receipt Booklets",
  description: "Manage Official Receipt (OR) booklets.",
};

export default async function BookletsPage() {
  const session = await requireSession();
  
  if (!hasPermission(session.role, "booklets:manage")) {
    redirect("/admin/dashboard");
  }

  const booklets = await db
    .select()
    .from(receiptBooklets)
    .orderBy(desc(receiptBooklets.createdAt));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Receipt Booklets</h1>
          <p className="page-subtitle">
            Manage OR booklets used for payment posting.
          </p>
        </div>
        <Link href="/admin/finance/booklets/new" className="btn-primary">
          + Register Booklet
        </Link>
      </div>

      <BookletsTable booklets={booklets} />
    </div>
  );
}
