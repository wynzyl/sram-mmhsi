import type { Metadata } from "next";
import { db } from "@/lib/db";
import { schoolYears, gradeLevels } from "@/lib/db/schema";
import { desc, asc } from "drizzle-orm";
import FeeScheduleForm from "@/components/finance/FeeScheduleForm";

export const metadata: Metadata = {
  title: "New Fee Schedule",
};

export default async function NewFeeSchedulePage() {
  const [sys, gls] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label, isActive: schoolYears.isActive })
      .from(schoolYears)
      .orderBy(desc(schoolYears.startDate)),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.order)),
  ]);

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Fee Schedule</h1>
          <p className="page-subtitle">
            Create a base template for generating assessments.
          </p>
        </div>
      </div>

      <FeeScheduleForm schoolYears={sys} gradeLevels={gls} />
    </div>
  );
}
