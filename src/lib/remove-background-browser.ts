// Engine client-side per la rimozione dello sfondo.
// Non contiene riferimenti a moduli server. Importare solo in contesti 'use client'.

export type BgRemovalProgressCallback = (stage: string, value: number) => void;

function resolveStageLabel(key: string): string {
  if (key.includes('fetch')) return 'Scaricamento modello AI...';
  if (key.includes('load'))  return 'Caricamento modello...';
  if (key.includes('inference')) return 'Elaborazione immagine...';
  return 'Elaborazione...';
}

export async function removeBackgroundInBrowser(
  imageDataUri: string,
  onProgress?: BgRemovalProgressCallback
): Promise<string> {
  // Import dinamico: si carica solo in browser, mai lato server.
  const { removeBackground } = await import('@imgly/background-removal');

  // Converti il data URI in Blob per passarlo alla libreria.
  const fetchRes = await fetch(imageDataUri);
  const inputBlob = await fetchRes.blob();

  const resultBlob: Blob = await removeBackground(inputBlob, {
    progress: (key: string, current: number, total: number) => {
      if (!onProgress) return;
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      onProgress(resolveStageLabel(key), pct);
    },
    output: {
      format: 'image/png' as const,
      quality: 1,
    },
  });

  // Ritorna il risultato come data URI.
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
