import { getArAging, getCollectionSummary } from "@/lib/queries/finance-dashboard";
import { ArAgingCard } from "./ArAgingCard";
import { CollectionSummaryCard } from "./CollectionSummaryCard";

interface FinanceInsightsSectionProps {
  schoolYearId: string;
}

/**
 * Reusable finance insights block — collection summary + AR aging for the
 * given school year. Rendered on both the admin and finance-officer dashboards.
 * Server component: fetches both datasets in parallel.
 */
export async function FinanceInsightsSection({
  schoolYearId,
}: FinanceInsightsSectionProps) {
  const [collection, aging] = await Promise.all([
    getCollectionSummary(schoolYearId),
    getArAging(schoolYearId),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <CollectionSummaryCard data={collection} />
      <ArAgingCard data={aging} />
    </div>
  );
}
