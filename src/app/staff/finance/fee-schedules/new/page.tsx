import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import FeeScheduleForm from "@/components/finance/FeeScheduleForm";

export const metadata: Metadata = {
  title: "New Fee Schedule",
};

export default async function StaffNewFeeSchedulePage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

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
            Create a billing catalog for one school year and one assessment band.
          </p>
        </div>
      </div>

      <FeeScheduleForm schoolYears={sys} />
    </div>
  );
}
