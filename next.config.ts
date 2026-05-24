import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Ignore ESLint errors during builds (we'll fix them later)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep TypeScript strict checking
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
