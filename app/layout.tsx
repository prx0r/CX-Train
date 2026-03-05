import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

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
    <html lang="en" className={`${outfit.variable} bg-connexion-black text-slate-100 font-sans`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
