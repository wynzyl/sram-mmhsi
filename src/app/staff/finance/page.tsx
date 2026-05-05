import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

export default async function FinanceOfficerDashboardPage() {
  const session = await requireSession();

  if (session.role !== "finance_officer") {
    redirect("/login");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Finance Dashboard"
        description="Manage fee schedules, OR booklets, invoices, and student assessments."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/staff/assessments" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Assessments</CardTitle>
              <CardDescription>
                View and manage student fee assessments.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/finance/fee-schedules" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Fee Schedules</CardTitle>
              <CardDescription>
                Configure fee structures for each school year and grade level.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/finance/booklets" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>OR Booklets</CardTitle>
              <CardDescription>
                Create and manage official receipt booklets for cashiers.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/finance/invoices" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                Send and track invoices for outstanding student balances.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
