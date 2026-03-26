import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FileForge Studio',
    short_name: 'FileForge',
    description: 'Forgia i tuoi file con potenza e precisione.',
    start_url: '/fileforge/',
    scope: '/fileforge/',

    // "standalone" = apre come finestra app separata, senza barra URL
    display: 'standalone',

    background_color: '#dde8f0',
    theme_color: '#2563eb',

    orientation: 'any',

    icons: [
      {
        src: '/fileforge/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/fileforge/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      // Fallback PNG generato da Next.js
      {
        src: '/fileforge/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/fileforge/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],

    categories: ['utilities', 'productivity'],
  };
}
