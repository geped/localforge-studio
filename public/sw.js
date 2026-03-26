// FileForge Service Worker — minimal, network-only
// Necessario per l'installabilità PWA su Chrome/Edge.
// Non mette nulla in cache: tutte le richieste vanno sempre alla rete locale.

const CACHE_NAME = 'fileforge-v1';

self.addEventListener('install', () => {
  // Attiva subito senza aspettare la chiusura delle schede precedenti
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Prende il controllo di tutte le schede aperte immediatamente
  event.waitUntil(clients.claim());
});

// Network-only: ogni richiesta va direttamente alla rete
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
