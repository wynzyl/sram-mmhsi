import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db.execute<{ last_value: string | null }>(
      sql`SELECT last_value FROM pg_sequences WHERE sequencename = 'bfx_reference_seq'`
    );

    if (result.length === 0) {
      console.error("✗ Sequence bfx_reference_seq not found in pg_sequences");
      process.exit(1);
    }

    console.log("✓ Sequence bfx_reference_seq exists. last_value:", result[0].last_value);


    process.exit(0);
  } catch (error: any) {
    console.error("✗ Error:", error.message);
    process.exit(1);
  }
}

main();
