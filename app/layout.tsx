import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cutline Studio — editor de video local',
  description: 'Recorta, une y adapta tus videos en el navegador.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
