import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Connexion Training Hub',
  description: 'Internal MSP technician training platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-connexion-black text-slate-100">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
