import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getAllDiscountTypes } from "@/features/discounts";
import DiscountTypesTable from "@/features/discounts/components/DiscountTypesTable";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Discount Types",
  description: "Manage available discount types for student enrollments.",
};

export default async function DiscountTypesPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "discounts:manage")) {
    redirect("/staff/finance");
  }

  const discountTypes = await getAllDiscountTypes();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold">Discount Types</h1>
        <p className="text-muted-foreground">
          Configure discount types available for student enrollments
        </p>
      </div>

      {/* Discount Types Table */}
      <Card>
        <CardContent className="p-0">
          <DiscountTypesTable discountTypes={discountTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
