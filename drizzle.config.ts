import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// Load .env.local first (Next.js convention), then fall back to .env
expand(config({ path: ".env.local" }));
expand(config({ path: ".env" }));

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
