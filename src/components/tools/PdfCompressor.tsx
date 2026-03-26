"use client";

import React, { useState, useEffect } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Minimize2, Loader2, Download, ArrowLeft,
  CheckCircle2, TrendingDown, AlertTriangle, Info,
  Shield, SlidersHorizontal, Zap, LucideIcon,
} from 'lucide-react';
import { PDFDocument, PDFName } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { toast } from '@/hooks/use-toast';
import { PdfThumbnail } from '@/components/shared/PdfThumbnail';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// ─── Worker ──────────────────────────────────────────────────────────────────
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── Types ───────────────────────────────────────────────────────────────────

type MainLevel = 'low' | 'medium' | 'high';
type SubLevel = 1 | 2 | 3;

/**
 * Two compression paths:
 *   'pdflib'    — structural cleanup only via pdf-lib; text/links/bookmarks preserved.
 *   'rasterize' — page-by-page canvas render; text NOT selectable but images compressed.
 */
type CompressionPath = 'pdflib' | 'rasterize';

interface SubLevelConfig {
  id: string;              // B1, B2, M1, A3…
  name: string;
  description: string;
  savings: string;
  preservesText: boolean;
  path: CompressionPath;
  // — pdflib options —
  useObjectStreams?: boolean;
  // — rasterize options —
  renderScale?: number;
  jpegQuality?: number;
  useJpegForText?: boolean;
  // — display —
  kept: string[];
  lost: string[];
}

interface MainLevelConfig {
  icon: LucideIcon;
  borderSelected: string;
  bgSelected: string;
  textSelected: string;
  bgUnselected: string;
  label: string;
  title: string;
  savings: string;
  subLevels: [SubLevelConfig, SubLevelConfig, SubLevelConfig];
}

// ─── Level Definitions ───────────────────────────────────────────────────────

/**
 * Full 9-sublevel architecture as per design document revision 1.0.
 *
 * LOW  B1/B2 → pdf-lib structural path (text selectable, links/bookmarks intact).
 * LOW  B3    → high-quality rasterization (text lost, but visually near-perfect).
 * MED  M1–M3 → medium rasterization (progressively more aggressive).
 * HIGH A1–A3 → low rasterization (A3 = archival minimum).
 */
const LEVELS: Record<MainLevel, MainLevelConfig> = {
  low: {
    icon: Shield,
    borderSelected: 'border-emerald-500',
    bgSelected: 'bg-emerald-50',
    textSelected: 'text-emerald-700',
    bgUnselected: 'hover:border-emerald-200',
    label: 'Bassa',
    title: 'Qualità Preservata',
    savings: '5–30%',
    subLevels: [
      {
        id: 'B1',
        name: 'Pulizia Base',
        description:
          'Rimuove metadati (XMP + InfoDict), thumbnail incorporate e oggetti orfani. '
          + 'Operazione esclusivamente strutturale tramite pdf-lib — nessuna rasterizzazione.',
        savings: '5–15%',
        preservesText: true,
        path: 'pdflib',
        useObjectStreams: false,
        kept: ['Testo selezionabile', 'Link ipertestuali', 'Segnalibri', 'Form compilabili', 'Immagini originali', 'Tag accessibilità'],
        lost: ['Metadati (autore, titolo, software)', 'Thumbnail incorporate', 'Oggetti orfani'],
      },
      {
        id: 'B2',
        name: 'Compressione Strutturale',
        description:
          'B1 + Object Streams PDF 1.5: compatta più oggetti in stream compressi, riducendo '
          + 'la struttura stessa del file. Testo perfettamente selezionabile.',
        savings: '10–25%',
        preservesText: true,
        path: 'pdflib',
        useObjectStreams: true,
        kept: ['Testo selezionabile', 'Link ipertestuali', 'Segnalibri', 'Form compilabili', 'Tag accessibilità'],
        lost: ['Metadati', 'Thumbnail', 'Compatibilità lettori PDF < 1.5'],
      },
      {
        id: 'B3',
        name: 'Immagini Schermo',
        description:
          'Rasterizzazione ad alta qualità (scala 1.8×). Pagine di testo → PNG lossless, '
          + 'pagine con immagini → JPEG 85%. Qualità visiva quasi identica all\'originale.',
        savings: '15–40%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 1.8,
        jpegQuality: 0.85,
        useJpegForText: false,
        kept: ['Alta qualità visiva', 'Testo leggibile'],
        lost: ['Testo selezionabile', 'Link ipertestuali', 'Segnalibri', 'Form compilabili', 'Metadati'],
      },
    ],
  },

  medium: {
    icon: SlidersHorizontal,
    borderSelected: 'border-amber-500',
    bgSelected: 'bg-amber-50',
    textSelected: 'text-amber-700',
    bgUnselected: 'hover:border-amber-200',
    label: 'Media',
    title: 'Bilanciato',
    savings: '20–60%',
    subLevels: [
      {
        id: 'M1',
        name: 'Immagini Moderate',
        description:
          'Rasterizzazione scala 1.5×, pagine di testo in PNG, immagini in JPEG 75%. '
          + 'Buon equilibrio tra qualità visiva e risparmio di spazio.',
        savings: '20–40%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 1.5,
        jpegQuality: 0.75,
        useJpegForText: false,
        kept: ['Buona qualità visiva', 'Testo leggibile'],
        lost: ['Testo selezionabile', 'Link', 'Segnalibri', 'Form', 'Metadati'],
      },
      {
        id: 'M2',
        name: 'Compressione Moderata',
        description:
          'Rasterizzazione scala 1.3×, JPEG 65% su tutte le pagine. '
          + 'Dimensioni nettamente ridotte; testo leggibile ma con lieve sfocatura.',
        savings: '30–55%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 1.3,
        jpegQuality: 0.65,
        useJpegForText: true,
        kept: ['Testo leggibile a schermo'],
        lost: ['Testo selezionabile', 'Link', 'Form', 'Qualità immagini ridotta', 'Metadati'],
      },
      {
        id: 'M3',
        name: 'Compressione Aggressiva',
        description:
          'Rasterizzazione scala 1.1×, JPEG 55%. File molto leggero per condivisione web; '
          + 'qualità accettabile per lettura a schermo, sconsigliata per stampa.',
        savings: '40–65%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 1.1,
        jpegQuality: 0.55,
        useJpegForText: true,
        kept: ['File leggero'],
        lost: ['Testo selezionabile', 'Link', 'Qualità immagini percepibilmente ridotta', 'Metadati'],
      },
    ],
  },

  high: {
    icon: Zap,
    borderSelected: 'border-red-500',
    bgSelected: 'bg-red-50',
    textSelected: 'text-red-700',
    bgUnselected: 'hover:border-red-200',
    label: 'Alta',
    title: 'Massima Compressione',
    savings: '40–85%',
    subLevels: [
      {
        id: 'A1',
        name: 'Rasterizzazione Standard',
        description:
          'Scala 1.2×, JPEG 70% su tutte le pagine. Testo ancora leggibile a schermo; '
          + 'dimensioni molto ridotte. Adatto per condivisione digitale.',
        savings: '40–60%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 1.2,
        jpegQuality: 0.70,
        useJpegForText: true,
        kept: ['File compatto', 'Testo leggibile a schermo'],
        lost: ['Testo selezionabile', 'Link', 'Struttura PDF', 'Stampa ad alta qualità'],
      },
      {
        id: 'A2',
        name: 'Rasterizzazione Totale',
        description:
          'Scala 1.0×, JPEG 50%. Dimensione minima per condivisione rapida. '
          + 'Solo per visualizzazione — qualità visiva ridotta in modo percepibile.',
        savings: '55–75%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 1.0,
        jpegQuality: 0.50,
        useJpegForText: true,
        kept: ['File molto compatto'],
        lost: ['Testo selezionabile', 'Qualità immagini ridotta', 'Link', 'Struttura'],
      },
      {
        id: 'A3',
        name: 'Rasterizzazione Massima',
        description:
          'Scala 0.75×, JPEG 30%. Dimensione assoluta minima. '
          + 'Solo per archiviazione o anteprime — qualità visiva significativamente compromessa.',
        savings: '65–85%',
        preservesText: false,
        path: 'rasterize',
        renderScale: 0.75,
        jpegQuality: 0.30,
        useJpegForText: true,
        kept: ['Dimensione minima assoluta'],
        lost: ['Qualità visiva significativamente ridotta', 'Testo selezionabile', 'Link', 'Struttura'],
      },
    ],
  },
};

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Heuristic: samples a grid of pixels; if ≥ threshold fraction are near-white
 * the page is considered text/vector-dominant → encode as PNG (lossless).
 */
function isTextDominantPage(canvas: HTMLCanvasElement, threshold = 0.70): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  const { width, height } = canvas;
  const SAMPLES = 40;
  const stepX = Math.max(1, Math.floor(width / SAMPLES));
  const stepY = Math.max(1, Math.floor(height / SAMPLES));
  let white = 0, total = 0;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      if (r > 210 && g > 210 && b > 210) white++;
      total++;
    }
  }
  return white / total >= threshold;
}

/** Encodes a canvas as either JPEG (images/high mode) or PNG (text pages). */
function encodeCanvas(
  canvas: HTMLCanvasElement,
  jpegQuality: number,
  useJpegForText: boolean,
): string {
  if (!useJpegForText && isTextDominantPage(canvas)) {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', jpegQuality);
}

/** Converts a base64 string to Uint8Array without Buffer (browser-safe). */
function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ─── Compression Engines ─────────────────────────────────────────────────────

/**
 * PATH 1 — pdf-lib structural compression (B1 / B2).
 * No rasterization: text, links, bookmarks and forms are fully preserved.
 *
 * Operations performed:
 *   • Strip InfoDict (title, author, subject, keywords, producer, creator)
 *   • Delete XMP metadata stream from document catalog
 *   • Delete embedded thumbnail (/Thumb) from every page
 *   • Save with optional Object Streams (B2) for additional structural compression
 */
async function runPdfLibCompression(
  buffer: ArrayBuffer,
  useObjectStreams: boolean,
  onProgress: (pct: number, msg: string) => void,
): Promise<Uint8Array> {
  onProgress(5, 'Analisi struttura PDF…');

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
  } catch (e: any) {
    throw new Error(
      e?.message?.includes('encrypt')
        ? 'Il PDF è protetto da password — impossibile elaborare.'
        : 'PDF non valido o corrotto.',
    );
  }

  onProgress(20, 'Rimozione metadati…');

  // Clear standard InfoDict fields
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('');
  pdfDoc.setCreator('');

  // Remove XMP metadata stream from catalog (harmless if absent)
  try { (pdfDoc.catalog as any).delete(PDFName.of('Metadata')); } catch {}

  onProgress(45, 'Rimozione thumbnail incorporate…');
  for (const page of pdfDoc.getPages()) {
    try { (page.node as any).delete(PDFName.of('Thumb')); } catch {}
  }

  onProgress(70, useObjectStreams ? 'Compressione oggetti PDF (Object Streams)…' : 'Ottimizzazione struttura…');

  const bytes = await pdfDoc.save({
    useObjectStreams,
    addDefaultPage: false,
    objectsPerTick: 50,
  });

  onProgress(100, 'Completato');
  return bytes;
}

/**
 * PATH 2 — pdfjs canvas rasterization (B3 / M1–M3 / A1–A3).
 * Each page is rendered to an off-screen canvas and re-encoded as JPEG or PNG,
 * then assembled into a new PDF via pdf-lib.
 *
 * Text will NOT be selectable in the output.
 */
async function runRasterizeCompression(
  buffer: ArrayBuffer,
  renderScale: number,
  jpegQuality: number,
  useJpegForText: boolean,
  onProgress: (pct: number, msg: string) => void,
): Promise<Uint8Array> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const sourcePdf = await loadingTask.promise;
  const numPages = sourcePdf.numPages;
  const outPdf = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    onProgress(Math.round(((i - 1) / numPages) * 92), `Pagina ${i} di ${numPages}…`);

    const page = await sourcePdf.getPage(i);
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = encodeCanvas(canvas, jpegQuality, useJpegForText);
    const [header, b64] = dataUrl.split(',');
    const imgBytes = base64ToUint8Array(b64);
    const isJpeg = header.includes('jpeg');

    const embedded = isJpeg
      ? await outPdf.embedJpg(imgBytes)
      : await outPdf.embedPng(imgBytes);

    const newPage = outPdf.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embedded, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  }

  onProgress(95, 'Finalizzazione…');
  const bytes = await outPdf.save();
  onProgress(100, 'Completato');
  return bytes;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PdfCompressor({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [mainLevel, setMainLevel] = useState<MainLevel>('medium');
  const [subLevel, setSubLevel] = useState<SubLevel>(1);
  const [compressing, setCompressing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [sizes, setSizes] = useState({ original: 0, compressed: 0 });
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // Revoke blob URL on change or unmount to avoid memory leaks
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  const levelCfg = LEVELS[mainLevel];
  const subCfg = levelCfg.subLevels[subLevel - 1];

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileSelect = (files: File[]) => {
    const f = files[0];
    if (!f) return;

    if (f.size > MAX_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'File troppo grande',
        description: `Limite: ${MAX_FILE_SIZE / 1024 / 1024} MB. Il tuo file: ${(f.size / 1024 / 1024).toFixed(2)} MB.`,
      });
      return;
    }
    if (f.type && f.type !== 'application/pdf') {
      toast({ variant: 'destructive', title: 'Formato non valido', description: 'Carica un file PDF.' });
      return;
    }

    setFile(f);
    setResultUrl(null);
    setSizes({ original: 0, compressed: 0 });
    setProgress(0);
  };

  // ── Compression ───────────────────────────────────────────────────────────
  const handleCompress = async () => {
    if (!file) return;

    setCompressing(true);
    setProgress(0);
    setStatusText('Caricamento documento…');

    const onProgress = (pct: number, msg: string) => {
      setProgress(pct);
      setStatusText(msg);
    };

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Validate PDF magic bytes (%PDF-)
      const magic = new Uint8Array(arrayBuffer.slice(0, 5));
      if (String.fromCharCode(...magic) !== '%PDF-') {
        throw new Error('Il file non è un PDF valido.');
      }

      let resultBytes: Uint8Array;

      if (subCfg.path === 'pdflib') {
        resultBytes = await runPdfLibCompression(
          arrayBuffer,
          subCfg.useObjectStreams ?? false,
          onProgress,
        );
      } else {
        resultBytes = await runRasterizeCompression(
          arrayBuffer,
          subCfg.renderScale ?? 1.5,
          subCfg.jpegQuality ?? 0.75,
          subCfg.useJpegForText ?? false,
          onProgress,
        );
      }

      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      setResultUrl(URL.createObjectURL(blob));
      setSizes({ original: file.size, compressed: resultBytes.length });

    } catch (error: any) {
      console.error('[PdfCompressor]', error);
      toast({
        variant: 'destructive',
        title: 'Errore durante la compressione',
        description: error?.message ?? 'Il file potrebbe essere corrotto o protetto da password.',
      });
    } finally {
      setCompressing(false);
      setStatusText('');
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(null);
    setResultUrl(null);
    setSizes({ original: 0, compressed: 0 });
    setProgress(0);
    setStatusText('');
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const reduction = sizes.original > 0
    ? Math.max(0, Math.round(((sizes.original - sizes.compressed) / sizes.original) * 100))
    : 0;
  const isEffective = sizes.compressed > 0 && sizes.compressed < sizes.original;

  // Show destructive warning when rasterization will severely degrade quality (A2/A3)
  const isDestructiveLevel =
    mainLevel === 'high' && subLevel >= 2;

  // Show text-loss warning for any rasterizing sub-level
  const isRasterizing = subCfg.path === 'rasterize';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">

      {/* Header */}
      <CardHeader className="bg-primary text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Minimize2 className="w-6 h-6" />
            <CardTitle>Comprimi PDF</CardTitle>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-8">

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {!file && (
          <FileUpload
            onFileSelect={handleFileSelect}
            accept="application/pdf"
            label="Carica PDF da ottimizzare"
            description={`Riduci le dimensioni del file. Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`}
          />
        )}

        {/* ── Step 2: Configure & Compress ──────────────────────────────── */}
        {file && !resultUrl && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">

            {/* File preview card */}
            <div className="p-5 bg-muted/30 rounded-2xl border-2 border-dashed flex items-center gap-5">
              <PdfThumbnail file={file} width={72} className="shadow-lg rounded-lg flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-primary truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
              </div>
            </div>

            {/* ─ Main level selector ─────────────────────────────────────── */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Livello di Compressione
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(LEVELS) as [MainLevel, MainLevelConfig][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isSelected = mainLevel === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setMainLevel(key);
                        setSubLevel(1);
                      }}
                      className={cn(
                        'relative p-4 rounded-2xl border-2 text-left transition-all duration-200',
                        isSelected
                          ? `${cfg.borderSelected} ${cfg.bgSelected}`
                          : `border-muted bg-background ${cfg.bgUnselected} transition-colors`,
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 mb-2.5',
                          isSelected ? cfg.textSelected : 'text-muted-foreground',
                        )}
                      />
                      <p className={cn('font-bold text-sm', isSelected ? cfg.textSelected : '')}>
                        {cfg.label}
                      </p>
                      <p className={cn(
                        'text-xs leading-snug mt-0.5',
                        isSelected ? `${cfg.textSelected} opacity-80` : 'text-muted-foreground',
                      )}>
                        {cfg.title}
                      </p>
                      <p className={cn(
                        'text-xs font-semibold mt-1.5',
                        isSelected ? `${cfg.textSelected} opacity-70` : 'text-muted-foreground',
                      )}>
                        ~{cfg.savings}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─ Sub-level selector ──────────────────────────────────────── */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Intensità
              </p>
              <div className="space-y-2">
                {levelCfg.subLevels.map((sub, idx) => {
                  const isSelected = subLevel === (idx + 1);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSubLevel((idx + 1) as SubLevel)}
                      className={cn(
                        'w-full p-4 rounded-xl border-2 text-left transition-all duration-150',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-muted bg-background hover:border-muted-foreground/30',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Radio dot */}
                        <div className={cn(
                          'mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                        )}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-semibold text-sm">
                              <span className="text-muted-foreground font-normal mr-1">{sub.id}</span>
                              {sub.name}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              ~{sub.savings}
                            </span>
                            {sub.preservesText && (
                              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                                ✓ Testo selezionabile
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {sub.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─ Feature impact summary ──────────────────────────────────── */}
            <div className="p-4 rounded-xl bg-muted/20 border space-y-2.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Cosa viene conservato e rimosso
              </p>
              <div className="flex flex-wrap gap-1.5">
                {subCfg.kept.map(f => (
                  <span
                    key={f}
                    className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full"
                  >
                    ✅ {f}
                  </span>
                ))}
                {subCfg.lost.map(f => (
                  <span
                    key={f}
                    className="text-xs bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded-full"
                  >
                    ✗ {f}
                  </span>
                ))}
              </div>
            </div>

            {/* ─ Rasterization info (B3 / M / A levels) ─────────────────── */}
            {isRasterizing && !isDestructiveLevel && (
              <Alert className="py-3 bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <AlertDescription className="text-xs text-blue-700 ml-1 leading-relaxed">
                  Questo livello rasterizza le pagine su canvas — il testo <strong>non sarà selezionabile</strong> nel PDF compresso.
                  Per mantenere il testo selezionabile usa <strong>B1</strong> o <strong>B2</strong>.
                </AlertDescription>
              </Alert>
            )}

            {/* ─ Destructive warning (A2 / A3) ──────────────────────────── */}
            {isDestructiveLevel && (
              <Alert className="bg-red-50 border-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800 font-bold">Attenzione: qualità significativamente ridotta</AlertTitle>
                <AlertDescription className="text-red-700 text-xs leading-relaxed mt-1">
                  Il livello <strong>{subCfg.id}</strong> rasterizza a bassa risoluzione e qualità minima.
                  Il testo non sarà selezionabile e la qualità visiva sarà percepibilmente degradata.
                  Usa solo per archiviazione o anteprime, mai per documenti ufficiali.
                </AlertDescription>
              </Alert>
            )}

            {/* ─ Progress bar ───────────────────────────────────────────── */}
            {compressing && (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>{statusText}</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* ─ Actions ────────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="h-12 px-5 rounded-xl font-medium"
                onClick={reset}
                disabled={compressing}
              >
                Cambia file
              </Button>
              <Button
                onClick={handleCompress}
                disabled={compressing}
                className="flex-1 h-12 text-base font-bold shadow-lg rounded-xl"
              >
                {compressing ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Elaborazione in corso…
                  </>
                ) : (
                  <>
                    <Minimize2 className="mr-2 h-5 w-5" />
                    Ottimizza con {subCfg.id}
                  </>
                )}
              </Button>
            </div>

          </div>
        )}

        {/* ── Step 3: Result ─────────────────────────────────────────────── */}
        {resultUrl && (
          <div className="flex flex-col items-center gap-8 py-10 animate-in zoom-in-95 duration-300">

            {/* Status icon */}
            {isEffective ? (
              <div className="p-10 bg-green-50 rounded-full text-green-600 shadow-inner">
                <CheckCircle2 size={64} />
              </div>
            ) : (
              <div className="p-10 bg-yellow-50 rounded-full text-yellow-600 shadow-inner">
                <AlertTriangle size={64} />
              </div>
            )}

            <div className="text-center space-y-4 w-full max-w-md">
              <h3 className="text-3xl font-black text-primary tracking-tight">
                {isEffective ? 'PDF Ottimizzato!' : 'Nessun Risparmio'}
              </h3>

              {/* Already-optimized hint */}
              {!isEffective && (
                <Alert className="bg-yellow-50 border-yellow-200 text-left">
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800">File già ottimizzato</AlertTitle>
                  <AlertDescription className="text-yellow-700 text-sm">
                    Il PDF era già al massimo per il livello <strong>{subCfg.id}</strong>.
                    {subCfg.path === 'pdflib'
                      ? ' Prova B3 o un livello superiore per la compressione delle immagini.'
                      : ' Prova un sotto-livello più aggressivo.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Size comparison */}
              <div className="flex items-center justify-center gap-6 bg-muted/50 p-6 rounded-2xl border">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Prima</p>
                  <p className="text-xl font-bold">{formatSize(sizes.original)}</p>
                </div>
                <TrendingDown className={cn(
                  'w-8 h-8',
                  isEffective ? 'text-green-500' : 'text-muted-foreground',
                )} />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Dopo</p>
                  <p className={cn(
                    'text-xl font-bold',
                    isEffective ? 'text-green-600' : 'text-yellow-600',
                  )}>
                    {formatSize(sizes.compressed)}
                  </p>
                </div>
                {isEffective && (
                  <div className="ml-2 pl-5 border-l text-center">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide">Risparmio</p>
                    <p className="text-3xl font-black text-green-600">-{reduction}%</p>
                  </div>
                )}
              </div>

              {/* Level label */}
              <p className="text-sm text-muted-foreground">
                Compresso con livello{' '}
                <span className="font-semibold text-foreground">{subCfg.id} — {subCfg.name}</span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" className="h-12 flex-1 rounded-xl font-medium" onClick={reset}>
                Comprimi altro
              </Button>
              <Button asChild className="h-12 flex-1 rounded-xl font-bold shadow-lg">
                <a
                  href={resultUrl}
                  download={`${subCfg.id.toLowerCase()}-${file?.name ?? 'file.pdf'}`}
                >
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