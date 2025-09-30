/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  experimental: {
    turbo: {
      root: process.cwd()
    }
  }
}

module.exports = nextConfig