import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db.execute<{ schemaname: string; last_value: string | null }>(
      sql`SELECT schemaname, last_value FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'bfx_reference_seq'`
    );

    if (result.length === 0) {
      console.error("✗ Sequence public.bfx_reference_seq not found in pg_sequences");
      process.exit(1);
    }

    const row = result[0];
    console.log(`✓ Sequence ${row.schemaname}.bfx_reference_seq exists. last_value:`, row.last_value);


    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("✗ Error:", message);
    process.exit(1);
  }
}

main();
