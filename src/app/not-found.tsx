"use client";

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background">
      <h1 className="text-6xl font-black text-primary mb-4">404</h1>
      <h2 className="text-2xl font-bold text-black mb-2">Página no encontrada</h2>
      <p className="text-black/60 mb-6">Lo sentimos, la página que buscas no existe.</p>
      <Link href="/" className="bg-primary text-black font-bold px-6 py-2 rounded-lg">
        Volver al inicio
      </Link>
    </div>
  );
}