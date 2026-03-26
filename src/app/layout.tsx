import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from "@/app/client-pwa";

export const metadata: Metadata = {
  title: 'FileForge - Tool Dashboard',
  description: 'Forgia i tuoi file con potenza e precisione.',
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Suspense>
          {children}
        </Suspense>
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
