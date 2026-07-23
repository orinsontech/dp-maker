import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Maha Kumbh DP Maker',
  description: 'Create your Maha Kumbh GT Mumbai profile frame.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="bg-[#060c22] border-t border-amber-400/10 py-4 text-center">
          <p className="text-xs tracking-wide text-amber-200/70">
            Developed by{' '}
            <span className="font-semibold text-amber-300">Lakshit Sethiya</span>{' '}
            <span className="text-amber-200/50">(Social Seller Academy)</span>
          </p>
        </footer>
      </body>
    </html>
  );
}
