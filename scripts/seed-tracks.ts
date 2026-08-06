/**
 * SRAMS SHS Tracks Seed Script
 * Seeds SHS academic tracks with the new admin-managed structure.
 * Run: npx tsx scripts/seed-tracks.ts
 *
 * This script updates the strands table with:
 * - shortCode: Short code for UI badges
 * - trackCategory: academic, tvl, or specialized
 *
 * Standard tracks: STEM, ABM, HUMSS, GAS, TVL-ICT, TVL-HE, TVL-IA, TVL-AFA
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { strands } from "../src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// ─── Track Data ───────────────────────────────────────────────────────────────

interface TrackSeed {
  code: string;
  shortCode: string;
  name: string;
  description: string | null;
  trackCategory: "academic" | "tvl" | "specialized";
  displayOrder: number;
}

const STANDARD_TRACKS: TrackSeed[] = [
  // Academic tracks
  {
    code: "STEM",
    shortCode: "STEM",
    name: "Science, Technology, Engineering, and Mathematics",
    description: "Focus on scientific and mathematical disciplines for students pursuing careers in engineering, medicine, architecture, and related fields.",
    trackCategory: "academic",
    displayOrder: 1,
  },
  {
    code: "ABM",
    shortCode: "ABM",
    name: "Accountancy, Business, and Management",
    description: "Prepares students for careers in business, finance, accounting, and entrepreneurship.",
    trackCategory: "academic",
    displayOrder: 2,
  },
  {
    code: "HUMSS",
    shortCode: "HUMSS",
    name: "Humanities and Social Sciences",
    description: "Focus on humanities, social sciences, and communication for students pursuing careers in law, education, public service, and liberal arts.",
    trackCategory: "academic",
    displayOrder: 3,
  },
  {
    code: "GAS",
    shortCode: "GAS",
    name: "General Academic Strand",
    description: "A broad academic foundation for students who are still undecided or want a general education.",
    trackCategory: "academic",
    displayOrder: 4,
  },

  // TVL tracks
  {
    code: "TVL-ICT",
    shortCode: "ICT",
    name: "Information and Communications Technology",
    description: "Focus on computer systems, programming, and digital technology for IT careers.",
    trackCategory: "tvl",
    displayOrder: 10,
  },
  {
    code: "TVL-HE",
    shortCode: "HE",
    name: "Home Economics",
    description: "Skills in hospitality, tourism, food service, and caregiving industries.",
    trackCategory: "tvl",
    displayOrder: 11,
  },
  {
    code: "TVL-IA",
    shortCode: "IA",
    name: "Industrial Arts",
    description: "Technical skills in electrical, mechanical, and construction trades.",
    trackCategory: "tvl",
    displayOrder: 12,
  },
  {
    code: "TVL-AFA",
    shortCode: "AFA",
    name: "Agri-Fishery Arts",
    description: "Skills in agriculture, horticulture, and fishery for farming and agribusiness careers.",
    trackCategory: "tvl",
    displayOrder: 13,
  },
];

// ─── Seed Function ────────────────────────────────────────────────────────────

export async function seedTracks(db: PostgresJsDatabase): Promise<void> {
  console.log("🌱 Seeding SHS academic tracks...");

  for (const track of STANDARD_TRACKS) {
    // Check if track exists
    const existing = await db
      .select({ id: strands.id })
      .from(strands)
      .where(eq(strands.code, track.code))
      .limit(1);

    if (existing.length > 0) {
      // Update existing track with new fields
      await db
        .update(strands)
        .set({
          shortCode: track.shortCode,
          name: track.name,
          description: track.description,
          trackCategory: track.trackCategory,
          displayOrder: track.displayOrder,
          updatedAt: new Date(),
        })
        .where(eq(strands.code, track.code));
      console.log(`  ✏️  Updated track: ${track.code}`);
    } else {
      // Insert new track
      await db.insert(strands).values({
        code: track.code,
        shortCode: track.shortCode,
        name: track.name,
        description: track.description,
        trackCategory: track.trackCategory,
        displayOrder: track.displayOrder,
        isActive: true,
      });
      console.log(`  ✅ Created track: ${track.code}`);
    }
  }

  console.log("✅ Tracks seeding complete!");
}

// ─── Standalone Execution ─────────────────────────────────────────────────────

if (require.main === module) {
  expand(config({ path: ".env.local" }));
  expand(config());

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  seedTracks(db)
    .then(async () => {
      await client.end();
    })
    .catch(async (err) => {
      console.error("❌ Tracks seed failed:", err);
      await client.end();
      process.exit(1);
    });
}
