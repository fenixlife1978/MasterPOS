import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Nota: 'output: export' es necesario para generar el .exe offline de Electron,
  // pero puede causar comportamientos inesperados en algunos entornos de desarrollo.
  output: 'export',
  
  // Desactivamos trailingSlash por defecto para mejorar la compatibilidad con el proxy de la Workstation.
  // Next.js manejará las rutas de forma estándar en desarrollo.
  trailingSlash: false, 
  
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
