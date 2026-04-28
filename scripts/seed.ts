/**
 * SRAMS Database Seed Script
 * Creates the initial admin user.
 * Run: npx tsx scripts/seed.ts
 *
 * Per Engineering spec §9 — session + user model.
 * Per Engineering spec §8.5 — passwords hashed with bcrypt.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "bcryptjs";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log("🌱 Seeding SRAMS database...");

  const ADMIN_USERNAME = "admin";
  const ADMIN_EMAIL = "admin@srams.local";
  const ADMIN_PASSWORD = "Admin@2026!"; // Change immediately after first login

  // Check if admin already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, ADMIN_USERNAME))
    .limit(1);

  if (existing.length > 0) {
    console.log("✅ Admin user already exists. Skipping seed.");
    await client.end();
    return;
  }

  const passwordHash = await hash(ADMIN_PASSWORD, 12);

  await db.insert(users).values({
    email: ADMIN_EMAIL,
    username: ADMIN_USERNAME,
    passwordHash,
    role: "admin",
    isActive: true,
    forcePasswordChange: true, // Force password change on first login
  });

  console.log("✅ Admin user created:");
  console.log(`   Username : ${ADMIN_USERNAME}`);
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Password : ${ADMIN_PASSWORD}`);
  console.log("\n⚠️  IMPORTANT: Change the admin password immediately after first login!\n");

  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
