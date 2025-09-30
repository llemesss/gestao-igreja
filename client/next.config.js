/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removendo export temporariamente para usar build padrão
  // output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: __dirname,
  // distDir: 'out',
}

module.exports = nextConfig