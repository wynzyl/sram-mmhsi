import { requirePortalSession, getPortalUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

export default async function PortalDashboardPage() {
  await requirePortalSession();

  const user = await getPortalUser();
  if (!user) redirect("/login");

  // Display student's name
  const displayName = `${user.student.firstName} ${user.student.lastName}`;

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome, ${displayName}`}
        description="View your academic and payment information below."
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
