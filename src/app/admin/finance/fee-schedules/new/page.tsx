import type { Metadata } from "next";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import FeeScheduleForm from "@/components/finance/FeeScheduleForm";

export const metadata: Metadata = {
  title: "New Fee Schedule",
};

export default async function NewFeeSchedulePage() {
  const sys = await db
    .select({ id: schoolYears.id, label: schoolYears.label, isActive: schoolYears.isActive })
    .from(schoolYears)
    .orderBy(desc(schoolYears.startDate));

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Fee Schedule</h1>
          <p className="page-subtitle">
            Create a billing catalog for one school year and one assessment band (e.g. Casa, Junior
            High). Add the other bands separately as needed.
          </p>
        </div>
      </div>

      <FeeScheduleForm schoolYears={sys} />
    </div>
  );
}
