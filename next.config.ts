import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack reads tsconfig.json paths automatically.
  // This turbopack.resolveAlias adds explicit root-level resolution
  // for lib/, actions/, components/ which live outside src/.
  // Per: node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md
  turbopack: {
    resolveAlias: {
      "@/lib": "./lib",
      "@/actions": "./actions",
      "@/components": "./components",
      "@/hooks": "./hooks",
    },
  },
};

export default nextConfig;
