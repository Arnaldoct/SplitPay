import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16+ doesn't run ESLint during builds
  typescript: {
    // Keep TypeScript strict checking
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
# Force rebuild
