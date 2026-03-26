
"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combine, Loader2, Download, ArrowLeft, Trash2, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { toast } from '@/hooks/use-toast';
import { PdfThumbnail } from '@/components/shared/PdfThumbnail';

interface MergingFile {
  file: File;
  id: string;
}

export function PdfMerger({ onBack }: { onBack: () => void }) {
  const [files, setFiles] = useState<MergingFile[]>([]);
  const [merging, setMerging] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleFileSelect = (newFiles: File[]) => {
    const wrapping = newFiles.map(f => ({ file: f, id: Math.random().toString(36).substr(2, 9) }));
    setFiles(prev => [...prev, ...wrapping]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...files];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= files.length) return;
    [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
    setFiles(newFiles);
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: "Attenzione", description: "Seleziona almeno 2 file per l'unione." });
      return;
    }
    setMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();
      
      for (const item of files) {
        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResultUrl(URL.createObjectURL(blob));
      toast({ title: "Completato!", description: "I file sono stati uniti correttamente." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: "Impossibile unire i PDF." });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Combine className="w-6 h-6" />
            <CardTitle>Unisci PDF</CardTitle>
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
              accept="application/pdf" 
              multiple
              label="Aggiungi file PDF"
              description="Trascina qui i documenti nell'ordine in cui desideri unirli."
            />
            
            {files.length > 0 && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  {files.map((item, i) => (
                    <Card key={item.id} className="p-3 bg-white/50 border hover:border-primary/50 transition-colors flex items-center gap-4 group">
                      <div className="hidden sm:block">
                        <PdfThumbnail file={item.file} width={60} className="rounded border shadow-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveFile(i, 'up')}>
                            <ChevronUp size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === files.length - 1} onClick={() => moveFile(i, 'down')}>
                            <ChevronDown size={16} />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10" onClick={() => removeFile(item.id)}>
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
                
                <Button 
                  onClick={handleMerge} 
                  disabled={merging || files.length < 2}
                  className="w-full h-14 text-lg font-bold shadow-lg"
                >
                  {merging ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Combine className="mr-2 h-6 w-6" />}
                  Unisci {files.length} PDF
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 py-20 animate-in fade-in">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Combine size={48} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-black text-primary">Unione Completata!</h3>
              <p className="text-muted-foreground">I tuoi documenti sono stati combinati in un unico file.</p>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => { setResultUrl(null); setFiles([]); }}>
                Nuova Unione
              </Button>
              <Button asChild className="flex-1 h-12 rounded-xl bg-primary font-bold">
                <a href={resultUrl} download="fileforge-merged.pdf">
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
