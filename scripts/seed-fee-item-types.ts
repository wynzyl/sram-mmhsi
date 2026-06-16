/**
 * SRAMS Fee Item Types Seed Script
 * Seeds master fee type definitions before migration to template-based system.
 * Run: npx tsx scripts/seed-fee-item-types.ts
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { feeItemTypes } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// ─── Fee Type Data ────────────────────────────────────────────────────────────
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

  // Materials
  {
    code: "BOOKS",
    name: "Books and Materials",
    category: "materials" as const,
    isDiscount: false,
    displayOrder: 4,
  },

  // Other
  {
    code: "BALANCE_FORWARD",
    name: "Balance Forward from Previous Year",
    category: "other" as const,
    isDiscount: false,
    displayOrder: 6, // Show first in assessments
  },
  {
    code: "OTHER",
    name: "Other Fees",
    category: "other" as const,
    isDiscount: false,
    displayOrder: 5,
  },
  {
    code: "BACK_ACCTS",
    name: "Back Accounts Receivable",
    category: "other" as const,
    isDiscount: false,
    displayOrder: 7,
  },
];

// ─── Exportable Seed Function ─────────────────────────────────────────────────
export async function seedFeeItemTypes(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding fee item types...");

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

  seedFeeItemTypes(db)
    .then(async () => {
      console.log("✅ Done!");
      await client.end();
    })
    .catch(async (err) => {
      console.error("❌ Seed failed:", err);
      await client.end();
      process.exit(1);
    });
}
