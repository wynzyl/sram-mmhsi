import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { existsSync } from "fs";

// Detect if running inside Docker (no .env.local file)
const isInsideDocker = !existsSync(".env.local");

// Load .env.local for host-side tools (drizzle-kit, seed scripts)
// This uses localhost:5432 to connect to the Docker-exposed port
if (!isInsideDocker) {
  expand(config({ path: ".env.local", override: true }));
}

// When running on host: replace @db: with @localhost: to use exposed port
// When running inside Docker: keep @db: as-is (Docker DNS resolves it)
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const databaseUrl = isInsideDocker
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL.replace("@db:", "@localhost:");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
