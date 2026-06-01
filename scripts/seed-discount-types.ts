/**
 * SRAMS Discount Types Seed Script
 * Seeds master discount type definitions for the discount queue system.
 * Run: npx tsx scripts/seed-discount-types.ts
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { discountTypes } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// ─── Discount Type Data ───────────────────────────────────────────────────────
const defaultDiscountTypes = [
    // ─── Tuition-only discounts (most common) ────────────────────────────────
    {
      code: "ESC_20",
      name: "ESC 20% Government Subsidy",
      description: "Education Service Contracting 20% tuition subsidy from DepEd",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "20.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 1,
    },
    {
      code: "ESC_50",
      name: "ESC 50% Government Subsidy",
      description: "Education Service Contracting 50% tuition subsidy from DepEd",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "50.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 2,
    },
    {
      code: "ESC_100",
      name: "ESC Full Government Subsidy",
      description: "Education Service Contracting 100% tuition subsidy from DepEd",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "100.00",
      requiresDocumentation: true,
      isStackable: false,
      displayOrder: 3,
    },
    {
      code: "SIBLING_10",
      name: "10% Sibling Discount",
      description: "Discount for students with siblings enrolled in the school",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "10.00",
      requiresDocumentation: false,
      isStackable: true,
      displayOrder: 10,
    },
    {
      code: "SIBLING_15",
      name: "15% Sibling Discount (3rd child)",
      description: "Discount for 3rd child enrolled in the school",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "15.00",
      requiresDocumentation: false,
      isStackable: true,
      displayOrder: 11,
    },
    {
      code: "ACADEMIC_HONORS",
      name: "Academic Honors Scholarship",
      description: "Merit-based scholarship for honor students (With Honors)",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "25.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 20,
    },
    {
      code: "ACADEMIC_HIGH_HONORS",
      name: "High Honors Scholarship",
      description: "Merit-based scholarship for high honor students (With High Honors)",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "50.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 21,
    },
    {
      code: "ACADEMIC_HIGHEST_HONORS",
      name: "Highest Honors Scholarship",
      description: "Merit-based scholarship for highest honor students (With Highest Honors)",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "75.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 22,
    },
    {
      code: "SCHOLARSHIP_FULL",
      name: "Full Academic Scholarship",
      description: "100% tuition scholarship for exceptional students",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "100.00",
      requiresDocumentation: true,
      isStackable: false,
      displayOrder: 23,
    },
    {
      code: "SCHOLARSHIP_PARTIAL",
      name: "Partial Scholarship (₱10,000)",
      description: "Fixed amount scholarship grant",
      calculationType: "fixed_amount" as const,
      baseType: "tuition_only" as const,
      defaultValue: "10000.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 24,
    },
    {
      code: "EARLY_BIRD",
      name: "Early Bird Discount",
      description: "Discount for early enrollment payment",
      calculationType: "percentage" as const,
      baseType: "tuition_only" as const,
      defaultValue: "5.00",
      requiresDocumentation: false,
      isStackable: true,
      displayOrder: 30,
    },

    // ─── Full-assessment discounts (special cases) ───────────────────────────
    {
      code: "EMPLOYEE_DEPENDENT",
      name: "Employee Dependent Discount",
      description: "Discount for children of school employees (applies to full assessment)",
      calculationType: "percentage" as const,
      baseType: "full_assessment" as const,
      defaultValue: "25.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 40,
    },
    {
      code: "EMPLOYEE_DEPENDENT_50",
      name: "Employee Dependent 50% Discount",
      description: "50% discount for children of regular school employees",
      calculationType: "percentage" as const,
      baseType: "full_assessment" as const,
      defaultValue: "50.00",
      requiresDocumentation: true,
      isStackable: false,
      displayOrder: 41,
    },
    {
      code: "SPECIAL_CASE",
      name: "Special Case Discount",
      description: "Special discount approved by administration",
      calculationType: "fixed_amount" as const,
      baseType: "full_assessment" as const,
      defaultValue: "5000.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 50,
    },
    {
      code: "FINANCIAL_ASSISTANCE",
      name: "Financial Assistance",
      description: "Need-based financial assistance (applies to full assessment)",
      calculationType: "percentage" as const,
      baseType: "full_assessment" as const,
      defaultValue: "20.00",
      requiresDocumentation: true,
      isStackable: true,
      displayOrder: 51,
    },
];

// ─── Exportable Seed Function ─────────────────────────────────────────────────
export async function seedDiscountTypes(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding discount types...");

  let insertedCount = 0;
  let skippedCount = 0;

  for (const discountType of defaultDiscountTypes) {
    const existing = await db
      .select({ id: discountTypes.id })
      .from(discountTypes)
      .where(eq(discountTypes.code, discountType.code))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  Discount type ${discountType.code} already exists. Skipping.`);
      skippedCount++;
      continue;
    }

    await db.insert(discountTypes).values({
      ...discountType,
      isActive: true,
      createdBy: null, // System-generated
      updatedBy: null,
    });

    const baseLabel = discountType.baseType === "tuition_only" ? "tuition" : "full assessment";
    const valueLabel = discountType.calculationType === "percentage"
      ? `${discountType.defaultValue}%`
      : `₱${Number(discountType.defaultValue).toLocaleString()}`;

    console.log(`✅ ${discountType.code}: ${discountType.name} (${valueLabel} on ${baseLabel})`);
    insertedCount++;
  }

  console.log(`✨ Seed complete: ${insertedCount} inserted, ${skippedCount} skipped`);
}

// ─── Standalone Execution ─────────────────────────────────────────────────────
if (require.main === module) {
  expand(config({ path: ".env.local" }));
  expand(config());

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  seedDiscountTypes(db)
    .then(async () => {
      console.log("\n✅ Done!");
      await client.end();
    })
    .catch(async (err) => {
      console.error("❌ Seed failed:", err);
      await client.end();
      process.exit(1);
    });
}
