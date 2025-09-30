import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Desabilitado devido às páginas dinâmicas - usar SSR no Netlify
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  turbopack: {
    root: 'C:\\Users\\lucas\\Documents\\System v3\\client',
  },
  eslint: {
    // Ignorar warnings do ESLint durante o build
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Para desenvolvimento local
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    }
    // Para produção, não usar rewrites (usar NEXT_PUBLIC_API_URL)
    return [];
  },
};

export default nextConfig;
