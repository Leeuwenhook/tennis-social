import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tennis Social | London tennis sessions',
  description:
    'Find friendly, organised tennis sessions across London and book a place in a few steps.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: ['/favicon.svg'],
    apple: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
