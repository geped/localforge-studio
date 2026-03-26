'use server';

export type RemoveImageBackgroundInput = {
  imageDataUri: string;
  apiKey?: string; // Chiave utente opzionale; se assente usa REMOVEBG_API_KEY da .env
};

export type RemoveImageBackgroundOutput = {
  processedImageDataUri: string;
};

export async function removeImageBackground(
  input: RemoveImageBackgroundInput
): Promise<RemoveImageBackgroundOutput> {
  const { imageDataUri, apiKey } = input;

  const resolvedKey = apiKey?.trim() || process.env.REMOVEBG_API_KEY;

  if (!resolvedKey || resolvedKey === 'YOUR_API_KEY_HERE') {
    throw new Error('Nessuna API Key configurata. Inserisci la tua chiave remove.bg nelle impostazioni.');
  }

  const parts = imageDataUri.split(',');
  const base64Data = parts[1]?.trim().replace(/\s/g, '');

  if (!base64Data) {
    throw new Error('Formato immagine non valido. Assicurati che sia un data URI valido con base64 encoding.');
  }

  const mimeType = parts[0].split(':')[1]?.split(';')[0] || 'image/png';

  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });

  const formData = new FormData();
  formData.append('image_file', blob, 'image.png');
  formData.append('size', 'auto');
  formData.append('format', 'png');

  let response: Response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': resolvedKey,
      },
      body: formData,
    });
  } catch (networkError) {
    const detail = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(`Impossibile raggiungere l'API remove.bg. Controlla la connessione di rete del server. Dettaglio: ${detail}`);
  }

  if (!response.ok) {
    let errorMessage = `Errore API remove.bg (HTTP ${response.status})`;
    try {
      const body = await response.text();
      const parsed = JSON.parse(body);
      if (parsed.errors?.[0]) {
        errorMessage = parsed.errors[0].detail || parsed.errors[0].title || errorMessage;
      }
    } catch {
      // body non JSON — errorMessage resta quello di default
    }
    throw new Error(errorMessage);
  }

  const arrayBuffer = await response.arrayBuffer();
  const resultBuffer = Buffer.from(arrayBuffer);
  const processedImageDataUri = `data:image/png;base64,${resultBuffer.toString('base64')}`;

  return { processedImageDataUri };
}
