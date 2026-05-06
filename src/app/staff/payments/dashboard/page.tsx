import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { hasPermission } from "@/lib/rbac/permissions";

export default async function CashierDashboardPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:read")) {
    redirect("/login");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Cashier Dashboard"
        description="Post payments and manage official receipts."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/staff/payments" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Post Payment</CardTitle>
              <CardDescription>
                Record a student payment and issue an official receipt.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/invoices" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                View outstanding student invoices and balances.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/staff/finance/booklets" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>OR Booklets</CardTitle>
              <CardDescription>
                Check available booklets and remaining OR numbers.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}

