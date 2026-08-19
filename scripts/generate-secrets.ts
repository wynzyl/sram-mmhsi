/**
 * Security Secret Generation Script
 *
 * Generates cryptographically secure secrets for SRAMS production deployment.
 * Run: npx tsx scripts/generate-secrets.ts
 *
 * Output: Environment variable values to add to .env.production
 */

import { randomBytes } from "crypto";

function generateSecret(bytes: number = 32): string {
  return randomBytes(bytes).toString("base64");
}

function generateHexSecret(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

console.log("🔐 SRAMS Security Secret Generator\n");
console.log("Add these to your .env.production file:\n");
console.log("─".repeat(60));

// CRON_SECRET - For protecting cron endpoints
console.log(`\n# Cron endpoint protection (required for cleanup jobs)`);
console.log(`CRON_SECRET="${generateHexSecret(32)}"`);

// AUTH_SECRET - JWT signing key (if regenerating)
console.log(`\n# JWT signing key (only regenerate if needed - invalidates all sessions)`);
console.log(`# AUTH_SECRET="${generateSecret(32)}"`);

// Session cookie settings
console.log(`\n# Session cookie security (enable when HTTPS is active)`);
console.log(`SESSION_COOKIE_SECURE="true"`);

// Trusted proxy count for Cloudflare + NPM
console.log(`\n# Proxy chain: Cloudflare (1) + NPM (1) = 2`);
console.log(`TRUSTED_PROXY_COUNT="2"`);

console.log("\n" + "─".repeat(60));
console.log("\n✅ Copy the values above to your production environment.\n");
console.log("⚠️  Keep these secrets secure - never commit to version control.\n");
