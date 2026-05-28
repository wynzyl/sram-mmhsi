import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getCancellationRequestById } from "@/features/enrollments/enrollment-cancellation.queries";
import CancellationRequestDetailView from "@/features/enrollments/components/CancellationRequestDetail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Review Cancellation Request" };

interface PageProps {
  params: Promise<{ requestId: string }>;
}

export default async function CancellationRequestDetailPage({
  params,
}: PageProps) {
  const session = await requireSession();

  // Only admin/super_admin can access
  if (!["admin", "super_admin"].includes(session.role)) {
    redirect("/admin/cancellation-requests");
  }

  const { requestId } = await params;

  const request = await getCancellationRequestById(requestId);

  if (!request) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Link href="/admin/cancellation-requests">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </header>

      <CancellationRequestDetailView
        request={request}
        currentUserId={session.userId}
      />
    </div>
  );
}
