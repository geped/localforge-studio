"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, FileWarning } from 'lucide-react';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfThumbnailProps {
  file: File | ArrayBuffer | Uint8Array;
  pageNumber?: number;
  className?: string;
  width?: number;
}

export function PdfThumbnail({ file, pageNumber = 1, className, width = 200 }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function renderPage() {
      setLoading(true);
      setError(false);
      try {
        let data: Uint8Array;
        
        if (file instanceof File) {
          const buffer = await file.arrayBuffer();
          data = new Uint8Array(buffer);
        } else if (file instanceof ArrayBuffer) {
          // Clone buffer to avoid detachment error
          data = new Uint8Array(file.slice(0));
        } else {
          data = new Uint8Array(file.buffer.slice(0));
        }

        const loadingTask = pdfjs.getDocument({ data });
        const pdf = await loadingTask.promise;
        
        if (pageNumber > pdf.numPages) {
          throw new Error('Page out of range');
        }

        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        };

        if (isMounted) {
          await page.render(renderContext).promise;
          setLoading(false);
        }
        
        // Cleanup pdf resources
        await pdf.destroy();
      } catch (err) {
        console.error('Error rendering PDF thumbnail:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    renderPage();

    return () => {
      isMounted = false;
    };
  }, [file, pageNumber, width]);

  return (
    <div className={`relative flex items-center justify-center bg-muted rounded-md overflow-hidden border shadow-inner ${className}`} style={{ width, minHeight: width * 1.41 }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <FileWarning className="w-8 h-8 text-destructive opacity-50" />
          <span className="text-[10px] text-muted-foreground">Anteprima non disponibile</span>
        </div>
      ) : (
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      )}
    </div>
  );
}
