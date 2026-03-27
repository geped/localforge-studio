# LocalForge Studio

> Suite desktop locale per Windows — strumenti PDF, immagini e trasferimento file LAN, tutto in un unico launcher.

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-free-orange)

---

## Contenuto

| Strumento | Descrizione |
|---|---|
| **FileForge Studio** | 20+ strumenti per PDF e immagini: converti, comprimi, unisci, firma, rimuovi sfondo, genera QR code, barcode e altro |
| **LocalSync Bridge** | Trasferimento file LAN via QR code con supporto multi-utente e stream in tempo reale |

---

## Download

**[→ Scarica LocalForge Studio v1.0.0](https://github.com/geped/localforge-studio/releases/tag/v1.0.0)**

`LocalForge-Studio-Setup-1.0.0.exe` · Windows 10/11 x64 · ~105 MB · Gratis

---

## ⚠️ Avviso Windows SmartScreen

Al primo avvio potresti vedere questo messaggio di Windows Defender SmartScreen:

> *"Microsoft Defender SmartScreen ha impedito l'avvio di un'app non riconosciuta."*

**Questo è normale.** Il messaggio appare perché l'app non ha ancora un certificato di firma digitale a pagamento (code signing). Il codice sorgente è interamente pubblico e verificabile in questo repository.

### Come procedere in sicurezza

1. Clicca su **"Ulteriori informazioni"** (link testuale sotto il messaggio)
2. Comparirà il pulsante **"Esegui comunque"** — clicca per procedere
3. L'installazione continua normalmente

> Se preferisci, puoi verificare l'integrità del file confrontando il checksum SHA-256 con quello pubblicato nella [pagina della release](https://github.com/geped/localforge-studio/releases/tag/v1.0.0).

---

## Stack

| Layer | Tecnologie |
|---|---|
| Desktop shell | Electron 41 |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Backend | Express, Socket.io, HTTPS self-signed |
| Build | `output: standalone` + electron-builder (NSIS) |

---

## Sviluppo locale

### Requisiti

- Node.js 18+
- Windows 10/11

### Avvio

```bash
# Installa le dipendenze
npm install

# Copia il template e inserisci le tue chiavi API (opzionale)
cp .env.example .env

# Avvia in modalità sviluppo
npm run electron:dev
```

### Build

```bash
npm run electron:build
# Output: dist/LocalForge Studio Setup 1.0.0.exe
```

---

## Variabili d'ambiente

Le funzioni AI sono opzionali. Senza chiavi l'app funziona completamente, salvo rimozione sfondo e generazione immagini AI.

```env
# .env (non committare mai questo file)
GEMINI_API_KEY=        # Generazione immagini AI
REMOVEBG_API_KEY=      # Rimozione sfondo (remove.bg)
```

---

## Struttura

```
electron/        # Main process, launcher, splash, welcome
server.js        # Express + Socket.io + HTTPS + LocalSync API
src/
  app/           # Next.js pages (App Router)
  components/
    tools/       # Tutti gli strumenti (PDF, immagini, sicurezza…)
    ui/          # shadcn/ui components
  ai/flows/      # Flussi AI (Genkit)
public/
  localforge/    # App mobile hub (portal QR)
  localsync/     # UI LocalSync (mobile)
docs/            # GitHub Pages — landing page
build-slim/      # Script prepare-standalone
```

---

© 2026 LocalForge Studio · Pedro Sanchez
