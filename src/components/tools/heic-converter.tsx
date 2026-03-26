"use client";

import React, { useState } from "react";
import { Upload, Image as ImageIcon, Download, Loader2, Settings2, ArrowLeft } from "lucide-react";
import { saveFile } from "@/utils/save-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HeicConverter({ onBack }: { onBack?: () => void }) {
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
      const heic2any = (await import("heic2any")).default;
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline tracking-tight">Convertitore HEIC</CardTitle>
                <CardDescription className="text-white/80 text-lg">Ottimizzato per convertire foto iPhone (HEIC) in JPG.</CardDescription>
              </div>
            </div>
            {onBack && (
              <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {!file ? (
            <label className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/5 hover:bg-muted/10 transition-colors">
              <div className="p-4 bg-blue-50 rounded-full mb-4 text-blue-600">
                <Upload className="h-8 w-8" />
              </div>
              <span className="text-lg font-medium mb-1">Carica file .HEIC o .HEIF</span>
              <span className="text-sm text-muted-foreground">Trascina qui o clicca per selezionare</span>
              <input type="file" accept=".heic,.heif" onChange={handleFileChange} className="hidden" />
            </label>
          ) : (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/30">
                <span className="truncate font-medium">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-sm text-red-500 hover:underline font-medium">Rimuovi</button>
              </div>

              <div className="space-y-4 p-4 rounded-xl bg-slate-50 border">
                <div className="flex items-center justify-between text-sm font-medium">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Settings2 size={16} />
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
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600"
                />
              </div>

              <button
                onClick={convertHeic}
                disabled={isConverting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-white font-bold text-lg shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {isConverting ? <Loader2 className="animate-spin" /> : "Converti in JPG"}
              </button>

              {convertedBlob && (
                <button onClick={handleDownload} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-100 bg-blue-50 py-4 text-blue-700 font-bold hover:bg-blue-100 transition-colors animate-in fade-in slide-in-from-bottom-2">
                  <Download size={20} /> Scarica Immagine
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}