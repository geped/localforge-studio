# LocalForge Studio

Suite desktop locale per Windows che unisce due strumenti in un unico launcher Electron:

- **FileForge Studio** — 20+ strumenti per PDF e immagini (converti, comprimi, unisci, firma, rimozione sfondo, QR code, barcode, e altro)
- **LocalSync Bridge** — trasferimento file LAN via QR code, con supporto multi-utente e stream in tempo reale

## Download

La release ufficiale è disponibile su GitHub:

**[→ Releases v1.0.0](https://github.com/geped/localforge-studio/releases/tag/v1.0.0)**

`LocalForge-Studio-Setup-1.0.0.exe` · Windows 10/11 x64 · ~105 MB

## Stack

| Layer | Tecnologie |
|---|---|
| Desktop shell | Electron 41 |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Backend | Express, Socket.io, HTTPS self-signed |
| Build | `output: standalone` + electron-builder (NSIS) |

## Sviluppo locale

```bash
# Installa dipendenze
npm install

# Crea il file .env (vedi .env.example)
cp .env.example .env

# Avvia in modalità dev (Electron + Next.js dev server)
npm run electron:dev
```

## Build

```bash
# Build standalone + pacchettizza .exe
npm run electron:build
```

L'installer viene generato in `dist/`.

## Variabili d'ambiente

Copia `.env.example` in `.env` e inserisci le tue chiavi:

```env
GEMINI_API_KEY=        # AI text-to-image
REMOVEBG_API_KEY=      # Rimozione sfondo (remove.bg)
```

Senza le chiavi l'app funziona normalmente — solo le funzioni AI risultano disabilitate.

## Struttura

```
electron/          # Main process, launcher, splash, welcome
src/
  app/             # Next.js pages (App Router)
  components/
    tools/         # Tutti gli strumenti (PDF, immagini, sicurezza…)
    shared/        # FileUpload, PdfThumbnail
    ui/            # shadcn/ui components
  ai/flows/        # Flussi Genkit (AI)
public/
  localforge/      # App mobile hub (portal QR)
  localsync/       # UI LocalSync (mobile)
docs/              # GitHub Pages (landing page)
build-slim/        # Script prepare-standalone
```

---

© 2026 LocalForge Studio · Pedro Sanchez
