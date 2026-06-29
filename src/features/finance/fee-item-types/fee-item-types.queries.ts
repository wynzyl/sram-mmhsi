import "server-only";
import { db } from "@/lib/db";
import { feeItemTypes } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DTO Types — explicit contracts for query return shapes
// ---------------------------------------------------------------------------

/** Minimal fields for dropdowns/lists (excludes audit fields) */
export type FeeItemTypeLookup = {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
};

/** Full detail for list views and edit forms */
export type FeeItemTypeListRow = {
  id: string;
  code: string;
  name: string;
  category: "tuition" | "fees" | "materials" | "discount" | "other";
  isDiscount: boolean;
  isRefundable: boolean;
  displayOrder: number;
  isActive: boolean;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns all fee item types for admin list view (excludes audit fields) */
export async function getAllFeeItemTypesAdmin(): Promise<FeeItemTypeListRow[]> {
  return await db.query.feeItemTypes.findMany({
    columns: {
      id: true,
      code: true,
      name: true,
      category: true,
      isDiscount: true,
      isRefundable: true,
      displayOrder: true,
      isActive: true,
    },
    orderBy: [asc(feeItemTypes.displayOrder), asc(feeItemTypes.name)],
  });
}

/** Returns a single fee item type by ID for edit forms (excludes audit fields) */
export async function getFeeItemTypeById(id: string): Promise<FeeItemTypeListRow | undefined> {
  return await db.query.feeItemTypes.findFirst({
    columns: {
      id: true,
      code: true,
      name: true,
      category: true,
      isDiscount: true,
      isRefundable: true,
      displayOrder: true,
      isActive: true,
    },
    where: eq(feeItemTypes.id, id),
  });
}

/** Returns a single fee item type by code for validation lookups */
export async function getFeeItemTypeByCode(code: string): Promise<FeeItemTypeListRow | undefined> {
  return await db.query.feeItemTypes.findFirst({
    columns: {
      id: true,
      code: true,
      name: true,
      category: true,
      isDiscount: true,
      isRefundable: true,
      displayOrder: true,
      isActive: true,
    },
    where: eq(feeItemTypes.code, code),
  });
}
