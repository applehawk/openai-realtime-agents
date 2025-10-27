/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons'],
  },
}

module.exports = nextConfig
