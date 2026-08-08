import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the `@/*` -> `src/*` path mapping from tsconfig.json so tests can
      // import modules the same way application code does.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `import "server-only"` throws outside a react-server condition, which
      // would make every server-side module untestable. The package ships an
      // empty build for exactly this case — resolve to it under Vitest.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    env: {
      // src/lib/db throws at import time without this, which makes any module
      // that transitively imports `db` untestable — even for its pure helpers.
      // postgres-js builds its pool lazily, so no connection is opened unless a
      // test actually runs a query.
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://vitest:vitest@127.0.0.1:5432/vitest",
    },
  },
});
