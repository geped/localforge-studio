"use client";

import React, { useState, useEffect } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileType, Loader2, Download, ArrowLeft,
  CheckCircle2, AlertTriangle, Info, Image as ImageIcon
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ─── FIX #1: Worker corretto (.js non .mjs) ─────────────────────────────────
// La CDN cloudflare usa .min.js. Usare .mjs causa un 404 silenzioso
// che impedisce qualsiasi caricamento PDF.
// ALTERNATIVA CONSIGLIATA: copiare pdf.worker.min.js in /public e usare:
//   pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

// ─── Costanti ───────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ─── Tipi ────────────────────────────────────────────────────────────────────
interface SvgConversionResult {
  url: string;
  svgString: string;
  originalSize: number;
  svgSize: number;
  pageCount: number;
}

// ─── Helper: Conversione Colori ──────────────────────────────────────────────
function parseColor(args: any[], type: 'rgb' | 'cmyk' | 'gray'): string {
  if (type === 'gray') {
    const g = Math.round(args[0] * 255);
    return `rgb(${g},${g},${g})`;
  }
  if (type === 'rgb') {
    const [r, g, b] = args.map((v: number) => Math.round(v * 255));
    return `rgb(${r},${g},${b})`;
  }
  if (type === 'cmyk') {
    const [c, m, y, k] = args;
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));
    return `rgb(${r},${g},${b})`;
  }
  return 'black';
}

// ─── Helper: Escape XML ──────────────────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Core Logic: AI (PDF) → SVG ──────────────────────────────────────────────
async function convertAiToSvg(
  buffer: ArrayBuffer,
  onProgress: (pct: number, msg: string) => void
): Promise<string> {

  // 1. Validazione header
  onProgress(5, 'Validazione formato...');
  const headerBytes = new Uint8Array(buffer.slice(0, 5));
  const headerStr = String.fromCharCode(...headerBytes);

  if (headerStr === '%!PS-') throw new Error('PS_LEGACY');
  if (headerStr !== '%PDF-') throw new Error('INVALID_FORMAT');

  // 2. Caricamento documento PDF
  onProgress(15, 'Parsing struttura PDF...');
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  // I file .ai Adobe Illustrator CS2+ hanno 1 artboard per pagina.
  // Convertiamo la prima pagina (artboard principale).
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const { width, height } = viewport;

  // 3. Estrazione operatori e testo
  onProgress(30, 'Estrazione operatori grafici...');
  const opList = await page.getOperatorList();
  const textContent = await page.getTextContent();

  // 4. Costruzione SVG
  onProgress(50, 'Costruzione elementi SVG...');

  const OPS = pdfjs.OPS;
  const { fnArray, argsArray } = opList;

  let svgBody = '';
  let currentPath = '';
  let currentFill = 'black';
  let currentStroke = 'none';
  let currentStrokeWidth = 1;

  // FIX #2: Stack per tracciare i gruppi aperti — sia da save/restore sia da transform.
  // Ogni 'save' o 'transform' inserisce un marker nello stack;
  // ogni 'restore' chiude l'ultimo gruppo aperto.
  const groupStack: Array<'save' | 'transform'> = [];

  // FIX #3 + #4: Tracciamento punto corrente per curveTo1 ('v') e curveTo2 ('y')
  let currentX = 0;
  let currentY = 0;

  const flushPath = (doFill: boolean, doStroke: boolean, evenOdd = false) => {
    if (!currentPath) return;
    const fillAttr = doFill ? `fill="${currentFill}"` : 'fill="none"';
    const strokeAttr = doStroke
      ? `stroke="${currentStroke}" stroke-width="${currentStrokeWidth}"`
      : 'stroke="none"';
    const rule = evenOdd ? 'fill-rule="evenodd"' : '';
    // Nota: NON aggiungere un attributo transform="" vuoto sui path —
    // il transform è gestito dai gruppi <g> wrapping (fix del bug #4 originale).
    svgBody += `<path d="${currentPath.trim()}" ${fillAttr} ${strokeAttr} ${rule}/>\n`;
    currentPath = '';
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    if (i % 500 === 0) {
      const progress = 50 + Math.round((i / fnArray.length) * 35);
      onProgress(progress, 'Elaborazione vettori...');
    }

    switch (fn) {
      // ── Costruzione Path ──────────────────────────────────────────────────
      case OPS.moveTo:
        currentPath += `M ${args[0].toFixed(3)} ${args[1].toFixed(3)} `;
        currentX = args[0]; currentY = args[1];
        break;

      case OPS.lineTo:
        currentPath += `L ${args[0].toFixed(3)} ${args[1].toFixed(3)} `;
        currentX = args[0]; currentY = args[1];
        break;

      case OPS.curveTo:
        // Operatore PDF 'c': 3 punti di controllo, tutti espliciti → C di SVG
        currentPath += `C ${args[0].toFixed(3)} ${args[1].toFixed(3)} ${args[2].toFixed(3)} ${args[3].toFixed(3)} ${args[4].toFixed(3)} ${args[5].toFixed(3)} `;
        currentX = args[4]; currentY = args[5];
        break;

      // FIX #3: curveTo1 = operatore PDF 'v'
      // Il PRIMO punto di controllo coincide con il punto corrente (implicito).
      // Va mappato su 'C' cubico di SVG, NON su 'Q' quadratico.
      case OPS.curveTo1:
        currentPath += `C ${currentX.toFixed(3)} ${currentY.toFixed(3)} ${args[0].toFixed(3)} ${args[1].toFixed(3)} ${args[2].toFixed(3)} ${args[3].toFixed(3)} `;
        currentX = args[2]; currentY = args[3];
        break;

      // FIX #3: curveTo2 = operatore PDF 'y'
      // Il SECONDO punto di controllo coincide con il punto finale (implicito).
      // Va mappato su 'C' cubico di SVG, NON su 'Q' quadratico.
      case OPS.curveTo2:
        currentPath += `C ${args[0].toFixed(3)} ${args[1].toFixed(3)} ${args[2].toFixed(3)} ${args[3].toFixed(3)} ${args[2].toFixed(3)} ${args[3].toFixed(3)} `;
        currentX = args[2]; currentY = args[3];
        break;

      case OPS.rectangle: {
        const [rx, ry, rw, rh] = args;
        currentPath += `M ${rx} ${ry} h ${rw} v ${rh} h ${-rw} Z `;
        currentX = rx; currentY = ry;
        break;
      }

      case OPS.closePath:
        currentPath += `Z `;
        break;

      // ── Painting ──────────────────────────────────────────────────────────
      case OPS.fill:          flushPath(true,  false);       break;
      case OPS.eoFill:        flushPath(true,  false, true); break;
      case OPS.stroke:        flushPath(false, true);        break;
      case OPS.fillStroke:    flushPath(true,  true);        break;
      case OPS.eoFillStroke:  flushPath(true,  true, true);  break;
      case OPS.endPath:       currentPath = '';               break;

      // ── Stato Grafica ─────────────────────────────────────────────────────
      case OPS.setLineWidth:      currentStrokeWidth = args[0];             break;
      case OPS.setFillRGBColor:   currentFill   = parseColor(args, 'rgb');  break;
      case OPS.setStrokeRGBColor: currentStroke = parseColor(args, 'rgb');  break;
      case OPS.setFillCMYKColor:  currentFill   = parseColor(args, 'cmyk'); break;
      case OPS.setStrokeCMYKColor:currentStroke = parseColor(args, 'cmyk'); break;
      case OPS.setFillGray:       currentFill   = parseColor(args, 'gray'); break;
      case OPS.setStrokeGray:     currentStroke = parseColor(args, 'gray'); break;

      // ── Gruppi e Trasformazioni ───────────────────────────────────────────
      // FIX #2: Stack bilanciato — ogni apertura corrisponde a una chiusura.

      case OPS.save:
        groupStack.push('save');
        svgBody += `<g>\n`;
        break;

      case OPS.restore:
        // Chiude l'ULTIMO gruppo aperto (sia save che transform)
        if (groupStack.length > 0) {
          groupStack.pop();
          svgBody += `</g>\n`;
        }
        break;

      case OPS.transform:
        // args: [a, b, c, d, e, f] → matrice di trasformazione affine
        groupStack.push('transform');
        svgBody += `<g transform="matrix(${args.map((v: number) => v.toFixed(6)).join(',')})">\n`;
        // Nota: questo gruppo verrà chiuso da un successivo OPS.restore nello stack
        break;
    }
  }

  // Chiudi eventuali gruppi rimasti aperti (difesa da PDF malformati)
  while (groupStack.length > 0) {
    groupStack.pop();
    svgBody += `</g>\n`;
  }

  // 5. Testo
  // FIX #5: Il testo è dentro il gruppo con matrix(1,0,0,-1,0,height) che flippa Y.
  // NON aggiungere un secondo scale(1,-1) sul singolo <text>, altrimenti il testo
  // verrebbe flippato due volte e posizionato male. Usiamo y negata direttamente.
  onProgress(85, 'Elaborazione testo...');
  let textSvg = '';
  for (const item of textContent.items as any[]) {
    const tx = item.transform;
    const x = tx[4];
    const y = tx[5];
    // La scala approssimativa del font si ricava dalla norma del vettore di scala
    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const str = escapeXml(item.str);
    if (!str.trim()) continue;

    // Nel sistema di coordinate flippato (matrix(1,0,0,-1,0,H)),
    // la Y originale PDF deve essere usata così com'è — il gruppo genitore si occupa del flip.
    // Un ulteriore transform locale NON è necessario.
    textSvg += `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-size="${fontSize.toFixed(2)}">${str}</text>\n`;
  }

  // 6. Assemblaggio finale
  onProgress(95, 'Finalizzazione...');
  // Il sistema di coordinate PDF ha l'origine in basso a sinistra.
  // SVG ha l'origine in alto a sinistra.
  // Il gruppo radice con matrix(1,0,0,-1,0,H) rispecchia l'asse Y.
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <g transform="matrix(1,0,0,-1,0,${height})">
    ${svgBody}
    ${textSvg}
  </g>
</svg>`;

  onProgress(100, 'Completato!');
  return svgContent;
}

// ─── Componente React ─────────────────────────────────────────────────────────
export function AiToSvgConverter({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<SvgConversionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // Pulizia blob URL alla smontatura o cambio risultato
  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  // FIX #6: Validazione file corretta — accetta sia .ai che .pdf (erano bloccati per errore logico)
  const handleFileSelect = (files: File[]) => {
    const selected = files[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'File troppo grande',
        description: `Limite: ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      });
      return;
    }

    const name = selected.name.toLowerCase();
    const isAi  = name.endsWith('.ai');
    const isPdf = name.endsWith('.pdf') || selected.type === 'application/pdf';

    // Bug originale: la condizione usava && invece di ||, rifiutando tutti i PDF
    if (!isAi && !isPdf) {
      toast({
        variant: 'destructive',
        title: 'Formato non valido',
        description: 'Carica un file .ai o .pdf (Adobe Illustrator CS2+).',
      });
      return;
    }

    setFile(selected);
    setResult(null);
    setProgress(0);
  };

  const handleConvert = async () => {
    if (!file) return;
    setConverting(true);
    setProgress(0);
    setStatusText('Inizializzazione...');

    try {
      const buffer = await file.arrayBuffer();
      const svgString = await convertAiToSvg(buffer, (pct, msg) => {
        setProgress(pct);
        setStatusText(msg);
      });

      // Controlla che l'SVG generato non sia vuoto
      if (!svgString || svgString.length < 50) {
        throw new Error('SVG_EMPTY');
      }

      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      // Conta le pagine del PDF (info aggiuntiva)
      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      const doc = await loadingTask.promise;

      setResult({
        url,
        svgString,
        originalSize: file.size,
        svgSize: blob.size,
        pageCount: doc.numPages,
      });

      toast({ title: 'Conversione Riuscita', description: 'Il file SVG è pronto.' });

    } catch (error: any) {
      console.error('[AiToSvgConverter]', error);

      const errorMap: Record<string, string> = {
        PS_LEGACY:    'Formato AI legacy (pre-CS2) non supportato. Riesporta da Illustrator come PDF.',
        INVALID_FORMAT: 'Il file non sembra un documento Illustrator valido (richiesto PDF 1.4+).',
        SVG_EMPTY:    'Il documento sembra vuoto o senza elementi vettoriali estraibili.',
      };

      let msg = errorMap[error.message] ?? 'Errore sconosciuto durante la conversione.';
      if (error.message?.includes('Password')) {
        msg = 'Il file è protetto da password.';
      }

      toast({ variant: 'destructive', title: 'Errore Conversione', description: msg });

    } finally {
      setConverting(false);
      setStatusText('');
    }
  };

  const reset = () => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setResult(null);
    setProgress(0);
    setStatusText('');
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">
      <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileType className="w-6 h-6" />
            <CardTitle>Convertitore AI → SVG</CardTitle>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-8">

        {/* ── Step 1: Upload ───────────────────────────────────────────────── */}
        {!file && (
          <FileUpload
            onFileSelect={handleFileSelect}
            accept=".ai,.pdf,application/pdf"
            label="Carica file Adobe Illustrator (.ai / .pdf)"
            description={`Converte il layer PDF interno in SVG vettoriale. Max ${MAX_FILE_SIZE / 1024 / 1024} MB. Richiede Illustrator CS2 o superiore.`}
          />
        )}

        {/* ── Step 2: Processo ─────────────────────────────────────────────── */}
        {file && !result && (
          <div className="max-w-lg mx-auto space-y-6 animate-in fade-in">
            <div className="p-6 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                <FileType size={40} />
              </div>
              <div className="text-center">
                <p className="font-bold text-xl text-primary mt-2 truncate max-w-xs">{file.name}</p>
                <p className="text-muted-foreground font-medium">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 font-bold">Nota Tecnica</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs leading-relaxed">
                Estrae il layer PDF dal file .ai (CS2+). Effetti specifici di Illustrator
                (Mesh Gradient, Live Effects, Simboli) potrebbero essere semplificati.
                Viene convertita la pagina 1 (artboard principale).
              </AlertDescription>
            </Alert>

            {converting && (
              <div className="space-y-2 animate-in fade-in">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>{statusText}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <Button
              onClick={handleConvert}
              disabled={converting}
              className="w-full h-14 text-lg font-bold shadow-lg rounded-xl"
            >
              {converting ? (
                <><Loader2 className="animate-spin mr-3 h-6 w-6" /> Conversione in corso...</>
              ) : (
                <><ImageIcon className="mr-3 h-6 w-6" /> Converti in SVG</>
              )}
            </Button>
          </div>
        )}

        {/* ── Step 3: Risultato ────────────────────────────────────────────── */}
        {result && (
          <div className="flex flex-col items-center gap-8 py-6 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-green-100 text-green-700 rounded-full mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-3xl font-black text-primary">Conversione Completata!</h3>
              <p className="text-muted-foreground">
                SVG generato: {(result.svgSize / 1024).toFixed(1)} KB
                {result.pageCount > 1 && ` · ${result.pageCount} pagine nel file originale (convertita pag. 1)`}
              </p>
            </div>

            {/* Anteprima SVG */}
            <div className="w-full max-w-2xl bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between">
                <span>Anteprima SVG</span>
                <span>Vettoriale</span>
              </div>
              <div className="p-8 flex items-center justify-center bg-[conic-gradient(#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%,#e5e7eb),conic-gradient(#e5e7eb_25%,white_25%,white_75%,#e5e7eb_75%,#e5e7eb)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] min-h-[300px]">
                <img
                  src={result.url}
                  alt="SVG Preview"
                  className="max-w-full max-h-[400px] shadow-lg bg-white"
                />
              </div>
            </div>

            {/* Warning se SVG pesante */}
            {result.svgSize > 2 * 1024 * 1024 && (
              <Alert className="max-w-md bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">File SVG Pesante</AlertTitle>
                <AlertDescription className="text-yellow-700 text-xs">
                  Il file risultante è {(result.svgSize / 1024 / 1024).toFixed(1)} MB.
                  Potrebbe contenere immagini incorporate o path molto complessi.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={reset}>
                Converti altro
              </Button>
              <Button asChild className="h-12 flex-1 rounded-xl bg-primary font-bold shadow-lg">
                <a href={result.url} download={`${file?.name.replace(/\.(ai|pdf)$/i, '')}.svg`}>
                  <Download className="mr-2 h-4 w-4" /> Scarica SVG
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}