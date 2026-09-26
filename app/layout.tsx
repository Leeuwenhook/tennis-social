import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tennis Social | London tennis sessions',
  description:
    'Find friendly, organised tennis sessions across London and book a place in a few steps.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
