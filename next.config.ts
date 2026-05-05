import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Currently empty - add configuration as needed */
  allowedDevOrigins: ['http://localhost:3000'],
  turbo: undefined,
  experimental: {
    turbo: undefined,
  },
}

export default nextConfig;
