import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
// Only enable HTTPS upgrade when the primary allowed origin uses HTTPS.
const primaryAppBaseUrl = process.env.APP_BASE_URL?.split(",")[0]?.trim();
const isHttps = primaryAppBaseUrl?.toLowerCase().startsWith("https://") ?? false;

/**
 * Content-Security-Policy (defense-in-depth).
 *
 * Note: a per-request nonce policy is intentionally NOT used — it conflicts with this
 * app's `cacheComponents` (prerendered output can't carry a fresh per-request nonce).
 * We therefore use a static policy: `'unsafe-inline'` is required for Next.js/React inline
 * bootstrap + styles, and `'unsafe-eval'` is only added in development (webpack/turbopack
 * HMR needs it). Everything else is locked to `'self'`, with framing/object/base/form
 * vectors closed off. Combined with React's auto-escaping (no `dangerouslySetInnerHTML`
 * exists in the codebase) this is a meaningful XSS-mitigation layer.
 */
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  // Only upgrade insecure requests when behind HTTPS to avoid breaking HTTP-only environments
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  // Empty turbopack config to silence Next.js 16 webpack migration warning
  turbopack: {},
  // Standalone output for optimized Docker deployments
  // Creates .next/standalone with minimal server + traced dependencies only
  output: 'standalone',

  cacheComponents: true,
  // Exclude @react-pdf/renderer from bundling (has native dependencies)
  serverExternalPackages: ["@react-pdf/renderer"],
  cacheLife: {
    // Custom profile for fee-templates (10-minute cache)
    "fee-templates": {
      stale: 300, // 5 minutes client cache
      revalidate: 600, // 10 minutes server revalidate
      expire: 3600, // 1 hour max
    },
  },
  allowedDevOrigins: [
    'http://localhost:3000',
    ...(process.env.APP_BASE_URL
      ? process.env.APP_BASE_URL.split(',').map((v) => v.trim()).filter(Boolean)
      : []),
  ],

  // Rewrite /uploads/* to /api/uploads/* for serving runtime-uploaded files
  // Next.js standalone mode does NOT serve runtime uploads from public/
  // This rewrite ensures all upload URLs work via the API route handler
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },

  // Security headers for production
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: cspDirectives },
          // HSTS — only emitted in production (HTTPS). Browsers ignore it over plain HTTP.
          ...(isProd
            ? [{
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
              }]
            : []),
        ],
      },
    ];
  },

  experimental: {
    // Enable filesystem caching for `next dev`
    // Temporarily disabled - Windows "nul" path bug
    // turbopackFileSystemCacheForDev: true,
    // Enable filesystem caching for `next build`
    // turbopackFileSystemCacheForBuild: true,
    // Allow larger file uploads (default is 1MB, our max is 2MB)
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },

  // Ensure native dependencies are included in standalone trace
  outputFileTracingIncludes: {
    '/*': [
      'node_modules/sharp/**/*',
      'node_modules/@react-pdf/renderer/**/*',
    ],
  },

  // Fallback webpack config for when using --webpack flag
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: undefined, // Use native file watching (faster than polling)
        aggregateTimeout: 300, // Delay before rebuilding (ms)
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/drizzle/**',
          '**/coverage/**',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/scripts/**',
          '**/*.md',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
