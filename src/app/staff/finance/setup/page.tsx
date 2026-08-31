import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { getSpedFeeAmount } from "@/features/settings/system-settings.actions";
import { SpedFeeSettingsForm } from "@/features/settings/components/SpedFeeSettingsForm";

export const metadata: Metadata = {
  title: "Billing Setup",
  description: "Configure fee templates, schedules, item types, discounts, and OR booklets.",
};

/**
 * Billing Setup hub — a single entry point that groups the billing configuration
 * pages (previously separate sidebar items). Each card is permission-gated and
 * links to the existing page, which is left untouched.
 */
export default async function BillingSetupPage() {
  const session = await requireSession();
  const role = session.role;

  const canManageFees = hasPermission(role, "fee_schedules:manage");
  const canViewFeeTypes = canManageFees || hasPermission(role, "assessments:read");
  const canManageBooklets = hasPermission(role, "booklets:manage");
  const canManageDiscounts = hasPermission(role, "discounts:manage");

  const cards: { href: string; title: string; description: string; show: boolean }[] = [
    {
      href: "/staff/finance/fee-templates",
      title: "Fee Templates",
      description: "Reusable fee structures per assessment band (Casa, Lower Elem, etc.).",
      show: canManageFees,
    },
    {
      href: "/staff/finance/fee-schedules",
      title: "Fee Schedules",
      description: "Assign fee templates to school years — one active schedule per band per year.",
      show: canManageFees,
    },
    {
      href: "/staff/finance/fee-item-types",
      title: "Fee Item Types",
      description: "Master list of reusable fee type definitions used when building templates.",
      show: canViewFeeTypes,
    },
    {
      href: "/staff/finance/discount-types",
      title: "Discount Types",
      description: "Configure the discount types available for student enrollments.",
      show: canManageDiscounts,
    },
    {
      href: "/staff/finance/booklets",
      title: "OR Booklets",
      description: "Register and oversee official receipt booklets for cashiers.",
      show: canManageBooklets,
    },
  ];

  const visibleCards = cards.filter((c) => c.show);

  if (visibleCards.length === 0) {
    redirect("/staff");
  }

  // Fetch SPED fee amount for the settings form
  const currentSpedFeeAmount = canManageFees ? await getSpedFeeAmount() : 0;

  return (
    <PageContainer>
      <PageHeader
        title="Billing Setup"
        description="Configure the fee templates, schedules, item types, discounts, and receipt booklets that drive assessments and payments."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* SPED Fee Configuration */}
      {canManageFees && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Special Education (SPED) Fee</CardTitle>
              <CardDescription>
                Configure the default fee amount added to assessments for SPED students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpedFeeSettingsForm currentAmount={currentSpedFeeAmount} />
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
