import type {Metadata} from 'next';
import './globals.css';
import { AuthWrapper } from '@/context/AuthWrapper';

export const metadata: Metadata = {
  title: 'MasterPOS v1.0',
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
      <body className="font-body antialiased bg-background text-foreground">
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
