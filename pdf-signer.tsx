"use client";

import React, { useRef, useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { PenTool, Download, Eraser, Upload, FileText } from "lucide-react";
import { saveFile } from "@/utils/save-file";

export function PdfSigner() {
  const [file, setFile] = useState<File | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [penColor, setPenColor] = useState("#000000"); // Nero o Blu
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Gestione caricamento file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Logica di disegno su Canvas
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        if(ctx) ctx.closePath();
    }
  };

  // Helper per coordinate mouse/touch
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Applica la firma al PDF
  const applySignature = async () => {
    if (!file || !canvasRef.current) return;

    try {
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBuffer);
      
      // Converti canvas in PNG
      const signatureImage = canvasRef.current.toDataURL("image/png");
      const signatureImageEmbed = await pdfDoc.embedPng(signatureImage);

      // Ottieni la prima pagina (per semplicità in questo esempio)
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Disegna la firma al centro (o in basso)
      // Scala la firma per non essere enorme
      const sigDims = signatureImageEmbed.scale(0.5);

      firstPage.drawImage(signatureImageEmbed, {
        x: width / 2 - sigDims.width / 2,
        y: height / 4, // Posiziona nel quarto inferiore
        width: sigDims.width,
        height: sigDims.height,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      await saveFile(blob, `signed_${file.name}`);
      
      setIsSigning(false);
      setFile(null); // Reset
    } catch (err) {
      console.error("Errore firma:", err);
      alert("Impossibile firmare il PDF.");
    }
  };

  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
          <PenTool size={24} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Firma PDF</h2>
          <p className="text-sm text-muted-foreground">Firma col dito su mobile</p>
        </div>
      </div>

      {!file ? (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/5 hover:bg-muted/10">
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">Carica PDF da firmare</span>
          <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            <FileText size={18} />
            <span className="truncate text-sm font-medium">{file.name}</span>
          </div>

          <div className="rounded-xl border bg-white p-2 shadow-inner">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-medium text-muted-foreground">Area Firma</span>
              <div className="flex gap-2">
                <button onClick={() => setPenColor("#000000")} className={`h-4 w-4 rounded-full bg-black ${penColor === "#000000" ? "ring-2 ring-primary ring-offset-1" : ""}`} />
                <button onClick={() => setPenColor("#0000CC")} className={`h-4 w-4 rounded-full bg-blue-700 ${penColor === "#0000CC" ? "ring-2 ring-primary ring-offset-1" : ""}`} />
              </div>
            </div>
            
            <canvas
              ref={canvasRef}
              width={300}
              height={150}
              className="w-full touch-none rounded-lg border border-dashed bg-slate-50"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            
            <div className="mt-2 flex justify-end">
              <button onClick={clearSignature} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                <Eraser size={12} /> Pulisci
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setFile(null)} className="rounded-lg border py-2 text-sm hover:bg-accent">Annulla</button>
            <button onClick={applySignature} className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm text-primary-foreground hover:bg-primary/90">
              <Download size={16} /> Applica e Salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}