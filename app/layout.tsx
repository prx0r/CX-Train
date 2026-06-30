import type { Metadata } from 'next';
import { Saira_Condensed } from 'next/font/google';
import './globals.css';

const sairaCondensed = Saira_Condensed({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-saira-condensed',
});

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
    <html lang="en" className={`${sairaCondensed.variable} bg-connexion-black text-slate-100 font-sans`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
