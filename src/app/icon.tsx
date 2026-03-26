import { ImageResponse } from 'next/og';

export const size        = { width: 32, height: 32 };
export const contentType = 'image/png';

// Genera il favicon di FileForge — icona Boxes su sfondo blu (colore primary)
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          borderRadius: '7px',
        }}
      >
        {/* Lucide "Boxes" icon — tre cubi impilati, SVG 22×22 su 32×32 */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* cubo in basso a sinistra */}
          <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
          <path d="M7 16.5l-4.74-2.85" />
          <path d="M7 16.5l5-3" />
          <path d="M7 16.5V21" />
          {/* cubo in basso a destra */}
          <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
          <path d="M17 16.5l-5-3" />
          <path d="M17 16.5l4.74-2.85" />
          <path d="M17 16.5V21" />
          {/* cubo in alto al centro */}
          <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
          <path d="M12 8l-5-3" />
          <path d="M12 8l5-3" />
          <path d="M12 8v5.5" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
