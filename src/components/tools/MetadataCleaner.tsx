"use client";

import React, { useState, useEffect } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileJson, ScanLine, ShieldCheck, MapPin, Camera, AlertCircle, Palette, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ─── Costanti ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── Tipi ────────────────────────────────────────────────────────────────────

type CleanReport = {
  hadExif: boolean;
  hadGPS: boolean;
  hadXMP: boolean;
  hadIPTC: boolean;
  hadICC: boolean;
  hadComment: boolean;
  hadTextMetadata: boolean; // PNG tEXt/iTXt/zTXt
  cameraMake?: string;
  cameraModel?: string;
  originalSize: number;
  cleanedSize: number;
  detectedFormat: 'jpeg' | 'png' | 'webp' | 'unknown';
  strippedSegments: string[];
};

// ─── Utility di lettura byte ──────────────────────────────────────────────────

function ru16(arr: Uint8Array, off: number, le: boolean): number {
  if (off + 1 >= arr.length) return 0;
  return le ? arr[off] | (arr[off + 1] << 8) : (arr[off] << 8) | arr[off + 1];
}

function ru32(arr: Uint8Array, off: number, le: boolean): number {
  if (off + 3 >= arr.length) return 0;
  return le
    ? (arr[off] | (arr[off + 1] << 8) | (arr[off + 2] << 16) | (arr[off + 3] << 24)) >>> 0
    : ((arr[off] << 24) | (arr[off + 1] << 16) | (arr[off + 2] << 8) | arr[off + 3]) >>> 0;
}

function readAscii(arr: Uint8Array, off: number, count: number): string {
  let str = '';
  for (let i = 0; i < count && off + i < arr.length; i++) {
    const c = arr[off + i];
    if (c === 0) break;
    str += String.fromCharCode(c);
  }
  return str.trim();
}

// ─── Rilevamento formato via Magic Bytes (non MIME type) ─────────────────────

function detectFormat(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'unknown' {
  if (bytes.length < 12) return 'unknown';
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === 'RIFF' && webp === 'WEBP') return 'webp';
  return 'unknown';
}

// ─── Rilevamento + Stripping metadati JPEG ──────────────────────────────────

function processJpeg(bytes: Uint8Array): {
  report: Partial<CleanReport>;
  cleaned: Uint8Array;
  wasModified: boolean;
} {
  const report: Partial<CleanReport> = {
    hadExif: false, hadGPS: false, hadXMP: false, hadIPTC: false,
    hadICC: false, hadComment: false,
    detectedFormat: 'jpeg',
    strippedSegments: [],
  };

  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    return { report, cleaned: bytes, wasModified: false };
  }

  // Segmenti essenziali da MANTENERE (necessari per decodificare l'immagine)
  const keepMarkers = new Set([
    0xC0, 0xC1, 0xC2, 0xC3, 0xC4,  // SOF + DHT
    0xC5, 0xC6, 0xC7, 0xC8, 0xC9,  // SOF varianti
    0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF,
    0xDB,                            // DQT (tabelle quantizzazione)
    0xDD,                            // DRI (restart interval)
    0xDA,                            // SOS (inizio scan)
  ]);

  const output: number[] = [0xFF, 0xD8]; // SOI
  let offset = 2;
  let wasModified = false;

  while (offset < bytes.length - 3) {
    // Protezione: cerca il prossimo marker 0xFF valido
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];

    // SOS: copia tutto il resto del file (dati compressi dell'immagine)
    if (marker === 0xDA) {
      for (let i = offset; i < bytes.length; i++) {
        output.push(bytes[i]);
      }
      break;
    }

    // Padding bytes
    if (marker === 0x00 || marker === 0xFF) {
      offset += 1;
      continue;
    }

    // Lunghezza del segmento (include i 2 byte della lunghezza stessa)
    if (offset + 3 >= bytes.length) break;
    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];

    // Protezione contro segmenti con lunghezza corrotta
    if (segLen < 2 || offset + 2 + segLen > bytes.length) break;

    const segmentSlice = bytes.slice(offset, offset + 2 + segLen);

    if (keepMarkers.has(marker)) {
      // Segmento essenziale → mantieni
      for (let i = 0; i < segmentSlice.length; i++) {
        output.push(segmentSlice[i]);
      }
    } else {
      // Segmento metadati → analizza e rimuovi
      wasModified = true;

      // APP1 (0xE1): EXIF o XMP
      if (marker === 0xE1 && offset + 10 < bytes.length) {
        const isExif =
          bytes[offset + 4] === 0x45 && bytes[offset + 5] === 0x78 &&
          bytes[offset + 6] === 0x69 && bytes[offset + 7] === 0x66 &&
          bytes[offset + 8] === 0x00 && bytes[offset + 9] === 0x00;

        if (isExif) {
          report.hadExif = true;
          report.strippedSegments!.push(`APP1/EXIF (${segLen} bytes)`);

          // Prova a estrarre info fotocamera prima di rimuovere
          try {
            const tiffStart = offset + 10;
            const tiffEnd = offset + 2 + segLen;
            if (tiffEnd <= bytes.length && tiffEnd - tiffStart > 8) {
              const tiff = bytes.slice(tiffStart, tiffEnd);
              const le = tiff[0] === 0x49 && tiff[1] === 0x49;
              const ifd0 = ru32(tiff, 4, le);

              if (ifd0 + 2 < tiff.length) {
                const numE = ru16(tiff, ifd0, le);
                for (let i = 0; i < numE && i < 200; i++) {
                  const e = ifd0 + 2 + i * 12;
                  if (e + 12 > tiff.length) break;
                  const tag = ru16(tiff, e, le);
                  const type = ru16(tiff, e + 2, le);
                  const count = ru32(tiff, e + 4, le);
                  const val = ru32(tiff, e + 8, le);

                  if (tag === 0x8825) report.hadGPS = true;

                  if ((tag === 0x010F || tag === 0x0110) && type === 2 && count > 0 && count < 256) {
                    const strOff = count <= 4 ? e + 8 : val;
                    if (strOff + count <= tiff.length) {
                      const str = readAscii(tiff, strOff, count);
                      if (tag === 0x010F) report.cameraMake = str;
                      if (tag === 0x0110) report.cameraModel = str;
                    }
                  }
                }
              }
            }
          } catch {
            // Parsing EXIF fallito — non è critico, stiamo comunque rimuovendo il segmento
          }
        } else {
          // Controlla XMP: firma "http://ns.adobe.com/xap/1.0/"
          const xmpSig = "http://ns.adobe.com/xap/1.0/";
          let segStr = '';
          try {
            const maxCheck = Math.min(segLen, 40);
            for (let i = 0; i < maxCheck; i++) {
              segStr += String.fromCharCode(bytes[offset + 4 + i]);
            }
          } catch { /* ignore */ }

          if (segStr.startsWith(xmpSig)) {
            report.hadXMP = true;
            report.strippedSegments!.push(`APP1/XMP (${segLen} bytes)`);
          } else {
            report.strippedSegments!.push(`APP1/Unknown (${segLen} bytes)`);
          }
        }
      }
      // APP0 (0xE0): JFIF
      else if (marker === 0xE0) {
        report.strippedSegments!.push(`APP0/JFIF (${segLen} bytes)`);
      }
      // APP2 (0xE2): ICC Profile
      else if (marker === 0xE2) {
        report.hadICC = true;
        report.strippedSegments!.push(`APP2/ICC Profile (${segLen} bytes)`);
      }
      // APP13 (0xED): IPTC/Photoshop
      else if (marker === 0xED) {
        report.hadIPTC = true;
        report.strippedSegments!.push(`APP13/IPTC (${segLen} bytes)`);
      }
      // APP14 (0xEE): Adobe
      else if (marker === 0xEE) {
        report.strippedSegments!.push(`APP14/Adobe (${segLen} bytes)`);
      }
      // Comment (0xFE)
      else if (marker === 0xFE) {
        report.hadComment = true;
        report.strippedSegments!.push(`Comment (${segLen} bytes)`);
      }
      // Qualsiasi altro APPn (0xE3-0xEF)
      else if (marker >= 0xE0 && marker <= 0xEF) {
        report.strippedSegments!.push(`APP${marker - 0xE0} (${segLen} bytes)`);
      }
      // Altro segmento sconosciuto → mantieni per sicurezza
      else {
        wasModified = false; // Non contare come modifica se non sappiamo cos'è
        for (let i = 0; i < segmentSlice.length; i++) {
          output.push(segmentSlice[i]);
        }
      }
    }

    offset += 2 + segLen;
  }

  const cleaned = new Uint8Array(output);
  return { report, cleaned, wasModified };
}

// ─── Rilevamento + Stripping metadati PNG ───────────────────────────────────

function processPng(bytes: Uint8Array): {
  report: Partial<CleanReport>;
  cleaned: Uint8Array;
  wasModified: boolean;
} {
  const report: Partial<CleanReport> = {
    hadExif: false, hadGPS: false, hadXMP: false, hadIPTC: false,
    hadICC: false, hadComment: false, hadTextMetadata: false,
    detectedFormat: 'png',
    strippedSegments: [],
  };

  // Signature PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    return { report, cleaned: bytes, wasModified: false };
  }

  // Chunk essenziali da MANTENERE
  const keepChunks = new Set([
    'IHDR', 'PLTE', 'IDAT', 'IEND',
    'tRNS', // trasparenza
    'cHRM', 'gAMA', 'sRGB', 'sBIT', // color management (opzionale ma utili)
    'bKGD', // background
    'pHYs', // risoluzione fisica (può essere mantenuto — è info di rendering, non tracking)
  ]);

  // Chunk metadati da RIMUOVERE
  const metadataChunks: Record<string, string> = {
    'tEXt': 'Text Metadata',
    'iTXt': 'International Text',
    'zTXt': 'Compressed Text',
    'tIME': 'Timestamp',
    'eXIf': 'EXIF',
    'iCCP': 'ICC Profile',
    'sPLT': 'Suggested Palette',
  };

  const output: number[] = [];

  // Copia la signature PNG (8 bytes)
  for (let i = 0; i < 8; i++) output.push(bytes[i]);

  let off = 8;
  let wasModified = false;

  while (off + 12 <= bytes.length) {
    // Lunghezza dati (4 bytes big-endian)
    const chunkLen = (
      (bytes[off] << 24) |
      (bytes[off + 1] << 16) |
      (bytes[off + 2] << 8) |
      bytes[off + 3]
    ) >>> 0;

    // Protezione contro chunk corrotti
    if (chunkLen > bytes.length - off - 12) break;

    // Tipo chunk (4 bytes ASCII)
    const chunkType = String.fromCharCode(
      bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]
    );

    // Dimensione totale del chunk: 4 (length) + 4 (type) + data + 4 (CRC)
    const totalChunkSize = 12 + chunkLen;

    if (chunkType in metadataChunks || (!keepChunks.has(chunkType) && chunkType !== chunkType.toUpperCase())) {
      // Chunk metadati → analizza e rimuovi
      wasModified = true;

      if (chunkType === 'eXIf') {
        report.hadExif = true;
      } else if (chunkType === 'iCCP') {
        report.hadICC = true;
      } else if (chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt') {
        report.hadTextMetadata = true;
        // Controlla se il testo contiene XMP
        try {
          const text = readAscii(bytes, off + 8, Math.min(chunkLen, 50));
          if (text.includes('XML') || text.includes('xmp') || text.includes('XMP')) {
            report.hadXMP = true;
          }
        } catch { /* ignore */ }
      } else if (chunkType === 'tIME') {
        report.hadTextMetadata = true;
      }

      const label = metadataChunks[chunkType] || chunkType;
      report.strippedSegments!.push(`${chunkType}/${label} (${chunkLen} bytes)`);
    } else {
      // Chunk essenziale → mantieni
      for (let i = 0; i < totalChunkSize && off + i < bytes.length; i++) {
        output.push(bytes[off + i]);
      }
    }

    off += totalChunkSize;

    // Terminazione: dopo IEND non c'è nient'altro
    if (chunkType === 'IEND') break;
  }

  const cleaned = new Uint8Array(output);
  return { report, cleaned, wasModified };
}

// ─── Rilevamento + Stripping metadati WebP ──────────────────────────────────

function processWebp(bytes: Uint8Array): {
  report: Partial<CleanReport>;
  cleaned: Uint8Array;
  wasModified: boolean;
} {
  const report: Partial<CleanReport> = {
    hadExif: false, hadGPS: false, hadXMP: false, hadIPTC: false,
    hadICC: false, hadComment: false,
    detectedFormat: 'webp',
    strippedSegments: [],
  };

  if (bytes.length < 12) {
    return { report, cleaned: bytes, wasModified: false };
  }

  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    return { report, cleaned: bytes, wasModified: false };
  }

  // Chunk da RIMUOVERE
  const metadataIds = new Set(['EXIF', 'XMP ', 'ICCP']);

  const output: number[] = [];
  // Copia header RIFF (12 bytes) — aggiorneremo la dimensione dopo
  for (let i = 0; i < 12; i++) output.push(bytes[i]);

  let off = 12;
  let wasModified = false;
  let removedBytes = 0;

  while (off + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    const size = bytes[off + 4] | (bytes[off + 5] << 8) | (bytes[off + 6] << 16) | (bytes[off + 7] << 24);
    const paddedSize = size + (size % 2); // WebP chunks sono allineati a 2 bytes
    const totalChunkSize = 8 + paddedSize;

    if (totalChunkSize + off > bytes.length + 8) break; // Protezione

    if (metadataIds.has(id)) {
      wasModified = true;
      removedBytes += totalChunkSize;

      if (id === 'EXIF') {
        report.hadExif = true;
        report.strippedSegments!.push(`EXIF (${size} bytes)`);
      } else if (id === 'XMP ') {
        report.hadXMP = true;
        report.strippedSegments!.push(`XMP (${size} bytes)`);
      } else if (id === 'ICCP') {
        report.hadICC = true;
        report.strippedSegments!.push(`ICC Profile (${size} bytes)`);
      }
    } else {
      for (let i = 0; i < totalChunkSize && off + i < bytes.length; i++) {
        output.push(bytes[off + i]);
      }
    }

    off += totalChunkSize;
  }

  // Aggiorna la dimensione nel RIFF header (bytes 4-7, little-endian)
  if (wasModified) {
    const newRiffSize = output.length - 8;
    output[4] = newRiffSize & 0xFF;
    output[5] = (newRiffSize >> 8) & 0xFF;
    output[6] = (newRiffSize >> 16) & 0xFF;
    output[7] = (newRiffSize >> 24) & 0xFF;
  }

  const cleaned = new Uint8Array(output);
  return { report, cleaned, wasModified };
}

// ─── Funzione principale di pulizia ─────────────────────────────────────────

async function cleanImageMetadata(file: File): Promise<{
  report: CleanReport;
  cleanedBlob: Blob;
  wasModified: boolean;
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = detectFormat(bytes);

  let result: { report: Partial<CleanReport>; cleaned: Uint8Array; wasModified: boolean };

  switch (format) {
    case 'jpeg':
      result = processJpeg(bytes);
      break;
    case 'png':
      result = processPng(bytes);
      break;
    case 'webp':
      result = processWebp(bytes);
      break;
    default:
      throw new Error(`Formato non supportato. Formati accettati: JPEG, PNG, WebP.`);
  }

  // REGOLA CHIAVE: se non è stato modificato nulla, restituisci il file originale IDENTICO
  const cleanedBytes = result.wasModified ? result.cleaned : bytes;
  const mimeMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  const cleanedBlob = new Blob([cleanedBytes], { type: mimeMap[format] || file.type });

  const report: CleanReport = {
    hadExif: result.report.hadExif ?? false,
    hadGPS: result.report.hadGPS ?? false,
    hadXMP: result.report.hadXMP ?? false,
    hadIPTC: result.report.hadIPTC ?? false,
    hadICC: result.report.hadICC ?? false,
    hadComment: result.report.hadComment ?? false,
    hadTextMetadata: result.report.hadTextMetadata ?? false,
    cameraMake: result.report.cameraMake,
    cameraModel: result.report.cameraModel,
    originalSize: file.size,
    cleanedSize: cleanedBlob.size,
    detectedFormat: format,
    strippedSegments: result.report.strippedSegments ?? [],
  };

  return { report, cleanedBlob, wasModified: result.wasModified };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MetadataCleaner({ onBack }: { onBack?: () => void }) {
  const [file, setFile]             = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanReport, setCleanReport] = useState<CleanReport | null>(null);

  // Revoca URL precedente quando cambia
  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);
  useEffect(() => { return () => { if (cleanedUrl) URL.revokeObjectURL(cleanedUrl); }; }, [cleanedUrl]);

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];

      // V9 fix: controllo dimensione file
      if (f.size > MAX_FILE_SIZE) {
        toast({
          variant: "destructive",
          title: "File troppo grande",
          description: `Il file supera il limite di ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        });
        return;
      }

      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setCleanedUrl(null);
      setCleanReport(null);
    }
  };

  // Supporto Incolla (Paste)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) { handleFileSelect([blob]); break; }
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const cleanMetadata = async () => {
    if (!file || !previewUrl) return;
    setIsCleaning(true);

    try {
      const { report, cleanedBlob, wasModified } = await cleanImageMetadata(file);

      setCleanReport(report);

      if (wasModified) {
        setCleanedUrl(URL.createObjectURL(cleanedBlob));
        toast({
          title: "Metadati Rimossi",
          description: `Rimossi ${report.strippedSegments.length} segmenti. File ridotto da ${(report.originalSize / 1024).toFixed(1)} KB a ${(report.cleanedSize / 1024).toFixed(1)} KB.`,
        });
      } else {
        // Nessun metadato trovato → restituisci l'originale senza re-encoding
        setCleanedUrl(previewUrl);
        toast({
          title: "Nessun Metadato Trovato",
          description: "L'immagine non conteneva metadati rilevabili. Il file resta invariato.",
        });
      }
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Impossibile pulire l'immagine.";
      toast({ variant: "destructive", title: "Errore", description: msg });
    } finally {
      setIsCleaning(false);
    }
  };

  const hadAny = cleanReport
    ? cleanReport.hadExif || cleanReport.hadGPS || cleanReport.hadXMP ||
      cleanReport.hadIPTC || cleanReport.hadICC || cleanReport.hadComment ||
      cleanReport.hadTextMetadata
    : false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <ScanLine className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline tracking-tight">Metadati & Pulizia</CardTitle>
                <CardDescription className="text-white/80 text-lg">Visualizza e rimuovi dati nascosti dalle tue immagini.</CardDescription>
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
            <FileUpload
              onFileSelect={handleFileSelect}
              accept="image/*"
              label="Carica immagine per analisi"
              description="Supporta JPG, PNG, WEBP. Incolla con CTRL+V. Max 50 MB."
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {/* ── Colonna sinistra: anteprima + bottoni ── */}
              <div className="space-y-6">
                <div className="relative rounded-xl overflow-hidden border shadow-sm bg-muted/30 dark:bg-card flex items-center justify-center min-h-[300px]">
                  <img src={previewUrl!} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
                </div>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => { setFile(null); setPreviewUrl(null); setCleanedUrl(null); setCleanReport(null); }}
                    className="flex-1 h-12 rounded-xl"
                  >
                    Cambia File
                  </Button>
                  <Button
                    onClick={cleanMetadata}
                    disabled={isCleaning || !!cleanedUrl}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-bold"
                  >
                    {isCleaning ? "Analisi..." : cleanedUrl ? "Pulito!" : "Rimuovi Metadati"}
                  </Button>
                </div>
              </div>

              {/* ── Colonna destra: info + report ── */}
              <div className="space-y-6">
                {/* Info file */}
                <div className="bg-muted/30 p-6 rounded-2xl border space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-primary">
                    <FileJson className="w-5 h-5" />
                    Dati File
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Nome</span>
                      <span className="font-mono truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-mono">{file.type || 'N/A'}</span>
                    </div>
                    {cleanReport && (
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-muted-foreground">Formato Reale</span>
                        <span className="font-mono uppercase">{cleanReport.detectedFormat}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Dimensione</span>
                      <span className="font-mono">{(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-muted-foreground">Ultima Modifica</span>
                      <span className="font-mono">{new Date(file.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-xs mt-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200">
                    La rimozione opera a livello binario: i segmenti metadati vengono rimossi senza ri-codificare l&apos;immagine. Qualità pixel-perfect garantita.
                  </p>
                </div>

                {/* Riepilogo pulizia */}
                {cleanReport && (
                  <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-2xl border p-6 space-y-4 ${
                    hadAny
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/50'
                  }`}>
                    <h3 className={`font-bold flex items-center gap-2 ${
                      hadAny ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
                    }`}>
                      <ShieldCheck className="w-5 h-5" />
                      Riepilogo Pulizia
                    </h3>

                    {/* Fotocamera rilevata */}
                    {(cleanReport.cameraMake || cleanReport.cameraModel) && (
                      <div className="flex items-start gap-3 text-sm bg-white/60 dark:bg-black/20 rounded-xl p-3">
                        <Camera className="w-4 h-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-200">Fotocamera rilevata</p>
                          <p className="text-green-700 dark:text-green-300">
                            {[cleanReport.cameraMake, cleanReport.cameraModel].filter(Boolean).join(' ')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Lista elementi rimossi */}
                    <ul className="space-y-2 text-sm">
                      {cleanReport.hadExif && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="text-green-500 font-bold">✓</span>
                          Dati EXIF rimossi <span className="text-xs text-muted-foreground">(fotocamera, impostazioni, timestamp)</span>
                        </li>
                      )}
                      {cleanReport.hadGPS && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span className="font-semibold">Coordinate GPS rimosse</span>
                        </li>
                      )}
                      {cleanReport.hadXMP && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="text-green-500 font-bold">✓</span>
                          Metadati XMP rimossi <span className="text-xs text-muted-foreground">(copyright, descrizioni Adobe)</span>
                        </li>
                      )}
                      {cleanReport.hadIPTC && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="text-green-500 font-bold">✓</span>
                          Metadati IPTC rimossi <span className="text-xs text-muted-foreground">(autore, agenzia, parole chiave)</span>
                        </li>
                      )}
                      {cleanReport.hadICC && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <Palette className="w-3.5 h-3.5 flex-shrink-0" />
                          Profilo ICC rimosso <span className="text-xs text-muted-foreground">(profilo colore dispositivo)</span>
                        </li>
                      )}
                      {cleanReport.hadComment && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="text-green-500 font-bold">✓</span>
                          Commenti rimossi
                        </li>
                      )}
                      {cleanReport.hadTextMetadata && (
                        <li className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <span className="text-green-500 font-bold">✓</span>
                          Metadati testuali rimossi <span className="text-xs text-muted-foreground">(tEXt/iTXt/zTXt/tIME)</span>
                        </li>
                      )}
                      {!hadAny && (
                        <li className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          Nessun metadato sensibile rilevato — file restituito identico
                        </li>
                      )}
                    </ul>

                    {/* Segmenti rimossi nel dettaglio */}
                    {cleanReport.strippedSegments.length > 0 && (
                      <details className="text-xs border-t border-green-200 dark:border-green-900/50 pt-3">
                        <summary className="cursor-pointer text-green-700 dark:text-green-300 font-semibold">
                          Dettaglio segmenti rimossi ({cleanReport.strippedSegments.length})
                        </summary>
                        <ul className="mt-2 space-y-1 text-muted-foreground font-mono">
                          {cleanReport.strippedSegments.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {/* Differenza dimensione */}
                    <div className={`text-xs border-t pt-3 flex items-center gap-2 ${
                      hadAny
                        ? 'text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50'
                        : 'text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50'
                    }`}>
                      <span>Dimensione:</span>
                      <span className="font-mono">{(cleanReport.originalSize / 1024).toFixed(1)} KB</span>
                      <span>→</span>
                      <span className="font-mono">{(cleanReport.cleanedSize / 1024).toFixed(1)} KB</span>
                      {cleanReport.cleanedSize < cleanReport.originalSize && (
                        <span className="font-bold text-green-600 dark:text-green-400">
                          (-{((1 - cleanReport.cleanedSize / cleanReport.originalSize) * 100).toFixed(1)}%)
                        </span>
                      )}
                      {cleanReport.cleanedSize === cleanReport.originalSize && (
                        <span className="font-bold text-yellow-600 dark:text-yellow-400">
                          (invariato)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottone download */}
                {cleanedUrl && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Button
                      className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-xl"
                      asChild
                    >
                      <a href={cleanedUrl} download={`clean-${file.name}`}>
                        <Download className="mr-2 h-5 w-5" />
                        Scarica Immagine Pulita
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}