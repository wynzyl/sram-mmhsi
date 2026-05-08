import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import FeeScheduleForm from "@/components/finance/FeeScheduleForm";
import { getSchoolYears } from "@/src/queries/schoolYears";

export const metadata: Metadata = {
  title: "New Fee Schedule",
};

export default async function StaffNewFeeSchedulePage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    redirect("/staff/dashboard");
  }

  const sys = await getSchoolYears();

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
