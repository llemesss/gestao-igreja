/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removendo export temporariamente para usar build padrão
  // output: 'export',
  output: 'standalone',
  // trailingSlash pode causar comportamento inesperado atrás de proxies
  trailingSlash: false,
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