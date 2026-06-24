import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CallCallum — MSP Call Readiness Assessments',
  description: 'Assess whether candidates and junior technicians are ready for real MSP client calls.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-connexion-black text-slate-100 font-sans">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
