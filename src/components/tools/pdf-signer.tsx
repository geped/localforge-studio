"use client";

import React, { useRef, useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from 'pdfjs-dist';
import { PenTool, Download, Eraser, Upload, FileText, ChevronLeft, ChevronRight, X, Check, Move, MousePointer2, ZoomIn, ZoomOut, Maximize, Minimize, FileUp, FileDown, RefreshCw, ArrowLeft } from "lucide-react";
import { saveFile } from "@/utils/save-file";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SignatureVault } from "./signature-vault";
import { Separator } from "@/components/ui/separator";
import { SignatureCanvas, SignatureCanvasRef } from "./helpers/signature-canvas";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export function PdfSigner({ onBack }: { onBack?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  
  // Signature State
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [sigPosition, setSigPosition] = useState({ x: 50, y: 50 });
  const [sigDimensions, setSigDimensions] = useState({ width: 150, height: 75 });
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Drawing Pad State
  const [penColor, setPenColor] = useState("#000000"); // Nero o Blu
  const [penWidth, setPenWidth] = useState(4);
  const signatureCanvasRef = useRef<SignatureCanvasRef>(null);
  const [exportFileName, setExportFileName] = useState("firma");

  // Preview Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gestione caricamento file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      
      // Load PDF for preview
      try {
        const buffer = await f.arrayBuffer();
        const loadingTask = pdfjs.getDocument(new Uint8Array(buffer));
        const pdf = await loadingTask.promise;
        setPdfProxy(pdf);
        setNumPages(pdf.numPages);
        setPageNum(1);
      } catch (err) {
        console.error("Error loading PDF preview:", err);
      }
    }
  };

  // Render PDF Page
  useEffect(() => {
    if (!pdfProxy || !previewCanvasRef.current) return;

    const renderPage = async () => {
      const page = await pdfProxy.getPage(pageNum);
      
      // Calculate scale to fit container width (max 600px usually)
      const containerWidth = containerRef.current?.clientWidth || 600;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / unscaledViewport.width, 1.5) * zoom; // Cap scale base but allow zoom
      
      const viewport = page.getViewport({ scale });
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context!,
        viewport: viewport
      }).promise;
    };

    renderPage();
  }, [pdfProxy, pageNum, zoom]);

  const clearSignature = () => {
    signatureCanvasRef.current?.clear();
  };

  const saveSignature = () => {
    const dataUrl = signatureCanvasRef.current?.toDataURL();
    if (dataUrl) {
      setSignatureImage(dataUrl);
      // Reset position to center of view
      setSigPosition({ x: 50, y: 50 });
    }
  };

  // Drag Logic
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default only for touch to stop scrolling
    if ('touches' in e) e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const container = containerRef.current;
    if (!container) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const containerRect = container.getBoundingClientRect();
    
    // Calculate pointer position relative to container content (including scroll)
    const pointerXInContainer = clientX - containerRect.left + container.scrollLeft;
    const pointerYInContainer = clientY - containerRect.top + container.scrollTop;

    setDragOffset({
      x: pointerXInContainer - sigPosition.x,
      y: pointerYInContainer - sigPosition.y
    });
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      // Prevent scrolling on mobile while dragging
      if (e.type === 'touchmove') {
        e.preventDefault();
      }
      
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      let clientX, clientY;
      if ('touches' in e) {
        clientX = (e as TouchEvent).touches[0].clientX;
        clientY = (e as TouchEvent).touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      // Account for scroll
      const x = clientX - containerRect.left + container.scrollLeft - dragOffset.x;
      const y = clientY - containerRect.top + container.scrollTop - dragOffset.y;

      // Boundaries check (use canvas size if available, else container)
      const canvas = previewCanvasRef.current;
      const maxX = (canvas?.width || containerRect.width) - sigDimensions.width;
      const maxY = (canvas?.height || containerRect.height) - sigDimensions.height;

      setSigPosition({
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY))
      });
    };

    const handleGlobalUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchmove', handleGlobalMove, { passive: false });
      window.addEventListener('touchend', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, dragOffset, sigDimensions]);

  // Export/Import Signature
  const handleExportSignature = () => {
    if (!signatureImage) return;
    
    const data = {
      type: "fileforge-signature",
      version: "1.0",
      createdAt: new Date().toISOString(),
      image: signatureImage
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    saveFile(blob, `${exportFileName || "firma"}-${Date.now()}.firma`);
    toast({ title: "Firma Esportata", description: "Salvata come file .firma in locale." });
  };

  const handleImportSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.type === "fileforge-signature" && parsed.image) {
          setSignatureImage(parsed.image);
          toast({ title: "Firma Caricata", description: "Firma importata correttamente." });
        } else {
          throw new Error("Formato non valido");
        }
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Errore Importazione", description: "Il file non è valido o è corrotto." });
      }
      // Reset input
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  // Applica la firma al PDF
  const applySignature = async () => {
    if (!file || !signatureImage || !previewCanvasRef.current) return;

    try {
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBuffer);
      
      const signatureImageEmbed = await pdfDoc.embedPng(signatureImage);
      const pages = pdfDoc.getPages();
      
      // Get the target page (0-based index)
      const targetPage = pages[pageNum - 1];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();

      // Calculate coordinates mapping
      // We need to map from Preview Canvas pixels -> PDF points
      const previewWidth = previewCanvasRef.current.width;
      const previewHeight = previewCanvasRef.current.height;
      
      const scaleX = pageWidth / previewWidth;
      const scaleY = pageHeight / previewHeight;

      // Calculate PDF coordinates
      // PDF coordinates start at bottom-left, Canvas at top-left
      const pdfX = sigPosition.x * scaleX;
      // For Y, we flip coordinate system
      const pdfY = pageHeight - ((sigPosition.y + sigDimensions.height) * scaleY);
      
      const pdfSigWidth = sigDimensions.width * scaleX;
      const pdfSigHeight = sigDimensions.height * scaleY;

      targetPage.drawImage(signatureImageEmbed, {
        x: pdfX,
        y: pdfY,
        width: pdfSigWidth,
        height: pdfSigHeight,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      await saveFile(blob, `signed_${file.name}`);
      
      // Reset
      setFile(null);
      setPdfProxy(null);
      setSignatureImage(null);
    } catch (err) {
      console.error("Errore firma:", err);
      alert("Impossibile firmare il PDF.");
    }
  };

  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <PenTool size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Firma PDF</h2>
            <p className="text-sm text-muted-foreground">Posiziona la tua firma dove vuoi</p>
          </div>
        </div>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        )}
      </div>

      {!file ? (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/5 hover:bg-muted/10">
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">Carica PDF da firmare</span>
          <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md bg-muted p-3">
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <span className="truncate text-sm font-medium max-w-[200px]">{file.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPdfProxy(null); setSignatureImage(null); }} className="h-6 text-xs text-red-500 hover:text-red-600">
              Cambia File
            </Button>
          </div>

          {/* Main Workspace */}
          <div className="flex flex-col gap-6">
            
            {/* PDF Preview & Positioning Area */}
            <div className="relative flex flex-col items-center gap-2 rounded-xl border bg-slate-100/50 p-4">
              <div className="flex w-full items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium whitespace-nowrap">Pag. {pageNum} / {numPages}</span>
                  <Button variant="outline" size="icon" disabled={pageNum >= numPages} onClick={() => setPageNum(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Zoom Out">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(3, z + 0.25))} title="Zoom In">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div 
                ref={containerRef} 
                className="relative overflow-auto border shadow-md bg-white max-h-[600px] w-full flex justify-center"
              >
                <canvas ref={previewCanvasRef} className="block" />
                
                {signatureImage && (
                  <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    style={{
                      position: 'absolute',
                      left: sigPosition.x,
                      top: sigPosition.y,
                      width: sigDimensions.width,
                      height: sigDimensions.height,
                      cursor: isDragging ? 'grabbing' : 'grab',
                      backgroundImage: `url(${signatureImage})`,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                    className="border-2 border-dashed border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-colors group"
                  >
                    {/* Drag Handle Button */}
                    <div 
                      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full shadow-md cursor-grab active:cursor-grabbing flex items-center gap-1 text-xs font-bold z-20 hover:scale-105 transition-transform"
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                    >
                      <Move size={14} /> Sposta
                    </div>

                    {/* Resize Controls */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1 bg-white shadow-md rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6" 
                         onClick={(e) => { e.stopPropagation(); setSigDimensions(d => ({ width: d.width * 0.9, height: d.height * 0.9 })); }}
                       >
                         <Minimize size={12} />
                       </Button>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6" 
                         onClick={(e) => { e.stopPropagation(); setSigDimensions(d => ({ width: d.width * 1.1, height: d.height * 1.1 })); }}
                       >
                         <Maximize size={12} />
                       </Button>
                    </div>

                    <button 
                      onClick={(e) => { e.stopPropagation(); setSignatureImage(null); }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              
              {!signatureImage && (
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <MousePointer2 size={14} />
                  <span>Disegna la tua firma qui sotto per iniziare</span>
                </div>
              )}
            </div>

            {/* Signature Pad (Visible only if no signature is set) */}
            {!signatureImage && (
              <>
              <div className="rounded-xl border bg-white p-4 shadow-inner animate-in slide-in-from-bottom-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Nuova Firma</span>
                  <div className="flex items-center gap-4">
                    {/* Stroke Width Control */}
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-slate-300" />
                      <input 
                        type="range" 
                        min="2" 
                        max="16" 
                        step="0.5"
                        value={penWidth}
                        onChange={(e) => setPenWidth(parseFloat(e.target.value))}
                        className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                        title="Spessore tratto"
                      />
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    </div>
                    
                    {/* Color Control */}
                    <div className="flex gap-1 border-l pl-4">
                      <button onClick={() => setPenColor("#000000")} className={`h-5 w-5 rounded-full bg-black ${penColor === "#000000" ? "ring-2 ring-primary ring-offset-1" : ""}`} />
                      <button onClick={() => setPenColor("#0000CC")} className={`h-5 w-5 rounded-full bg-blue-700 ${penColor === "#0000CC" ? "ring-2 ring-primary ring-offset-1" : ""}`} />
                      <button onClick={() => setPenColor("#CC0000")} className={`h-5 w-5 rounded-full bg-red-700 ${penColor === "#CC0000" ? "ring-2 ring-primary ring-offset-1" : ""}`} />
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <SignatureCanvas
                    ref={signatureCanvasRef}
                    width={600}
                    height={360}
                    penColor={penColor}
                    penWidth={penWidth}
                    className="w-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50"
                  />
                  <div className="absolute top-2 right-2">
                    <Button variant="ghost" size="icon" onClick={clearSignature} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Eraser size={16} />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <Button onClick={saveSignature} className="w-full gap-2" size="lg">
                    <Check size={16} /> Usa questa firma
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".firma,.json"
                      onChange={handleImportSignature}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Button variant="outline" className="w-full gap-2" size="lg" title="Carica file .firma">
                      <FileUp size={16} /> Carica .firma
                    </Button>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>

          {signatureImage && (
            <div className="space-y-4 pt-4 border-t animate-in slide-in-from-bottom-2">
              
              {/* Gruppo 1: Gestione Firma (Salvataggio/Export) */}
              <div className="bg-slate-50 p-3 rounded-lg border">
                <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Gestione Firma</p>
                
                <div className="mb-2">
                   <input 
                     type="text" 
                     value={exportFileName}
                     onChange={(e) => setExportFileName(e.target.value)}
                     placeholder="Nome file export..."
                     className="w-full text-xs p-2 rounded border bg-white mb-2"
                   />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button variant="outline" onClick={() => setSignatureImage(null)} className="w-full">
                    <RefreshCw size={16} className="mr-2" /> Ridisegna
                  </Button>
                  
                  <Button variant="outline" onClick={handleExportSignature} className="w-full" title="Esporta su file .firma">
                    <FileDown size={16} className="mr-2" /> Esporta .firma
                  </Button>
                </div>
              </div>

              {/* Gruppo 2: Azioni Documento */}
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <p className="text-xs font-bold text-primary mb-2 uppercase tracking-wider">Azioni Documento</p>
                <Button onClick={applySignature} className="w-full h-12 text-lg font-bold shadow-md gap-2">
                  <Download size={20} /> Applica Firma & Scarica PDF
                </Button>
              </div>
            </div>
          )}

          {/* Vault Section - Always visible to persist state */}
          <div className="mt-6">
            <SignatureVault 
              onSelectSignature={setSignatureImage} 
              signatureToSave={signatureImage}
              onSignatureSaved={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}