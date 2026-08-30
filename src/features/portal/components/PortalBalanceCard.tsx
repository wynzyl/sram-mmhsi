import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PortalSection } from "./PortalSection";

interface PortalBalanceCardProps {
  balance: number | null;
  billingStatus: string | null;
  href?: string;
}

/**
 * Finance anchor on the portal dashboard.
 *
 * The account is shared between a parent and a student. This card serves the
 * parent: the outstanding balance is the single figure they signed in to see,
 * so it is the largest thing on the page.
 *
 * Deliberately shows no payment-progress bar. getPortalDashboardSummary does
 * not return the assessment total, and a percentage cannot be derived from a
 * balance alone. The bar lives on /portal/assessments where the real totals
 * are available.
 */
export function PortalBalanceCard({
  balance,
  billingStatus,
  href = "/portal/assessments",
}: PortalBalanceCardProps) {
  const settled = balance !== null && balance <= 0;

  return (
    <PortalSection
      title="Outstanding balance"
      badge={
        billingStatus ? (
          <StatusBadge type="billing" status={billingStatus} />
        ) : null
      }
      footer={
        <Link
          href={href}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          View assessments
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
      className="h-full"
    >
      {balance === null ? (
        <p className="text-sm text-muted-foreground">
          No active assessment. Fee details appear here once you are enrolled.
        </p>
      ) : (
        <p
          className={`text-3xl font-bold tracking-tight sm:text-4xl ${
            settled ? "text-success" : "text-foreground"
          }`}
        >
          <CurrencyDisplay
            amount={settled ? 0 : balance}
            srLabel="Outstanding balance"
          />
        </p>
      )}
    </PortalSection>
  );
}
