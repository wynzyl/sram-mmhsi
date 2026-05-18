/**
 * SRAMS Session Cleanup Script
 *
 * Manually removes expired sessions from the database.
 * Run: npx tsx scripts/cleanup-sessions.ts
 *
 * For production, use the cron endpoint instead:
 * - API: DELETE /api/cron/cleanup-sessions (with CRON_SECRET)
 * - Vercel Cron: Configure in vercel.json
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sessions } from "../src/lib/db/schema";
import { lt } from "drizzle-orm";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config({ path: ".env.local" }));
expand(config());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function cleanupSessions() {
  console.log("🧹 Starting session cleanup...\n");

  const now = new Date();

  // Count expired sessions first
  const expiredCount = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(lt(sessions.expiresAt, now));

  console.log(`Found ${expiredCount.length} expired sessions`);

  if (expiredCount.length === 0) {
    console.log("\n✅ No expired sessions to clean up");
    await client.end();
    return;
  }

  // Delete expired sessions
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });

  console.log(`\n✅ Deleted ${result.length} expired sessions`);
  console.log(`   Timestamp: ${now.toISOString()}`);

  await client.end();
}

cleanupSessions().catch((err) => {
  console.error("❌ Session cleanup failed:", err);
  process.exit(1);
});
