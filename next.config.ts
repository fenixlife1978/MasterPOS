import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export', // Genera la carpeta '/out' con archivos estáticos para que Electron los lea offline
  trailingSlash: true, // ✅ OBLIGATORIO: Asegura que cada ruta tenga su propio index.html para evitar errores 404 en Electron
  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // Obligatorio en Next.js al usar 'output: export'
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
