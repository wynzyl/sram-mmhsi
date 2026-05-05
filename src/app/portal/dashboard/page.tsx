import { requireSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PORTAL_ROLES, ROLE_LABELS } from "@/lib/constants/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import type { Role } from "@/lib/constants/roles";

export default async function PortalDashboardPage() {
  const session = await requireSession();

  if (!PORTAL_ROLES.includes(session.role)) {
    redirect("/login");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roleLabel = ROLE_LABELS[user.role as Role];

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${user.username}`}
        description={`Logged in as ${roleLabel}. View your academic and payment information below.`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/portal/assessments" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Assessments</CardTitle>
              <CardDescription>
                View your fee assessment and outstanding balance.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/payments" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                View your payment history and official receipts.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/portal/grades" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Grades</CardTitle>
              <CardDescription>
                View your quarterly grades and academic performance.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
