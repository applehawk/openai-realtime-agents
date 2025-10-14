import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  // Enable experimental features for better Docker support
  experimental: {
    // Improve memory usage in production
    optimizePackageImports: ['@radix-ui/react-icons'],
  },
};

export default nextConfig;
