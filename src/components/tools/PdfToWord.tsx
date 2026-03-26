"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, Loader2, Download, ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { toast } from '@/hooks/use-toast';
import { PdfThumbnail } from '@/components/shared/PdfThumbnail';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export function PdfToWord({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'converting' | 'done'>('idle');

  const handleConvertToWord = async () => {
    if (!file) return;
    setConverting(true);
    setStatus('converting');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      
      let fullText = "";
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += `<p>${pageText}</p><br/>`;
      }

      // Create an HTML-based Word document (.doc) which is widely supported and editable
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'></head>
        <body style="font-family: 'Times New Roman', serif; white-space: pre-wrap; padding: 1in;">
          ${fullText}
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      setResultUrl(URL.createObjectURL(blob));
      setStatus('done');
      toast({ title: "Conversione Completata!", description: "Il file Word è pronto per l'editing." });
      
      await pdf.destroy();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: "Impossibile estrarre il testo dal PDF." });
      setStatus('idle');
    } finally {
      setConverting(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6" />
            <CardTitle>Convertitore PDF a Word</CardTitle>
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
            label="Carica PDF da convertire"
            description="Converti il PDF in un file Word editabile (.doc)"
          />
        ) : status !== 'done' ? (
          <div className="max-w-xl mx-auto space-y-8 animate-in fade-in">
            <div className="flex flex-col items-center gap-6 p-8 bg-muted/30 rounded-3xl border-2 border-dashed">
              <PdfThumbnail file={file} width={200} className="shadow-2xl rounded-xl" />
              <div className="text-center">
                <h3 className="font-bold text-2xl text-primary">{file.name}</h3>
                <p className="text-muted-foreground">Estrai testi e mantieni l'editabilità</p>
              </div>
            </div>

            <Button onClick={handleConvertToWord} disabled={converting} className="w-full h-16 text-xl font-bold bg-accent hover:bg-accent/90 shadow-lg rounded-2xl">
              {converting ? (
                <>
                  <Loader2 className="animate-spin mr-3 h-6 w-6" />
                  Estrazione testo in corso...
                </>
              ) : (
                <>
                  <FileText className="mr-3 h-6 w-6" />
                  Converti in Word Editabile
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 py-10 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
              <CheckCircle size={48} />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-4xl font-black text-primary tracking-tighter">Conversione Riuscita!</h3>
              <p className="text-muted-foreground">Il documento Word è pronto. Puoi scaricarlo e aprirlo con Word o Google Docs.</p>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => { setFile(null); setResultUrl(null); setStatus('idle'); }}>
                Converti un altro file
              </Button>
              <Button asChild className="h-12 flex-1 rounded-xl bg-primary font-bold shadow-lg">
                <a href={resultUrl} download={`${file.name.split('.')[0]}.doc`}>
                  <Download className="mr-2 h-4 w-4" /> Scarica Word (.doc)
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
