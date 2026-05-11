/**
 * SRAMS Environment Validation
 * Validates required secrets at startup. Application fails fast if missing.
 * Per SRAMS Engineering spec §8.1
 */

const REQUIRED_VARS = ["DATABASE_URL", "AUTH_SECRET", "APP_BASE_URL"] as const;

export function validateEnv() {
  const missing: string[] = [];
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length > 0) {
    throw new Error(
      `[SRAMS] Missing required environment variables:\n  ${missing.join("\n  ")}\n\nCheck your .env.local file.`
    );
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  AUTH_SECRET: process.env.AUTH_SECRET!,
  APP_BASE_URL: process.env.APP_BASE_URL!,
  GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
  GMAIL_FROM_ADDRESS: process.env.GMAIL_FROM_ADDRESS,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  isDev: process.env.NODE_ENV !== "production",
} as const;
