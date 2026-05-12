import "server-only";
import { db } from "@/lib/db";
import { feeItemTypes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getAllFeeItemTypesAdmin() {
  return await db.query.feeItemTypes.findMany({
    orderBy: [asc(feeItemTypes.displayOrder), asc(feeItemTypes.name)],
  });
}

export async function getFeeItemTypeById(id: string) {
  return await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.id, id),
  });
}

export async function getFeeItemTypeByCode(code: string) {
  return await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.code, code),
  });
}
