import type { Metadata } from 'next';
import './globals.css';
import './taxonomies.css';
import './relations.css';
import './schema.css';

export const metadata: Metadata = {
  title: 'Waypoint — Agent-first content OS',
  description: 'Un sistema de contenidos estructurado para humanos y agentes de IA.',
  icons: {
    icon: '/favicon.svg',
  },
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
