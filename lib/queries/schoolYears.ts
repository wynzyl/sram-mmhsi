import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";

export async function getSchoolYears() {
  return db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      isActive: schoolYears.isActive,
    })
    .from(schoolYears)
    .orderBy(desc(schoolYears.startDate));
}
