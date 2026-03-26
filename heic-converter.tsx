"use client";

import React, { useState } from "react";
import heic2any from "heic2any";
import { Upload, Image as ImageIcon, Download, Loader2, Settings2 } from "lucide-react";
import { saveFile } from "@/utils/save-file";

export function HeicConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [quality, setQuality] = useState(0.8);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setConvertedBlob(null);
    }
  };

  const convertHeic = async () => {
    if (!file) return;
    setIsConverting(true);
    try {
      const result = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: quality,
      });

      // heic2any può ritornare un array se ci sono più immagini, prendiamo la prima o l'unica
      const blob = Array.isArray(result) ? result[0] : result;
      setConvertedBlob(blob);
    } catch (error) {
      console.error("Errore conversione:", error);
      alert("Errore durante la conversione del file HEIC.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = async () => {
    if (convertedBlob && file) {
      const newName = file.name.replace(/\.heic$/i, ".jpg");
      await saveFile(convertedBlob, newName);
    }
  };

  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
          <ImageIcon size={24} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Convertitore HEIC</h2>
          <p className="text-sm text-muted-foreground">Ottimizzato per foto iPhone</p>
        </div>
      </div>

      {!file ? (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/5 hover:bg-muted/10">
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">Carica .HEIC o .HEIF</span>
          <input type="file" accept=".heic,.heif" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <button onClick={() => setFile(null)} className="text-xs text-red-500 hover:underline">Rimuovi</button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Settings2 size={14} />
                <span>Qualità JPG: {Math.round(quality * 100)}%</span>
              </div>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
          </div>

          <button
            onClick={convertHeic}
            disabled={isConverting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isConverting ? <Loader2 className="animate-spin" /> : "Converti ora"}
          </button>

          {convertedBlob && (
            <button onClick={handleDownload} className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background py-2.5 hover:bg-accent hover:text-accent-foreground">
              <Download size={18} /> Scarica JPG
            </button>
          )}
        </div>
      )}
    </div>
  );
}