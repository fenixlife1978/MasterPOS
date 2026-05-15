import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LicoPOS Gold — Sistema de Ventas Premium',
  description: 'Sistema de gestión de inventario y punto de venta para licorerías de alta gama.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-[#0C0B0A] text-[#F5F0E8] selection:bg-[#D4A017] selection:text-[#0C0B0A]">
        {children}
      </body>
    </html>
  );
}
