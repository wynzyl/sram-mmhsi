import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Ban timezone-unsafe date formatting. `toLocaleDateString`/`toLocaleTimeString`
    // with no fixed timeZone render different dates on server (UTC) vs client
    // (Asia/Manila), causing SSR hydration mismatches. Use formatDate/formatDateTime
    // from @/lib/utils/date instead. (`toLocaleString` is allowed — it is valid for numbers.)
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(toLocaleDateString|toLocaleTimeString)$/]",
          message:
            "Use formatDate/formatDateTime from @/lib/utils/date (pins Asia/Manila) — bare toLocale* date calls cause SSR hydration mismatches.",
        },
      ],
    },
  },
]);

export default eslintConfig;
