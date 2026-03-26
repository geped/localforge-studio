"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, FileText, AlertCircle, Image as ImageIcon } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility per unire le classi (se non hai già un file utils)
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FilePreviewProps {
  file: File | null;
  className?: string;
}

export function FilePreview({ file, className }: FilePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Formatta la dimensione del file
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const generatePreview = async () => {
      setLoading(true);
      setError(null);

      try {
        // Gestione Immagini
        if (file.type.startsWith("image/")) {
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
          setLoading(false);
          return () => URL.revokeObjectURL(url);
        }

        // Gestione PDF
        if (file.type === "application/pdf") {
          // Importazione dinamica per evitare errori SSR con Next.js
          const pdfjsLib = await import("pdfjs-dist");
          
          // Configura il worker da CDN per stabilità
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          const page = await pdf.getPage(1);

          const canvas = canvasRef.current;
          if (!canvas) return;

          const viewport = page.getViewport({ scale: 1.5 }); // Scale 1.5 per retina/mobile nitido
          const context = canvas.getContext("2d");

          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;
          }
          setLoading(false);
        } else {
          // Altri tipi di file
          setLoading(false);
        }
      } catch (err) {
        console.error("Errore anteprima:", err);
        setError("Impossibile generare l'anteprima");
        setLoading(false);
      }
    };

    generatePreview();

    // Cleanup
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [file]);

  if (!file) return null;

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm", className)}>
      
      {/* Header Info File (Overlay) */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3 text-white">
        <div className="flex items-center gap-2 overflow-hidden">
          {file.type === "application/pdf" ? <FileText size={16} /> : <ImageIcon size={16} />}
          <span className="truncate text-xs font-medium">{file.name}</span>
        </div>
        <span className="shrink-0 text-[10px] opacity-80">{formatSize(file.size)}</span>
      </div>

      {/* Area Contenuto */}
      <div className="flex min-h-[250px] items-center justify-center bg-background/50 p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs">Caricamento anteprima...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <span className="text-xs">{error}</span>
          </div>
        ) : file.type.startsWith("image/") && previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[400px] w-full object-contain shadow-md rounded-md"
          />
        ) : file.type === "application/pdf" ? (
          <canvas
            ref={canvasRef}
            className="max-h-[400px] w-auto max-w-full rounded-md shadow-md"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="rounded-full bg-muted p-4">
              <FileText className="h-10 w-10" />
            </div>
            <p className="text-sm">Anteprima non disponibile</p>
          </div>
        )}
      </div>
    </div>
  );
}