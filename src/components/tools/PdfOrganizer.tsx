"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Loader2, Download, ArrowLeft, Trash2, MoveLeft, MoveRight, Search } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { toast } from '@/hooks/use-toast';
import { PdfThumbnail } from '@/components/shared/PdfThumbnail';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function PdfOrganizer({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [pageIndices, setPageIndices] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      setFile(f);
      const arrayBuffer = await f.arrayBuffer();
      // Clone buffer to ensure we don't detach the primary data
      setFileData(arrayBuffer.slice(0));
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageIndices(Array.from({ length: pdf.getPageCount() }, (_, i) => i));
    }
  };

  const movePage = (from: number, to: number) => {
    if (to < 0 || to >= pageIndices.length) return;
    const newIndices = [...pageIndices];
    const [removed] = newIndices.splice(from, 1);
    newIndices.splice(to, 0, removed);
    setPageIndices(newIndices);
  };

  const deletePage = (index: number) => {
    setPageIndices(pageIndices.filter((_, i) => i !== index));
    toast({
      title: "Pagina rimossa",
      description: "La pagina non sarà inclusa nel nuovo file.",
    });
  };

  const handleSave = async () => {
    if (!file || !fileData) return;
    setProcessing(true);

    try {
      const sourcePdf = await PDFDocument.load(fileData.slice(0));
      const newPdf = await PDFDocument.create();
      
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach(page => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResultUrl(URL.createObjectURL(blob));
      toast({ title: "Salvato!", description: "PDF organizzato con successo." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Errore", description: "Impossibile organizzare il PDF." });
    } finally {
      setProcessing(false);
    }
  };

  const onDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    movePage(draggedIndex, index);
    setDraggedIndex(index);
  };

  const onDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[600px]">
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6" />
            <CardTitle>Organizza PDF</CardTitle>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        {!file ? (
          <FileUpload 
            onFileSelect={handleFileSelect} 
            accept="application/pdf" 
            label="Carica PDF da organizzare"
            description="Riordina le pagine trascinandole, elimina o visualizza in dettaglio."
          />
        ) : !resultUrl ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-dashed">
              <div className="text-left">
                <p className="font-bold text-primary truncate max-w-xs">{file.name}</p>
                <p className="text-sm text-muted-foreground">{pageIndices.length} pagine • Trascina per riordinare</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {setFile(null); setFileData(null);}}>
                Cambia file
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {pageIndices.map((originalIdx, currentIdx) => (
                <div 
                  key={`${originalIdx}-${currentIdx}`} 
                  draggable
                  onDragStart={() => onDragStart(currentIdx)}
                  onDragOver={(e) => onDragOver(e, currentIdx)}
                  onDragEnd={onDragEnd}
                  className={`relative group cursor-grab active:cursor-grabbing transition-all duration-200 ${draggedIndex === currentIdx ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}
                >
                  <Card className="overflow-hidden border-2 hover:border-primary transition-all shadow-sm">
                    <div className="relative aspect-[3/4] bg-white flex items-center justify-center">
                      {fileData && (
                        <PdfThumbnail 
                          file={fileData.slice(0)} 
                          pageNumber={originalIdx + 1} 
                          width={150} 
                          className="w-full h-full"
                        />
                      )}
                      
                      <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-20">
                        {currentIdx + 1}
                      </div>
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-30 backdrop-blur-[1px]">
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full shadow-lg">
                                <Search size={16} />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl p-6">
                               <DialogHeader>
                                 <DialogTitle>Anteprima Pagina {originalIdx + 1}</DialogTitle>
                               </DialogHeader>
                               <div className="flex items-center justify-center mt-4">
                                 {fileData && (
                                   <PdfThumbnail 
                                     file={fileData.slice(0)} 
                                     pageNumber={originalIdx + 1} 
                                     width={500} 
                                     className="rounded-lg shadow-2xl"
                                   />
                                 )}
                               </div>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-9 w-9 rounded-full shadow-lg" 
                            onClick={(e) => { e.stopPropagation(); deletePage(currentIdx); }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                        <div className="flex gap-1 mt-1">
                           <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full" disabled={currentIdx === 0} onClick={() => movePage(currentIdx, currentIdx - 1)}>
                             <MoveLeft size={12} />
                           </Button>
                           <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full" disabled={currentIdx === pageIndices.length - 1} onClick={() => movePage(currentIdx, currentIdx + 1)}>
                             <MoveRight size={12} />
                           </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t flex gap-4 z-40">
              <Button onClick={handleSave} disabled={processing || pageIndices.length === 0} className="w-full h-14 font-bold text-lg shadow-lg rounded-2xl">
                {processing ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Layers className="mr-2 h-5 w-5" />}
                Genera Nuovo PDF Organizzato
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-20 animate-in fade-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 shadow-inner">
              <Download size={48} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-black text-primary">Pronto al Download!</h3>
              <p className="text-muted-foreground">Le pagine sono state riorganizzate perfettamente.</p>
            </div>
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" onClick={() => { setFile(null); setResultUrl(null); }} className="h-12 flex-1 rounded-xl">
                Organizza Altro
              </Button>
              <Button asChild className="h-12 flex-1 rounded-xl bg-primary font-bold shadow-lg">
                <a href={resultUrl} download="organized.pdf">
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