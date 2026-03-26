"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Barcode, Download, AlertCircle, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BarcodeFormat =
  | "CODE128"
  | "CODE39"
  | "EAN13"
  | "EAN8"
  | "UPC"
  | "ITF14"
  | "MSI"
  | "pharmacode";

interface FormatInfo {
  label: string;
  placeholder: string;
  hint: string;
  maxLen?: number;
  validator?: (v: string) => boolean;
}

const FORMAT_INFO: Record<BarcodeFormat, FormatInfo> = {
  CODE128: {
    label: "Code 128",
    placeholder: "Qualsiasi testo o numero",
    hint: "Supporta caratteri ASCII. Il più versatile.",
  },
  CODE39: {
    label: "Code 39",
    placeholder: "HELLO WORLD",
    hint: "Solo lettere maiuscole, cifre e simboli: - . $ / + % spazio",
    validator: (v) => /^[A-Z0-9\-. $/+%]+$/.test(v),
  },
  EAN13: {
    label: "EAN-13",
    placeholder: "590123412345",
    hint: "Esattamente 12 cifre (il 13° è calcolato automaticamente)",
    maxLen: 12,
    validator: (v) => /^\d{12}$/.test(v),
  },
  EAN8: {
    label: "EAN-8",
    placeholder: "1234567",
    hint: "Esattamente 7 cifre (l'8° è calcolato automaticamente)",
    maxLen: 7,
    validator: (v) => /^\d{7}$/.test(v),
  },
  UPC: {
    label: "UPC-A",
    placeholder: "01234565",
    hint: "Esattamente 11 cifre (il 12° è calcolato automaticamente)",
    maxLen: 11,
    validator: (v) => /^\d{11}$/.test(v),
  },
  ITF14: {
    label: "ITF-14",
    placeholder: "12345678901231",
    hint: "Esattamente 14 cifre (standard GS1 per imballaggi)",
    maxLen: 14,
    validator: (v) => /^\d{14}$/.test(v),
  },
  MSI: {
    label: "MSI / Plessey",
    placeholder: "1234567",
    hint: "Solo cifre. Usato in supermercati per scaffali.",
    validator: (v) => /^\d+$/.test(v),
  },
  pharmacode: {
    label: "Pharmacode",
    placeholder: "1234",
    hint: "Numero intero da 3 a 131070. Usato nel settore farmaceutico.",
    validator: (v) => /^\d+$/.test(v) && parseInt(v) >= 3 && parseInt(v) <= 131070,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface BarcodeGeneratorProps {
  onBack?: () => void;
}

export function BarcodeGenerator({ onBack }: BarcodeGeneratorProps) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  const [format, setFormat]         = useState<BarcodeFormat>("CODE128");
  const [value, setValue]           = useState("FileForge 2024");
  const [lineColor, setLineColor]   = useState("#000000");
  const [bgColor, setBgColor]       = useState("#ffffff");
  const [barWidth, setBarWidth]     = useState(2);
  const [barHeight, setBarHeight]   = useState(100);
  const [showText, setShowText]     = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const info = FORMAT_INFO[format];

  // ── Render barcode to SVG ──────────────────────────────────────────────────

  const renderBarcode = useCallback(() => {
    if (!svgRef.current) return;
    if (!value.trim()) {
      setError("Inserisci un valore per generare il codice a barre.");
      return;
    }

    // Client-side format validation
    if (info.validator && !info.validator(value)) {
      setError(`Valore non valido per ${info.label}. ${info.hint}`);
      return;
    }

    try {
      JsBarcode(svgRef.current, value, {
        format,
        lineColor,
        background: bgColor,
        width: barWidth,
        height: barHeight,
        displayValue: showText,
        fontOptions: "bold",
        fontSize: 14,
        margin: 12,
        valid: (isValid) => {
          if (!isValid) setError(`Valore non valido per il formato ${info.label}.`);
        },
      });
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nella generazione del codice a barre.");
    }
  }, [format, value, lineColor, bgColor, barWidth, barHeight, showText, info]);

  useEffect(() => { renderBarcode(); }, [renderBarcode]);

  // ── Handle format change ──────────────────────────────────────────────────

  const handleFormatChange = (f: BarcodeFormat) => {
    setFormat(f);
    // Reset to placeholder-friendly default value
    const defaults: Record<BarcodeFormat, string> = {
      CODE128:    "FileForge 2024",
      CODE39:     "FILEFORGE",
      EAN13:      "590123412345",
      EAN8:       "1234567",
      UPC:        "01234565890",
      ITF14:      "12345678901231",
      MSI:        "1234567",
      pharmacode: "1234",
    };
    setValue(defaults[f]);
    setError(null);
  };

  // ── Download SVG ──────────────────────────────────────────────────────────

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg || error) return;
    const serializer = new XMLSerializer();
    const svgStr     = serializer.serializeToString(svg);
    const blob       = new Blob([svgStr], { type: "image/svg+xml" });
    const url        = URL.createObjectURL(blob);
    const link       = document.createElement("a");
    link.download    = `barcode-${format.toLowerCase()}.svg`;
    link.href        = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Download PNG ──────────────────────────────────────────────────────────

  const downloadPng = () => {
    const svg = svgRef.current;
    if (!svg || error) return;

    const svgRect    = svg.getBoundingClientRect();
    const svgWidth   = svg.getAttribute("width")  ? parseInt(svg.getAttribute("width")!)  : svgRect.width;
    const svgHeight  = svg.getAttribute("height") ? parseInt(svg.getAttribute("height")!) : svgRect.height;

    const serializer = new XMLSerializer();
    const svgStr     = serializer.serializeToString(svg);
    const svgBlob    = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url        = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas  = document.createElement("canvas");
      canvas.width  = svgWidth  * 2;   // 2× for retina
      canvas.height = svgHeight * 2;
      const ctx     = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link    = document.createElement("a");
      link.download = `barcode-${format.toLowerCase()}.png`;
      link.href     = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = url;
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
        </Button>
      )}

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-600 to-gray-800 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-3">
            <Barcode className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Generatore Codice a Barre</h2>
            <p className="text-sm text-white/80">Crea barcode EAN, UPC, Code 128, Code 39 e altri standard</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left panel — inputs */}
        <div className="space-y-4 rounded-2xl border bg-white/50 dark:bg-card/50 p-6">

          {/* Format selector */}
          <Field label="Formato codice a barre">
            <Select value={format} onValueChange={(v) => handleFormatChange(v as BarcodeFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128 — universale</SelectItem>
                <SelectItem value="CODE39">Code 39 — alfanumerico</SelectItem>
                <SelectItem value="EAN13">EAN-13 — prodotti Europa</SelectItem>
                <SelectItem value="EAN8">EAN-8 — prodotti piccoli</SelectItem>
                <SelectItem value="UPC">UPC-A — prodotti USA</SelectItem>
                <SelectItem value="ITF14">ITF-14 — imballaggi GS1</SelectItem>
                <SelectItem value="MSI">MSI / Plessey — supermercati</SelectItem>
                <SelectItem value="pharmacode">Pharmacode — farmaceutico</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{info.hint}</p>
          </Field>

          {/* Value input */}
          <Field label="Valore">
            <Input
              placeholder={info.placeholder}
              value={value}
              maxLength={info.maxLen ? info.maxLen + 5 : undefined}
              onChange={(e) => {
                let v = e.target.value;
                if (info.maxLen && v.length > info.maxLen) v = v.slice(0, info.maxLen);
                setValue(v);
              }}
            />
          </Field>

          {/* Show text toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={showText}
              onClick={() => setShowText((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showText ? "bg-slate-700" : "bg-muted"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showText ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <Label className="text-sm cursor-pointer" onClick={() => setShowText((v) => !v)}>
              Mostra testo sotto il barcode
            </Label>
          </div>

          {/* Advanced options */}
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Opzioni avanzate
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4">

              {/* Bar width */}
              <Field label={`Larghezza barre: ${barWidth}px`}>
                <Slider min={1} max={6} step={0.5} value={[barWidth]} onValueChange={([v]) => setBarWidth(v)} />
              </Field>

              {/* Bar height */}
              <Field label={`Altezza barre: ${barHeight}px`}>
                <Slider min={30} max={300} step={10} value={[barHeight]} onValueChange={([v]) => setBarHeight(v)} />
              </Field>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Colore barre">
                  <div className="flex items-center gap-2">
                    <input type="color" value={lineColor} onChange={(e) => setLineColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                    <Input value={lineColor} onChange={(e) => setLineColor(e.target.value)} className="font-mono text-xs" />
                  </div>
                </Field>
                <Field label="Sfondo">
                  <div className="flex items-center gap-2">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                    <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="font-mono text-xs" />
                  </div>
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — preview */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-white/50 dark:bg-card/50 p-6">
          <span className="text-sm font-semibold text-muted-foreground">Anteprima</span>

          {error ? (
            <div className="flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed border-muted-foreground/30 text-center p-4">
              <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto flex justify-center rounded-xl border bg-white p-4 shadow-sm">
              <svg ref={svgRef} />
            </div>
          )}

          {/* Format badge */}
          {!error && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {FORMAT_INFO[format].label}
              </span>
              <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{value}</span>
            </div>
          )}

          {/* Download buttons */}
          <div className="flex gap-2 mt-auto">
            <Button
              onClick={downloadPng}
              disabled={!!error}
              className="bg-gradient-to-br from-slate-600 to-gray-800 hover:from-slate-700 hover:to-gray-900 text-white"
            >
              <Download className="h-4 w-4 mr-2" /> PNG
            </Button>
            <Button variant="outline" onClick={downloadSvg} disabled={!!error}>
              <Download className="h-4 w-4 mr-2" /> SVG
            </Button>
          </div>

          {/* Usage tip */}
          <p className="text-xs text-muted-foreground text-center">
            Il PNG viene esportato a doppia risoluzione per la stampa.
          </p>
        </div>
      </div>

      {/* Hidden canvas for PNG export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}
