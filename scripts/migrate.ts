import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => {
    console.log("migrations applied");
    return client.end();
  })
  .catch((err) => {
    console.error("migration failed:", err);
    process.exit(1);
  });
