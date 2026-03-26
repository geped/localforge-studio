
"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, Loader2, Download, ArrowLeft, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { toast } from '@/hooks/use-toast';

interface UploadedImage {
  file: File;
  id: string;
  preview: string;
}

export function ImagesToPdf({ onBack }: { onBack: () => void }) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleFileSelect = (files: File[]) => {
    const newImages = files.map(f => ({
      file: f,
      id: Math.random().toString(36).substr(2, 9),
      preview: URL.createObjectURL(f)
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newImages = [...images];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setImages(newImages);
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    setProcessing(true);

    try {
      const pdfDoc = await PDFDocument.create();
      
      for (const item of images) {
        const arrayBuffer = await item.file.arrayBuffer();
        let image;
        
        if (item.file.type === 'image/jpeg' || item.file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else if (item.file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          // Per altri formati, potremmo convertirli o saltarli. Per ora saltiamo.
          continue;
        }

        const { width, height } = image.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResultUrl(URL.createObjectURL(blob));
      toast({ title: "PDF Generato!", description: "Le tue immagini sono state convertite con successo." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: "Impossibile generare il PDF. Assicurati che le immagini siano JPG o PNG." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImagePlus className="w-6 h-6" />
            <CardTitle>Immagini a PDF</CardTitle>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {!resultUrl ? (
          <>
            <FileUpload 
              onFileSelect={handleFileSelect} 
              accept="image/png, image/jpeg" 
              multiple
              label="Carica Foto (JPG/PNG)"
              description="Ogni immagine diventerà una pagina del PDF."
            />
            
            {images.length > 0 && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  {images.map((item, i) => (
                    <Card key={item.id} className="p-3 bg-white dark:bg-card border flex items-center gap-4 group">
                      <div className="w-16 h-16 rounded overflow-hidden border shrink-0">
                        <img src={item.preview} className="w-full h-full object-cover" alt="preview" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveImage(i, 'up')}>
                            <ChevronUp size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === images.length - 1} onClick={() => moveImage(i, 'down')}>
                            <ChevronDown size={16} />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10" onClick={() => removeImage(item.id)}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                
                <Button 
                  onClick={handleGeneratePdf} 
                  disabled={processing || images.length === 0}
                  className="w-full h-14 text-lg font-bold shadow-lg"
                >
                  {processing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <ImagePlus className="mr-2 h-6 w-6" />}
                  Genera PDF da {images.length} foto
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 py-20 animate-in fade-in">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <ImagePlus size={48} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-black text-primary">PDF Creato!</h3>
              <p className="text-muted-foreground">Il tuo documento è pronto per il download.</p>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setResultUrl(null); setImages([]); }}>
                Crea Nuovo
              </Button>
              <Button asChild className="flex-1 h-12 rounded-xl bg-primary font-bold">
                <a href={resultUrl} download="fileforge-images.pdf">
                  <Download className="mr-2 h-4 w-4" /> Scarica PDF
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
