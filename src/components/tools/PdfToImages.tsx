
"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GalleryHorizontal, Loader2, Download, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { toast } from '@/hooks/use-toast';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface ExtractedImage {
  url: string;
  page: number;
}

export function PdfToImages({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [results, setResults] = useState<ExtractedImage[]>([]);

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setResults([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      
      const images: ExtractedImage[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Alta qualità
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        images.push({
          url: canvas.toDataURL('image/png'),
          page: i
        });
      }

      setResults(images);
      toast({ title: "Estrazione Completata!", description: `Abbiamo generato ${images.length} immagini.` });
      await pdf.destroy();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: "Impossibile estrarre immagini dal PDF." });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GalleryHorizontal className="w-6 h-6" />
            <CardTitle>PDF a Immagini</CardTitle>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {!file ? (
          <FileUpload 
            onFileSelect={(files) => setFile(files[0])} 
            accept="application/pdf" 
            label="Carica PDF da estrarre"
            description="Ogni pagina verrà convertita in un'immagine PNG."
          />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-6 animate-in fade-in">
            <div className="p-8 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center gap-3">
              <ImageIcon className="w-16 h-16 text-primary" />
              <div className="text-center">
                <p className="font-bold text-xl">{file.name}</p>
                <p className="text-muted-foreground">Pronto per l'estrazione delle pagine</p>
              </div>
            </div>
            
            <Button onClick={handleExtract} disabled={extracting} className="w-full h-16 text-xl font-bold shadow-lg rounded-2xl">
              {extracting ? (
                <>
                  <Loader2 className="animate-spin mr-3 h-6 w-6" />
                  Estrazione in corso...
                </>
              ) : (
                <>
                  <GalleryHorizontal className="mr-3 h-6 w-6" />
                  Estrai Pagine come Immagini
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {results.map((img, idx) => (
                <div key={idx} className="relative group rounded-xl border overflow-hidden shadow-sm bg-white dark:bg-card">
                  <img src={img.url} alt={`Pagina ${img.page}`} className="w-full aspect-[3/4] object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                    <Button size="sm" variant="secondary" className="w-full h-8 text-[10px]" asChild>
                      <a href={img.url} download={`pagina-${img.page}.png`}>
                        <Download className="mr-1 h-3 w-3" /> Scarica
                      </a>
                    </Button>
                  </div>
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 rounded-full">
                    PAG {img.page}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setFile(null); setResults([]); }}>
                Carica altro
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
