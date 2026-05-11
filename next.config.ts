import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'http://localhost:3000',
    ...(process.env.APP_BASE_URL
      ? process.env.APP_BASE_URL.split(',').map((v) => v.trim()).filter(Boolean)
      : []),
  ],

  // Next.js 16 uses Turbopack by default - configure file watching
  turbopack: { 
    // Reduce filesystem watching overhead by ignoring unnecessary directories
    // This improves development server performance and HMR responsiveness
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
