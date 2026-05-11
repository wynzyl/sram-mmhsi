/**
 * SRAMS Fee Item Types Seed Script
 * Seeds master fee type definitions before migration to template-based system.
 * Run: npx tsx scripts/seed-fee-item-types.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { feeItemTypes } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seedFeeItemTypes() {
  console.log("🌱 Seeding fee item types...");

  const defaultFeeTypes = [
    // Tuition
    {
      code: "TUITION",
      name: "Tuition Fee",
      category: "tuition" as const,
      isDiscount: false,
      displayOrder: 1,
    },

    // Fees
    {
      code: "MISC",
      name: "Miscellaneous Fees",
      category: "fees" as const,
      isDiscount: false,
      displayOrder: 2,
    },
    {
      code: "REGISTRATION",
      name: "Registration Fee",
      category: "fees" as const,
      isDiscount: false,
      displayOrder: 3,
    },
    {
      code: "LABORATORY",
      name: "Laboratory Fee",
      category: "fees" as const,
      isDiscount: false,
      displayOrder: 4,
    },
    {
      code: "LIBRARY",
      name: "Library Fee",
      category: "fees" as const,
      isDiscount: false,
      displayOrder: 5,
    },
    {
      code: "COMPUTER",
      name: "Computer Fee",
      category: "fees" as const,
      isDiscount: false,
      displayOrder: 6,
    },

    // Materials
    {
      code: "BOOKS",
      name: "Books and Materials",
      category: "materials" as const,
      isDiscount: false,
      displayOrder: 7,
    },
    {
      code: "ID",
      name: "ID and School Supplies",
      category: "materials" as const,
      isDiscount: false,
      displayOrder: 8,
    },
    {
      code: "UNIFORM",
      name: "Uniform",
      category: "materials" as const,
      isDiscount: false,
      displayOrder: 9,
    },

    // Discounts
    {
      code: "SIBLING_DISC",
      name: "Sibling Discount",
      category: "discount" as const,
      isDiscount: true,
      displayOrder: 10,
    },
    {
      code: "EARLY_BIRD",
      name: "Early Bird Discount",
      category: "discount" as const,
      isDiscount: true,
      displayOrder: 11,
    },
    {
      code: "SCHOLARSHIP",
      name: "Scholarship Grant",
      category: "discount" as const,
      isDiscount: true,
      displayOrder: 12,
    },

    // Other
    {
      code: "OTHER",
      name: "Other Fees",
      category: "other" as const,
      isDiscount: false,
      displayOrder: 99,
    },
  ];

  let insertedCount = 0;
  let skippedCount = 0;

  for (const feeType of defaultFeeTypes) {
    const existing = await db
      .select({ id: feeItemTypes.id })
      .from(feeItemTypes)
      .where(eq(feeItemTypes.code, feeType.code))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  Fee type ${feeType.code} already exists. Skipping.`);
      skippedCount++;
      continue;
    }

    await db.insert(feeItemTypes).values({
      ...feeType,
      isActive: true,
      createdBy: null, // System-generated
      updatedBy: null,
    });

    console.log(`✅ Fee type ${feeType.code} created`);
    insertedCount++;
  }

  console.log(`\n✨ Seed complete: ${insertedCount} inserted, ${skippedCount} skipped`);
}

seedFeeItemTypes()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
