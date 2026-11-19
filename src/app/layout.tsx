import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';
import '../styles/tokens.css';
import '../styles/house.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Wraith — repository risk, made visible',
  description: 'Make hidden maintenance risk visible in your GitHub repository.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
