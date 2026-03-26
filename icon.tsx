import { ImageResponse } from 'next/og'

// Configurazione del segmento di route
export const runtime = 'edge'

// Metadati dell'immagine
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Generazione dell'immagine
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: '#2966A3', // FileForge Primary Blue
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '6px',
        }}
      >
        FF
      </div>
    ),
    { ...size }
  )
}