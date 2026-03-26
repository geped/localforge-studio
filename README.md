# FileForge Studio - Local Setup Guide

Questa guida ti aiuterà a configurare ed eseguire **FileForge Studio** sul tuo computer locale.

## Requisiti Preliminari

Assicurati di avere installato:
- [Node.js](https://nodejs.org/) (Versione 18.x o superiore)
- Un terminale (Prompt dei comandi, PowerShell, o Terminale su macOS/Linux)
- Un editor di testo (consigliato [VS Code](https://code.visualstudio.com/))

## Installazione

1. **Estrai il progetto**: Scarica il file ZIP dal Firebase Studio ed estrailo in una cartella sul tuo desktop.
2. **Apri il terminale**: Naviga all'interno della cartella estratta.
3. **Installa le dipendenze**: Esegui il comando seguente per installare tutti i pacchetti necessari:
   ```bash
   npm install
   ```

## Configurazione

Crea un file chiamato `.env` nella cartella principale del progetto e aggiungi la tua chiave API per la rimozione dello sfondo:

```env
REMOVEBG_API_KEY=tua_chiave_qui
```

## Esecuzione

### Avvio Rapido (Windows)

Utilizza il file `avvia_fileforge.bat` per un avvio automatizzato. Lo script include:
- **Gestione Processi**: Termina eventuali processi Node.js rimasti aperti.
- **Installazione Automatica**: Esegue `npm install` per garantire che le dipendenze siano aggiornate.
- **Configurazione**: Imposta la porta su **3001** e mostra l'IP locale per l'accesso da smartphone/tablet.
- **Avvio**: Apre automaticamente il browser all'indirizzo http://localhost:3001/fileforge.

### Avvio Manuale

Per avviare l'applicazione manualmente da terminale:

```bash
npm run dev
```

L'applicazione sarà disponibile all'indirizzo [http://localhost:3000](http://localhost:3000).

## Struttura del Progetto

- `src/app`: Logica delle pagine e routing (Next.js App Router).
- `src/components/tools`: Tutti gli strumenti di manipolazione (PDF, Immagini, AI).
- `src/ai/flows`: Logica dei flussi Genkit per le funzioni AI.
- `public`: Asset statici.

---
© 2024 FileForge Studio. Strumenti veloci, sicuri, pronti all'uso.
