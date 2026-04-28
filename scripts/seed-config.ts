/**
 * SRAMS Configuration Seed Script
 * Seeds school years and grade levels needed for the student registration form.
 * Run: npx tsx scripts/seed-config.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schoolYears, gradeLevels } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seedConfig() {
  console.log("🌱 Seeding school configuration...");

  // ─── School Year ────────────────────────────────────────────────────────────
  const existingSY = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.label, "2025-2026"))
    .limit(1);

  let schoolYearId: string;

  if (existingSY.length > 0) {
    schoolYearId = existingSY[0].id;
    console.log("✅ School year 2025-2026 already exists. Skipping.");
  } else {
    const [sy] = await db
      .insert(schoolYears)
      .values({
        label: "2025-2026",
        startDate: new Date("2025-06-01"),
        endDate: new Date("2026-03-31"),
        isActive: true,
      })
      .returning({ id: schoolYears.id });
    schoolYearId = sy.id;
    console.log("✅ School year 2025-2026 created:", schoolYearId);
  }

  // ─── Grade Levels ───────────────────────────────────────────────────────────
  const gradeData = [
    { name: "Kinder 1", order: 1 },
    { name: "Kinder 2", order: 2 },
    { name: "Grade 1", order: 3 },
    { name: "Grade 2", order: 4 },
    { name: "Grade 3", order: 5 },
    { name: "Grade 4", order: 6 },
    { name: "Grade 5", order: 7 },
    { name: "Grade 6", order: 8 },
    { name: "Grade 7", order: 9 },
    { name: "Grade 8", order: 10 },
    { name: "Grade 9", order: 11 },
    { name: "Grade 10", order: 12 },
    { name: "Grade 11", order: 13 },
    { name: "Grade 12", order: 14 },
  ];

  const existingGLs = await db
    .select({ name: gradeLevels.name })
    .from(gradeLevels);

  const existingNames = new Set(existingGLs.map((g) => g.name));
  const toInsert = gradeData.filter((g) => !existingNames.has(g.name));

  if (toInsert.length > 0) {
    await db.insert(gradeLevels).values(toInsert);
    console.log(`✅ Created ${toInsert.length} grade levels.`);
  } else {
    console.log("✅ All grade levels already exist. Skipping.");
  }

  console.log("\n✅ Configuration seeding complete!");
  await client.end();
}

seedConfig().catch((err) => {
  console.error("❌ Config seed failed:", err);
  process.exit(1);
});
