/**
 * Gestisce il salvataggio dei file in modo nativo su iOS/Android e Desktop.
 * Su mobile usa la Web Share API per permettere "Salva su Foto" o "Salva su File".
 */
export const saveFile = async (blob: Blob, filename: string) => {
  try {
    const file = new File([blob], filename, { type: blob.type });

    // Verifica se il browser supporta la condivisione di file (tipico di iOS/Android)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return; // Successo (o menu aperto)
      } catch (error: any) {
        // Se l'utente annulla, non facciamo nulla. Altrimenti procediamo col fallback.
        if (error.name === 'AbortError') return;
        console.warn('Web Share API fallita, procedo con download classico:', error);
      }
    }

    // Fallback: Download classico (Desktop o se la condivisione fallisce)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Errore critico nel salvataggio:', error);
    alert('Impossibile salvare il file. Riprova.');
  }
};