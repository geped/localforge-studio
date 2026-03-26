"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Download, Eraser, Loader2, Sparkles, AlertCircle, Type,
  Brush, Undo2, ArrowLeft, RotateCcw, Upload, X, Key, Cpu,
  Eye, EyeOff, HelpCircle, ExternalLink, CheckCircle2,
  GripVertical, Palette, Layers, Wand2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { removeImageBackground } from '@/ai/flows/remove-image-background-flow';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* ─── constants ─────────────────────────────────────────── */
const LS_API_KEY = 'fileforge_removebg_api_key';
const LS_MODE    = 'fileforge_bg_mode';

type ProcessingMode = 'browser' | 'api';
type DrawTool       = 'erase'   | 'restore';

/* ─── checkerboard CSS ───────────────────────────────────── */
const CHECKER = {
  background: 'repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 0 0 / 18px 18px',
} as const;

/* ═══════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════ */
export function BackgroundRemover({ onBack }: { onBack?: () => void }) {

  /* ── core ── */
  const [file,           setFile]           = useState<File | null>(null);
  const [processing,     setProcessing]     = useState(false);
  const [resultUrl,      setResultUrl]      = useState<string | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState<string | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState('');

  /* ── mode / API ── */
  const [processingMode,   setProcessingMode]   = useState<ProcessingMode>('browser');
  const [apiKeyInput,      setApiKeyInput]      = useState('');
  const [savedApiKey,      setSavedApiKey]      = useState('');
  const [showApiKey,       setShowApiKey]       = useState(false);
  const [showApiTutorial,  setShowApiTutorial]  = useState(false);
  const [progressStage,    setProgressStage]    = useState('');
  const [progressValue,    setProgressValue]    = useState(0);

  /* ── canvas / editor ── */
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const isDrawingRef  = useRef(false);                    // ref keeps drawing smooth (no stale state)
  const startPos      = useRef<{ x: number; y: number } | null>(null);

  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded,   setImageLoaded]   = useState(false);
  const [tool,          setTool]          = useState<DrawTool>('erase');
  const [brushSize,     setBrushSize]     = useState(30);
  const [editMode,      setEditMode]      = useState(false);
  const [history,       setHistory]       = useState<string[]>([]);
  const [initialState,  setInitialState]  = useState<string | null>(null);

  /* ── cursor preview ── */
  const [cursorPos,          setCursorPos]          = useState<{ x: number; y: number } | null>(null);
  const [brushDisplayRadius, setBrushDisplayRadius] = useState(15);

  /* ── before/after slider ── */
  const [sliderPos, setSliderPos] = useState(50);

  /* ── background fill for download ── */
  const [downloadBgColor, setDownloadBgColor] = useState('');
  const [downloadUrl,     setDownloadUrl]     = useState<string | null>(null);

  /* ══════════════════════════════════════════════════════════
     Load prefs from localStorage
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const key  = localStorage.getItem(LS_API_KEY) ?? '';
    const mode = (localStorage.getItem(LS_MODE) as ProcessingMode) ?? 'browser';
    setSavedApiKey(key);
    setApiKeyInput(key);
    setProcessingMode(mode);
  }, []);

  /* ══════════════════════════════════════════════════════════
     Compute download URL (with optional bg fill)
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!resultUrl) { setDownloadUrl(null); return; }
    if (!downloadBgColor) { setDownloadUrl(resultUrl); return; }

    const img    = new Image();
    img.onload   = () => {
      const c   = document.createElement('canvas');
      c.width   = img.width;
      c.height  = img.height;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = downloadBgColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      setDownloadUrl(c.toDataURL('image/png'));
    };
    img.src = resultUrl;
  }, [resultUrl, downloadBgColor]);

  /* ══════════════════════════════════════════════════════════
     API key helpers
  ═══════════════════════════════════════════════════════════ */
  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    localStorage.setItem(LS_API_KEY, trimmed);
    setSavedApiKey(trimmed);
    toast({ title: 'Chiave salvata', description: 'La tua API Key è stata salvata nel browser.' });
  };

  const handleClearApiKey = () => {
    localStorage.removeItem(LS_API_KEY);
    setSavedApiKey('');
    setApiKeyInput('');
    toast({ title: 'Chiave rimossa' });
  };

  const handleModeChange = (mode: ProcessingMode) => {
    setProcessingMode(mode);
    localStorage.setItem(LS_MODE, mode);
  };

  /* ══════════════════════════════════════════════════════════
     File handling
  ═══════════════════════════════════════════════════════════ */
  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      const f = files[0];
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setResultUrl(null);
      setDownloadUrl(null);
      setError(null);
      setOriginalImage(null);
      setImageLoaded(false);
      setCustomFileName(`${f.name.split('.')[0]}-no-bg`);
      setEditMode(false);

      const img = new Image();
      img.src   = URL.createObjectURL(f);
      img.onload = () => { setOriginalImage(img); setImageLoaded(true); };
    } else {
      setFile(null); setPreviewUrl(null); setResultUrl(null); setDownloadUrl(null);
      setError(null); setCustomFileName(''); setOriginalImage(null);
      setEditMode(false); setInitialState(null); setImageLoaded(false);
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.items) return;
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        if (e.clipboardData.items[i].type.startsWith('image')) {
          const blob = e.clipboardData.items[i].getAsFile();
          if (blob) { handleFileSelect([blob]); break; }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const handleDrop     = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files?.length) handleFileSelect(Array.from(e.dataTransfer.files)); };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  /* ══════════════════════════════════════════════════════════
     Keyboard shortcut: Ctrl+Z undo
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && editMode) { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode, history]);

  /* ══════════════════════════════════════════════════════════
     Canvas initialisation
  ═══════════════════════════════════════════════════════════ */
  const initCanvas = useCallback((imgSrc: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img    = new Image();
    img.onload   = () => {
      canvas.width  = originalImage.width;
      canvas.height = originalImage.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistory([]);
    };
    img.src = imgSrc;
  }, [originalImage]);

  useEffect(() => {
    if (editMode && initialState) {
      const t = setTimeout(() => initCanvas(initialState), 50);
      return () => clearTimeout(t);
    }
  }, [editMode, initialState, initCanvas]);

  /* ══════════════════════════════════════════════════════════
     Image processing (resize + dispatch to engine)
  ═══════════════════════════════════════════════════════════ */
  const prepareImageDataUri = async (): Promise<string> => {
    if (!file) throw new Error('Nessun file selezionato.');

    const img        = new Image();
    const objectUrl  = URL.createObjectURL(file);
    await new Promise<void>((res, rej) => {
      img.onload  = () => res();
      img.onerror = () => rej(new Error("Errore nel caricamento dell'immagine."));
      img.src     = objectUrl;
    });

    if (img.width * img.height > 50_000_000) {
      const scale = Math.sqrt(50_000_000 / (img.width * img.height));
      const c     = document.createElement('canvas');
      c.width     = Math.floor(img.width  * scale);
      c.height    = Math.floor(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(objectUrl);
      toast({ title: 'Ottimizzazione', description: "L'immagine è stata ridimensionata per l'elaborazione." });
      return c.toDataURL('image/png');
    }

    URL.revokeObjectURL(objectUrl);
    return new Promise<string>((res, rej) => {
      const reader  = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveBackground = async () => {
    if (!file) return;
    setProcessing(true); setError(null); setProgressStage(''); setProgressValue(0);

    try {
      const imageDataUri = await prepareImageDataUri();
      let processed: string;

      if (processingMode === 'browser') {
        const { removeBackgroundInBrowser } = await import('@/lib/remove-background-browser');
        processed = await removeBackgroundInBrowser(imageDataUri, (stage, value) => {
          setProgressStage(stage);
          setProgressValue(value);
        });
      } else {
        if (!savedApiKey) throw new Error('Inserisci e salva la tua API Key di remove.bg nelle impostazioni.');
        const r = await removeImageBackground({ imageDataUri, apiKey: savedApiKey });
        processed = r.processedImageDataUri;
      }

      setResultUrl(processed);
      setInitialState(processed);
      setEditMode(true);
      setSliderPos(50);
      toast({ title: 'Completato!', description: 'Il background è stato rimosso con successo.' });
    } catch (err: any) {
      const msg = err.message || 'Impossibile rimuovere il background.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Errore', description: msg });
    } finally {
      setProcessing(false); setProgressStage(''); setProgressValue(0);
    }
  };

  const handleManualMode = () => {
    if (!previewUrl) return;
    setResultUrl(previewUrl);
    setInitialState(previewUrl);
    setEditMode(true);
    setTool('erase');
    setSliderPos(50);
  };

  const handleBackToPreview = () => { setEditMode(false); setHistory([]); };

  /* ══════════════════════════════════════════════════════════
     Canvas history helpers
  ═══════════════════════════════════════════════════════════ */
  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) setHistory(prev => [...prev.slice(-10), canvas.toDataURL()]);
  };

  const handleUndo = () => {
    if (!history.length || !canvasRef.current) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const img    = new Image();
    img.src      = prev;
    img.onload   = () => {
      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.drawImage(img, 0, 0);
      setResultUrl(prev);
    };
  };

  const handleResetCanvas = () => {
    if (initialState) { initCanvas(initialState); setHistory([]); setResultUrl(initialState); }
  };

  /* ══════════════════════════════════════════════════════════
     Advanced tools
  ═══════════════════════════════════════════════════════════ */

  /** Smooths the alpha-channel edges with a box blur (radius 3px). */
  const featherEdges = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveHistory();

    const { width, height } = canvas;
    const imageData         = ctx.getImageData(0, 0, width, height);
    const data              = imageData.data;
    const R                 = 3;

    const alphas  = new Float32Array(width * height);
    for (let i = 0; i < alphas.length; i++) alphas[i] = data[i * 4 + 3] / 255;

    const blurred = new Float32Array(alphas.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += alphas[ny * width + nx]; cnt++;
            }
          }
        }
        blurred[y * width + x] = sum / cnt;
      }
    }

    for (let i = 0; i < blurred.length; i++) data[i * 4 + 3] = Math.round(blurred[i] * 255);
    ctx.putImageData(imageData, 0, 0);
    setResultUrl(canvas.toDataURL('image/png'));
    toast({ title: 'Bordi ammorbiditi', description: 'I bordi della maschera sono stati sfumati.' });
  };

  /** Swaps transparent ↔ opaque areas using the original image as source. */
  const invertMask = () => {
    const canvas = canvasRef.current;
    if (!canvas || !originalImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveHistory();

    const { width, height } = canvas;

    // Grab original pixel data
    const origC         = document.createElement('canvas');
    origC.width         = width; origC.height = height;
    const origCtx       = origC.getContext('2d')!;
    origCtx.drawImage(originalImage, 0, 0, width, height);
    const origData      = origCtx.getImageData(0, 0, width, height).data;

    const imageData     = ctx.getImageData(0, 0, width, height);
    const d             = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128) {
        d[i + 3] = 0;
      } else {
        d[i]     = origData[i];
        d[i + 1] = origData[i + 1];
        d[i + 2] = origData[i + 2];
        d[i + 3] = origData[i + 3];
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setResultUrl(canvas.toDataURL('image/png'));
    toast({ title: 'Maschera invertita' });
  };

  /* ══════════════════════════════════════════════════════════
     Canvas drawing
  ═══════════════════════════════════════════════════════════ */
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  /** Update the floating cursor preview circle. */
  const updateCursor = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setBrushDisplayRadius((brushSize / 2) * (rect.width / canvas.width));
  };

  const paint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !canvasRef.current || !originalImage) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let { x, y } = getCanvasPos(e);

    if ((e.ctrlKey || e.metaKey) && startPos.current) {
      const dx = Math.abs(x - startPos.current.x);
      const dy = Math.abs(y - startPos.current.y);
      if (dx > dy) y = startPos.current.y; else x = startPos.current.x;
    }

    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

    if (tool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.clip();
      ctx.drawImage(originalImage, 0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.restore();
    }
  }, [brushSize, tool, originalImage]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    startPos.current     = getCanvasPos(e);
    saveHistory();
    paint(e); // draw the first dot immediately (no stale-state issue with ref)
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) setResultUrl(canvas.toDataURL('image/png'));
  };

  /* ══════════════════════════════════════════════════════════
     Aspect ratio for comparison slider
  ═══════════════════════════════════════════════════════════ */
  const aspectRatio = originalImage
    ? `${originalImage.naturalWidth} / ${originalImage.naturalHeight}`
    : '4 / 3';

  /* ══════════════════════════════════════════════════════════
     Render
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-none shadow-2xl overflow-hidden">

        {/* ─── Header ─────────────────────────────────────────── */}
        <CardHeader className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-sm shadow-inner ring-1 ring-white/30">
                <Eraser className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline tracking-tight">Background Remover</CardTitle>
                <CardDescription className="text-white/75 text-base mt-1">
                  Rimuovi lo sfondo in locale o tramite API — poi perfeziona manualmente.
                </CardDescription>
              </div>
            </div>
            {onBack && (
              <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-6 bg-gradient-to-b from-background to-muted/20">

          {/* ─── Settings panel (hidden in edit mode) ───────────── */}
          {!editMode && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">

              {/* Mode selector */}
              <div className="p-5 border-b bg-muted/20">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Modalità di elaborazione
                </p>
                <div className="inline-flex rounded-xl border bg-background shadow-sm overflow-hidden">
                  {([ ['browser', Cpu, 'Prototipo Browser'], ['api', Key, 'API Remove.bg'] ] as const).map(([m, Icon, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleModeChange(m)}
                      className={cn(
                        'flex items-center gap-2 px-5 py-2.5 text-sm transition-all font-medium',
                        m !== 'browser' && 'border-l',
                        processingMode === m
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode body */}
              <div className="p-5">
                {processingMode === 'browser' ? (
                  /* ── Browser mode info ── */
                  <div className="flex gap-4">
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Elaborazione 100% locale — nessuna chiave richiesta</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Un modello AI (ONNX/u2net) gira direttamente nel tuo browser.
                        La <strong>prima esecuzione</strong> scarica il modello (~40 MB) e lo salva in cache;
                        le elaborazioni successive sono molto più rapide.
                        Le immagini non lasciano mai il dispositivo.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ── API mode ── */
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                        <Key className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">La tua chiave API remove.bg</p>
                        <p className="text-xs text-muted-foreground">
                          Salvata solo nel browser locale — non viene mai inviata ai nostri server.
                        </p>
                      </div>
                    </div>

                    {/* API key input row */}
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          className="pr-10 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(v => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button size="sm" onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} className="shrink-0">
                        Salva
                      </Button>
                      {savedApiKey && (
                        <Button size="sm" variant="ghost" onClick={handleClearApiKey} className="shrink-0 text-destructive hover:text-destructive">
                          Rimuovi
                        </Button>
                      )}
                    </div>

                    {/* Status badge */}
                    {savedApiKey
                      ? <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Chiave API configurata</p>
                      : <p className="text-xs text-amber-600 font-medium">⚠ Nessuna chiave — il pulsante "Rimuovi Automatico" sarà disabilitato.</p>
                    }

                    {/* Tutorial toggle */}
                    <button
                      type="button"
                      onClick={() => setShowApiTutorial(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-teal-600 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showApiTutorial ? 'Nascondi guida' : 'Come ottenere la chiave API?'}
                    </button>

                    {/* Tutorial steps */}
                    {showApiTutorial && (
                      <div className="rounded-xl border bg-muted/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                          Guida rapida — remove.bg
                        </p>
                        {[
                          { n: 1, text: 'Vai su remove.bg e crea un account gratuito.', link: 'https://www.remove.bg' },
                          { n: 2, text: 'Una volta loggato, apri la sezione Dashboard → API Keys nel menu.' },
                          { n: 3, text: 'Clicca "+ New API Key", assegna un nome (es. "FileForge") e conferma.' },
                          { n: 4, text: 'Copia la chiave generata — salvala subito, è mostrata una volta sola.' },
                          { n: 5, text: 'Incollala nel campo qui sopra e clicca Salva. Fatto!' },
                          { n: 6, text: 'Il piano gratuito include 50 crediti/mese. Ogni immagine consuma 1 credito.' },
                        ].map(({ n, text, link }) => (
                          <div key={n} className="flex gap-3 items-start">
                            <div className="shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-[10px] font-bold flex items-center justify-center">
                              {n}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {text}
                              {link && (
                                <a href={link} target="_blank" rel="noopener noreferrer" className="ml-1 text-teal-600 hover:underline inline-flex items-center gap-0.5">
                                  remove.bg <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Error alert ─────────────────────────────────────── */}
          {error && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Errore Elaborazione</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ─── Upload / Preview phase ──────────────────────────── */}
          {!editMode && (
            <div className="space-y-5">
              {!file ? (
                <label
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="group flex h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 hover:border-teal-400/50 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-all duration-200"
                >
                  <div className="p-4 bg-teal-50 dark:bg-teal-950/50 rounded-2xl text-teal-600 group-hover:scale-105 transition-transform">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-foreground">Carica una foto</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Trascina qui, clicca o incolla con CTRL+V</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">JPG · PNG · WEBP</p>
                  </div>
                  <input type="file" accept="image/*" onChange={e => e.target.files && handleFileSelect(Array.from(e.target.files))} className="hidden" />
                </label>
              ) : (
                <div className="flex flex-col items-center gap-5 p-6 border rounded-2xl bg-card shadow-sm">
                  <div className="w-full flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => handleFileSelect([])} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <X className="w-4 h-4 mr-1" /> Rimuovi
                    </Button>
                  </div>

                  <div className="w-full overflow-hidden rounded-xl shadow-md border-4 border-white dark:border-muted flex items-center justify-center max-h-[480px]" style={{ background: '#f1f5f9' }}>
                    <img src={previewUrl!} alt="Anteprima" className="max-w-full max-h-[480px] object-contain" />
                  </div>

                  {/* Progress bar — browser mode only */}
                  {processing && processingMode === 'browser' && (
                    <div className="w-full p-4 rounded-xl border bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-teal-800 dark:text-teal-200">{progressStage || 'Inizializzazione...'}</span>
                        <span className="font-mono tabular-nums text-teal-600">{progressValue}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-teal-100 dark:bg-teal-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                      {progressValue < 20 && (
                        <p className="text-xs text-teal-700 dark:text-teal-300">
                          Prima esecuzione: il modello AI (~40 MB) viene scaricato e salvato in cache.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-1">
                    <Button
                      onClick={handleManualMode}
                      variant="outline"
                      disabled={!imageLoaded || processing}
                      className="h-12 px-8 rounded-xl border-2 gap-2 text-base"
                    >
                      <Brush className="h-5 w-5" />
                      Modifica Manuale
                    </Button>
                    <Button
                      onClick={handleRemoveBackground}
                      disabled={processing || !imageLoaded || (processingMode === 'api' && !savedApiKey)}
                      className="h-12 px-8 rounded-xl gap-2 text-base font-bold bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/30"
                    >
                      {processing
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Elaborazione...</>
                        : <><Sparkles className="h-5 w-5" /> Rimuovi Automatico</>}
                    </Button>
                  </div>

                  {processingMode === 'api' && !savedApiKey && (
                    <p className="text-xs text-amber-600 font-medium text-center">
                      Inserisci e salva la tua API Key nelle impostazioni per usare la modalità Remove.bg.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70 text-center">Suggerimento: incolla un&apos;immagine con CTRL+V</p>
                </div>
              )}
            </div>
          )}

          {/* ─── Canvas editor ───────────────────────────────────── */}
          {editMode && (
            <div className="flex flex-col items-center gap-5 animate-in zoom-in-95 duration-300">

              {/* ── Toolbar row 1: navigation + drawing tools ── */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card rounded-2xl border shadow-sm w-full">

                <Button variant="ghost" size="icon" onClick={handleBackToPreview} title="Torna indietro" className="shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </Button>

                <div className="h-7 w-px bg-border hidden sm:block" />

                {/* Erase / Restore toggle */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border">
                  <Button
                    size="sm"
                    variant={tool === 'erase' ? 'default' : 'ghost'}
                    onClick={() => setTool('erase')}
                    className={cn('gap-2 rounded-lg', tool === 'erase' && 'bg-rose-500 hover:bg-rose-600 text-white')}
                  >
                    <Eraser className="w-4 h-4" /> Cancella
                  </Button>
                  <Button
                    size="sm"
                    variant={tool === 'restore' ? 'default' : 'ghost'}
                    onClick={() => setTool('restore')}
                    className={cn('gap-2 rounded-lg', tool === 'restore' && 'bg-red-500 hover:bg-red-600 text-white')}
                  >
                    <Brush className="w-4 h-4" /> Ripristina
                  </Button>
                </div>

                {/* Brush size */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-xl border min-w-[155px]">
                  <span className="text-xs font-bold text-muted-foreground whitespace-nowrap w-14">
                    {brushSize}px
                  </span>
                  <input
                    type="range" min="5" max="100" value={brushSize}
                    onChange={e => setBrushSize(+e.target.value)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-teal-600"
                  />
                </div>

                <div className="h-7 w-px bg-border hidden sm:block" />

                {/* Undo / Reset */}
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleUndo} disabled={!history.length} title="Annulla (Ctrl+Z)">
                    <Undo2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleResetCanvas} disabled={!history.length} title="Ripristina tutto" className="text-destructive hover:text-destructive">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* ── Toolbar row 2: advanced tools ── */}
              <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 bg-card rounded-2xl border shadow-sm w-full">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:block">
                  Strumenti:
                </span>

                <Button
                  variant="outline" size="sm"
                  onClick={featherEdges}
                  className="gap-1.5 rounded-lg h-8 text-xs"
                  title="Sfuma i bordi del ritaglio per renderli più naturali"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Ammorbidisci bordi
                </Button>

                <Button
                  variant="outline" size="sm"
                  onClick={invertMask}
                  className="gap-1.5 rounded-lg h-8 text-xs"
                  title="Scambia le aree visibili con quelle trasparenti"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Inverti maschera
                </Button>

                {/* Background fill for download */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/40 h-8">
                  <Palette className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">Sfondo download:</span>
                  <input
                    type="color"
                    value={downloadBgColor || '#ffffff'}
                    onChange={e => setDownloadBgColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Colore di sfondo applicato al download"
                  />
                  {downloadBgColor && (
                    <button
                      onClick={() => setDownloadBgColor('')}
                      className="text-muted-foreground hover:text-foreground leading-none text-sm ml-0.5"
                      title="Rimuovi sfondo"
                    >×</button>
                  )}
                </div>
              </div>

              {/* ── Hints ── */}
              <p className="text-xs text-muted-foreground -mt-1 text-center">
                <span className={cn('font-semibold', tool === 'restore' ? 'text-red-500' : 'text-foreground')}>
                  {tool === 'restore' ? '● Modalità Ripristina' : '● Modalità Cancella'}
                </span>
                {' · '}Pennello <span className={cn('inline-block w-2.5 h-2.5 rounded-full border align-middle', tool === 'restore' ? 'bg-red-400/30 border-red-400' : 'bg-white/30 border-white')} />
                {' · '}<strong>CTRL + trascina</strong> per linee rette
              </p>

              {/* ── Canvas with cursor overlay ── */}
              <div
                className="relative w-full rounded-2xl border-4 border-white dark:border-muted shadow-2xl overflow-hidden min-h-[280px] touch-none"
                style={{ ...CHECKER, cursor: 'none' }}
                onMouseLeave={() => { setCursorPos(null); stopDrawing(); }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={e => { updateCursor(e); paint(e); }}
                  onMouseUp={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={paint}
                  onTouchEnd={stopDrawing}
                  className="max-w-full max-h-[600px] object-contain"
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                />

                {/* Floating brush preview */}
                {cursorPos && (
                  <div
                    className="pointer-events-none absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-[width,height] duration-75"
                    style={{
                      left:            cursorPos.x,
                      top:             cursorPos.y,
                      width:           brushDisplayRadius * 2,
                      height:          brushDisplayRadius * 2,
                      border:          tool === 'restore'
                        ? '2px solid rgba(239,68,68,0.9)'
                        : '2px dashed rgba(255,255,255,0.85)',
                      backgroundColor: tool === 'restore'
                        ? 'rgba(239,68,68,0.18)'
                        : 'rgba(255,255,255,0.07)',
                      boxShadow:       tool === 'restore'
                        ? '0 0 0 1.5px rgba(239,68,68,0.25), 0 0 8px rgba(239,68,68,0.15)'
                        : '0 0 0 1px rgba(0,0,0,0.2)',
                    }}
                  />
                )}
              </div>

              {/* ══ Before / After comparison slider ══ */}
              {resultUrl && previewUrl && (
                <div className="w-full space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Confronto Prima / Dopo</p>
                    <p className="text-xs text-muted-foreground">Trascina il cursore per confrontare</p>
                  </div>

                  {/* Slider image */}
                  <div
                    className="relative overflow-hidden rounded-2xl border-4 border-white dark:border-muted shadow-xl select-none"
                    style={{ aspectRatio, maxHeight: 340 }}
                  >
                    {/* DOPO — full-width result with checkered bg for transparency */}
                    <div className="absolute inset-0" style={CHECKER}>
                      <img src={resultUrl} alt="Dopo" className="w-full h-full object-contain" />
                    </div>

                    {/* PRIMA — original, clipped from the right */}
                    <div
                      className="absolute inset-0 transition-none"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <img src={previewUrl} alt="Prima" className="w-full h-full object-contain" />
                    </div>

                    {/* Divider line + handle */}
                    <div
                      className="absolute top-0 bottom-0 z-10 flex items-center"
                      style={{ left: `calc(${sliderPos}% - 1px)` }}
                    >
                      <div className="w-0.5 h-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-[calc(50%-0.5px)] w-9 h-9 bg-white rounded-full shadow-xl ring-1 ring-gray-100 flex items-center justify-center cursor-ew-resize">
                        <GripVertical className="w-4 h-4 text-gray-500" />
                      </div>
                    </div>

                    {/* Labels */}
                    <span className="absolute top-3 left-3 z-10 pointer-events-none bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      PRIMA
                    </span>
                    <span className="absolute top-3 right-3 z-10 pointer-events-none bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      DOPO
                    </span>

                    {/* Invisible range input for mouse drag */}
                    <input
                      type="range" min="0" max="100" value={sliderPos}
                      onChange={e => setSliderPos(+e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                      style={{ margin: 0 }}
                    />
                  </div>

                  {/* Labelled track below */}
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">◀ Dopo</span>
                    <input
                      type="range" min="0" max="100" value={sliderPos}
                      onChange={e => setSliderPos(+e.target.value)}
                      className="flex-1 h-2 rounded-full appearance-none cursor-ew-resize accent-teal-600"
                    />
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Prima ▶</span>
                  </div>
                </div>
              )}

              {/* ── Download section ── */}
              <div className="w-full max-w-md bg-card rounded-2xl border shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-teal-600" />
                  <Label htmlFor="filename" className="font-semibold">Nome file per il download</Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="filename"
                    value={customFileName}
                    onChange={e => setCustomFileName(e.target.value)}
                    placeholder="nome-file"
                    className="flex-1"
                  />
                  <div className="flex items-center px-3 bg-muted rounded-lg text-sm font-medium text-muted-foreground">.png</div>
                </div>
                {downloadBgColor && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border shadow-sm shrink-0" style={{ backgroundColor: downloadBgColor }} />
                    Sfondo colorato incluso nel file scaricato.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <Button
                  variant="outline"
                  onClick={() => { setEditMode(false); setFile(null); setError(null); }}
                  className="h-12 px-8 rounded-xl"
                >
                  Carica un&apos;altra immagine
                </Button>
                <Button
                  className="h-12 px-8 rounded-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25 gap-2"
                  asChild
                >
                  <a href={downloadUrl || '#'} download={`${customFileName || 'fileforge-result'}.png`}>
                    <Download className="h-5 w-5" />
                    Scarica PNG
                  </a>
                </Button>
              </div>

            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
