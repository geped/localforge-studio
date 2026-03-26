"use client";

import React, { useState, useEffect } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scissors, Loader2, Download, ArrowLeft, CheckSquare, Square, Search } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PdfThumbnail } from '@/components/shared/PdfThumbnail';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function PdfSplitter({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [results, setResults] = useState<{ name: string; url: string }[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [rangeInput, setRangeInput] = useState("");

  const handleFileSelect = async (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      setFile(f);
      const arrayBuffer = await f.arrayBuffer();
      setFileData(arrayBuffer.slice(0));
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
      setSelectedPages([]);
      setRangeInput("");
      setResults([]);
    }
  };

  const togglePageSelection = (idx: number) => {
    setSelectedPages(prev => 
      prev.includes(idx) ? prev.filter(p => p !== idx) : [...prev, idx]
    );
  };

  useEffect(() => {
    if (selectedPages.length > 0) {
      const sorted = [...selectedPages].sort((a, b) => a - b);
      setRangeInput(sorted.map(p => p + 1).join(', '));
    }
  }, [selectedPages]);

  const handleSplit = async () => {
    if (!file || !fileData) return;
    setSplitting(true);

    try {
      const pdf = await PDFDocument.load(fileData.slice(0));
      let pagesToExtract: number[] = [];

      if (selectedPages.length > 0) {
        pagesToExtract = [...selectedPages].sort((a, b) => a - b);
      } else if (rangeInput) {
        if (rangeInput.includes("-")) {
          const parts = rangeInput.split("-");
          const start = parseInt(parts[0].trim()) - 1;
          const end = parseInt(parts[1].trim()) - 1;
          for (let i = start; i <= end && i < pageCount; i++) {
            if (i >= 0) pagesToExtract.push(i);
          }
        } else {
          rangeInput.split(",").forEach(p => {
            const n = parseInt(p.trim()) - 1;
            if (n >= 0 && n < pageCount) pagesToExtract.push(n);
          });
        }
      }

      if (pagesToExtract.length === 0) throw new Error("Seleziona almeno una pagina o inserisci un intervallo.");

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(pdf, pagesToExtract);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setResults([{ name: `estratto-${file.name}`, url }]);
      toast({ title: "Completato!", description: "Pagine estratte con successo." });
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: error.message });
    } finally {
      setSplitting(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[600px]">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scissors className="w-6 h-6" />
            <CardTitle>Dividi PDF</CardTitle>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {!file ? (
          <FileUpload 
            onFileSelect={handleFileSelect} 
            accept="application/pdf" 
            label="Carica PDF da dividere"
            description="Clicca sulle pagine per selezionarle visivamente o usa gli intervalli."
          />
        ) : results.length === 0 ? (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
              <div className="text-center sm:text-left">
                <p className="font-bold text-primary truncate max-w-xs">{file.name}</p>
                <p className="text-sm text-muted-foreground">{pageCount} pagine totali • {selectedPages.length} selezionate</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedPages(Array.from({length: pageCount}, (_, i) => i))}>
                  Seleziona Tutto
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedPages([])}>
                  Deseleziona
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {Array.from({ length: pageCount }).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "relative cursor-pointer group rounded-xl border-2 transition-all p-1 bg-white",
                    selectedPages.includes(i) ? "border-primary shadow-lg" : "border-transparent hover:border-primary/30"
                  )}
                  onClick={() => togglePageSelection(i)}
                >
                  {fileData && (
                    <PdfThumbnail file={fileData.slice(0)} pageNumber={i + 1} width={150} className="w-full h-full rounded-lg" />
                  )}
                  
                  <div className={cn(
                    "absolute top-2 right-2 p-1 rounded-full shadow-sm z-20",
                    selectedPages.includes(i) ? "bg-primary text-white" : "bg-white text-muted-foreground border"
                  )}>
                    {selectedPages.includes(i) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </div>

                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30 pointer-events-none sm:pointer-events-auto">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-8 w-8 rounded-full pointer-events-auto shadow-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Search size={14} />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl p-6">
                         <DialogHeader>
                           <DialogTitle>Anteprima Pagina {i + 1}</DialogTitle>
                         </DialogHeader>
                         <div className="flex items-center justify-center mt-4">
                           {fileData && (
                             <PdfThumbnail 
                               file={fileData.slice(0)} 
                               pageNumber={i + 1} 
                               width={500} 
                               className="rounded-lg shadow-2xl"
                             />
                           )}
                         </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    PAG {i + 1}
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white/90 backdrop-blur-md p-4 border-t flex flex-col sm:flex-row gap-4 z-40">
              <div className="flex-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Intervallo manuale</Label>
                <Input 
                  value={rangeInput} 
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="es. 1-3 o 1, 4, 6"
                  className="h-10 rounded-xl"
                />
              </div>
              <Button onClick={handleSplit} disabled={splitting || (selectedPages.length === 0 && !rangeInput)} className="h-14 sm:w-64 font-bold text-lg shadow-lg rounded-2xl">
                {splitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Scissors className="mr-2 h-5 w-5" />}
                Estrai Pagine Scelte
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-20 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
              <CheckSquare size={48} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-black text-primary">Estrazione Riuscita!</h3>
              <p className="text-muted-foreground">Le pagine selezionate sono state salvate nel nuovo file.</p>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" onClick={() => { setFile(null); setResults([]); }} className="h-12 flex-1 rounded-xl">
                Dividi Altro
              </Button>
              {results.map((res, i) => (
                <Button key={i} asChild className="h-12 flex-1 rounded-xl bg-primary font-bold shadow-lg">
                  <a href={res.url} download={res.name}>
                    <Download className="mr-2 h-4 w-4" /> Scarica Risultato
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}