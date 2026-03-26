'use server';

export type GenerateImageInput = {
  prompt: string;
};

export type GenerateImageOutput = {
  imageDataUri: string;
};

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY non configurata nel file .env.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: input.prompt }],
        parameters: { sampleCount: 1 },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Errore API Imagen (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const prediction = data.predictions?.[0];

  if (!prediction?.bytesBase64Encoded) {
    throw new Error("Impossibile generare l'immagine.");
  }

  const mimeType = prediction.mimeType || 'image/png';
  const imageDataUri = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
  return { imageDataUri };
}
