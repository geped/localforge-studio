"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { QrCode, Download, RefreshCw, ChevronDown, ChevronUp, Upload, X, ArrowLeft } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QrType = "url" | "text" | "email" | "phone" | "sms" | "wifi" | "vcard" | "geo";
type EcLevel = "L" | "M" | "Q" | "H";

// ─── Preset icons ─────────────────────────────────────────────────────────────

interface PresetIcon {
  id: string;
  label: string;
  emoji: string;
  /** Returns an SVG string with the requested stroke color */
  makeSvg: (color: string) => string;
}

// Small helper: stroke-only SVG (Lucide-style)
const s = (paths: string, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

// Small helper: filled SVG
const f = (paths: string, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${paths.replace(/FILL/g, color)}</svg>`;

const PRESET_ICONS: PresetIcon[] = [
  {
    id: "link",
    label: "Link",
    emoji: "🔗",
    makeSvg: (c) => s(
      `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
       <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`, c),
  },
  {
    id: "globe",
    label: "Globe",
    emoji: "🌐",
    makeSvg: (c) => s(
      `<circle cx="12" cy="12" r="10"/>
       <line x1="2" y1="12" x2="22" y2="12"/>
       <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`, c),
  },
  {
    id: "wifi",
    label: "Wi-Fi",
    emoji: "📶",
    makeSvg: (c) => s(
      `<path d="M5 12.55a11 11 0 0 1 14.08 0"/>
       <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
       <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
       <line x1="12" y1="20" x2="12.01" y2="20"/>`, c),
  },
  {
    id: "mail",
    label: "Email",
    emoji: "✉️",
    makeSvg: (c) => s(
      `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
       <polyline points="22,6 12,13 2,6"/>`, c),
  },
  {
    id: "phone",
    label: "Telefono",
    emoji: "📞",
    makeSvg: (c) => s(
      `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.87 12 19.79 19.79 0 0 1 1.8 3.36 2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>`, c),
  },
  {
    id: "message",
    label: "SMS",
    emoji: "💬",
    makeSvg: (c) => s(
      `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`, c),
  },
  {
    id: "user",
    label: "Contatto",
    emoji: "👤",
    makeSvg: (c) => s(
      `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
       <circle cx="12" cy="7" r="4"/>`, c),
  },
  {
    id: "mappin",
    label: "Posizione",
    emoji: "📍",
    makeSvg: (c) => s(
      `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
       <circle cx="12" cy="10" r="3"/>`, c),
  },
  {
    id: "star",
    label: "Stella",
    emoji: "⭐",
    makeSvg: (c) => f(
      `<polygon fill="FILL" points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>`, c),
  },
  {
    id: "heart",
    label: "Cuore",
    emoji: "❤️",
    makeSvg: (c) => f(
      `<path fill="FILL" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`, c),
  },
  {
    id: "shield",
    label: "Sicurezza",
    emoji: "🛡️",
    makeSvg: (c) => s(
      `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`, c),
  },
  {
    id: "zap",
    label: "Flash",
    emoji: "⚡",
    makeSvg: (c) => f(
      `<polygon fill="FILL" points="13,2 3,14 12,14 11,22 21,10 12,10"/>`, c),
  },
];

// ─── QR string builder ────────────────────────────────────────────────────────

function buildQrString(type: QrType, fields: Record<string, string>): string {
  switch (type) {
    case "url":   return fields.url || "";
    case "text":  return fields.text || "";
    case "email": {
      const p: string[] = [];
      if (fields.subject) p.push(`subject=${encodeURIComponent(fields.subject)}`);
      if (fields.body)    p.push(`body=${encodeURIComponent(fields.body)}`);
      return `mailto:${fields.to || ""}${p.length ? "?" + p.join("&") : ""}`;
    }
    case "phone": return `tel:${fields.phone || ""}`;
    case "sms":   return `smsto:${fields.to || ""}${fields.body ? ":" + fields.body : ""}`;
    case "wifi":  return `WIFI:T:${fields.encryption || "WPA"};S:${fields.ssid || ""};P:${fields.password || ""};H:${fields.hidden === "true" ? "true" : "false"};;`;
    case "vcard":
      return ["BEGIN:VCARD","VERSION:3.0",
        `FN:${fields.name || ""}`,`ORG:${fields.org || ""}`,
        `TEL:${fields.phone || ""}`,`EMAIL:${fields.email || ""}`,
        `URL:${fields.url || ""}`,`ADR:;;${fields.address || ""};;;;`,
        "END:VCARD"].join("\n");
    case "geo":
      return fields.query
        ? `geo:0,0?q=${encodeURIComponent(fields.query)}`
        : `geo:${fields.lat || "0"},${fields.lng || "0"}`;
    default: return "";
  }
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface QrCodeGeneratorProps {
  onBack?: () => void;
}

export function QrCodeGenerator({ onBack }: QrCodeGeneratorProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const uploadRef   = useRef<HTMLInputElement>(null);
  const uploadId    = useId();

  // QR options
  const [qrType, setQrType]   = useState<QrType>("url");
  const [fields, setFields]   = useState<Record<string, string>>({ url: "https://example.com" });
  const [ecLevel, setEcLevel] = useState<EcLevel>("M");
  const [size, setSize]       = useState(300);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [margin, setMargin]   = useState(2);

  // Center icon options
  const [selectedIconId,   setSelectedIconId]   = useState<string>("none");
  const [customIconUrl,    setCustomIconUrl]     = useState<string | null>(null);
  const [iconColor,        setIconColor]         = useState("#000000");
  const [iconBgColor,      setIconBgColor]       = useState("#ffffff");
  const [iconSizePct,      setIconSizePct]       = useState(22);
  const [iconRadius,       setIconRadius]        = useState(12);
  const [iconPadding,      setIconPadding]       = useState(8);

  // UI state
  const [qrData,        setQrData]        = useState("");
  const [error,         setError]         = useState<string | null>(null);
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [showIconPanel, setShowIconPanel] = useState(false);

  const hasIcon = selectedIconId !== "none";

  // ── Compositing ──────────────────────────────────────────────────────────

  const overlayIcon = useCallback(async (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const iconPx = Math.round(canvas.width * (iconSizePct / 100));
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const x  = cx - iconPx / 2;
    const y  = cy - iconPx / 2;
    const pad = iconPadding;

    // Background
    ctx.fillStyle = iconBgColor;
    roundRectPath(ctx, x - pad, y - pad, iconPx + pad * 2, iconPx + pad * 2, iconRadius);
    ctx.fill();

    // Shadow ring
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Icon image
    let imgSrc: string | null = null;

    if (selectedIconId === "custom" && customIconUrl) {
      imgSrc = customIconUrl;
    } else {
      const preset = PRESET_ICONS.find((p) => p.id === selectedIconId);
      if (!preset) return;
      const svgStr = preset.makeSvg(iconColor);
      const blob   = new Blob([svgStr], { type: "image/svg+xml" });
      imgSrc       = URL.createObjectURL(blob);
    }

    try {
      const img = await loadImage(imgSrc);
      ctx.drawImage(img, x, y, iconPx, iconPx);
    } finally {
      if (selectedIconId !== "custom") URL.revokeObjectURL(imgSrc!);
    }
  }, [selectedIconId, customIconUrl, iconColor, iconBgColor, iconSizePct, iconRadius, iconPadding]);

  // ── Render ────────────────────────────────────────────────────────────────

  const renderQr = useCallback(async () => {
    const raw = buildQrString(qrType, fields);
    setQrData(raw);
    if (!raw.trim()) {
      setError("Inserisci i dati per generare il QR Code.");
      return;
    }
    if (!canvasRef.current) return;

    // Auto-upgrade EC when icon covers center
    const effectiveEc: EcLevel =
      hasIcon && (ecLevel === "L" || ecLevel === "M") ? "Q" : ecLevel;

    try {
      await QRCode.toCanvas(canvasRef.current, raw, {
        width: size,
        margin,
        errorCorrectionLevel: effectiveEc,
        color: { dark: fgColor, light: bgColor },
      });
      if (hasIcon) await overlayIcon(canvasRef.current);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore nella generazione del QR Code.");
    }
  }, [qrType, fields, ecLevel, size, fgColor, bgColor, margin, hasIcon, overlayIcon]);

  useEffect(() => { renderQr(); }, [renderQr]);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const setField = (key: string, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleTypeChange = (newType: QrType) => {
    setQrType(newType);
    const defaults: Record<QrType, Record<string, string>> = {
      url:   { url: "https://example.com" },
      text:  { text: "" },
      email: { to: "", subject: "", body: "" },
      phone: { phone: "" },
      sms:   { to: "", body: "" },
      wifi:  { ssid: "", password: "", encryption: "WPA", hidden: "false" },
      vcard: { name: "", org: "", phone: "", email: "", url: "", address: "" },
      geo:   { lat: "", lng: "", query: "" },
    };
    setFields(defaults[newType] ?? {});
  };

  // ── Custom icon upload ────────────────────────────────────────────────────

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomIconUrl(reader.result as string);
      setSelectedIconId("custom");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const clearCustomIcon = () => {
    setCustomIconUrl(null);
    if (selectedIconId === "custom") setSelectedIconId("none");
  };

  // ── Download helpers ──────────────────────────────────────────────────────

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "qrcode.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadSvg = async () => {
    if (hasIcon) { downloadPng(); return; } // SVG doesn't support overlay; fall back to PNG
    const raw = buildQrString(qrType, fields);
    if (!raw.trim()) return;
    try {
      const svgStr = await QRCode.toString(raw, {
        type: "svg",
        margin,
        errorCorrectionLevel: ecLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "qrcode.svg";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  // ── Field panels ──────────────────────────────────────────────────────────

  const renderFields = () => {
    switch (qrType) {
      case "url":
        return <Field label="URL"><Input placeholder="https://example.com" value={fields.url ?? ""} onChange={(e) => setField("url", e.target.value)} /></Field>;
      case "text":
        return (
          <Field label="Testo libero">
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Inserisci il tuo testo..." value={fields.text ?? ""} onChange={(e) => setField("text", e.target.value)} />
          </Field>
        );
      case "email":
        return (<>
          <Field label="Indirizzo email"><Input type="email" placeholder="destinatario@email.com" value={fields.to ?? ""} onChange={(e) => setField("to", e.target.value)} /></Field>
          <Field label="Oggetto (opzionale)"><Input placeholder="Oggetto email" value={fields.subject ?? ""} onChange={(e) => setField("subject", e.target.value)} /></Field>
          <Field label="Messaggio (opzionale)">
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Corpo del messaggio" value={fields.body ?? ""} onChange={(e) => setField("body", e.target.value)} />
          </Field>
        </>);
      case "phone":
        return <Field label="Numero di telefono"><Input type="tel" placeholder="+39 333 1234567" value={fields.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} /></Field>;
      case "sms":
        return (<>
          <Field label="Numero di telefono"><Input type="tel" placeholder="+39 333 1234567" value={fields.to ?? ""} onChange={(e) => setField("to", e.target.value)} /></Field>
          <Field label="Messaggio (opzionale)">
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Testo SMS" value={fields.body ?? ""} onChange={(e) => setField("body", e.target.value)} />
          </Field>
        </>);
      case "wifi":
        return (<>
          <Field label="Nome rete (SSID)"><Input placeholder="Nome Wi-Fi" value={fields.ssid ?? ""} onChange={(e) => setField("ssid", e.target.value)} /></Field>
          <Field label="Password"><Input type="password" placeholder="Password Wi-Fi" value={fields.password ?? ""} onChange={(e) => setField("password", e.target.value)} /></Field>
          <Field label="Tipo sicurezza">
            <Select value={fields.encryption ?? "WPA"} onValueChange={(v) => setField("encryption", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="WPA">WPA / WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">Nessuna (aperta)</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Rete nascosta">
            <Select value={fields.hidden ?? "false"} onValueChange={(v) => setField("hidden", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="false">No</SelectItem><SelectItem value="true">Sì</SelectItem></SelectContent>
            </Select>
          </Field>
        </>);
      case "vcard":
        return (<>
          <Field label="Nome completo"><Input placeholder="Mario Rossi" value={fields.name ?? ""} onChange={(e) => setField("name", e.target.value)} /></Field>
          <Field label="Azienda"><Input placeholder="Acme S.r.l." value={fields.org ?? ""} onChange={(e) => setField("org", e.target.value)} /></Field>
          <Field label="Telefono"><Input type="tel" placeholder="+39 333 1234567" value={fields.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" placeholder="mario@esempio.it" value={fields.email ?? ""} onChange={(e) => setField("email", e.target.value)} /></Field>
          <Field label="Sito web"><Input placeholder="https://esempio.it" value={fields.url ?? ""} onChange={(e) => setField("url", e.target.value)} /></Field>
          <Field label="Indirizzo"><Input placeholder="Via Roma 1, Milano" value={fields.address ?? ""} onChange={(e) => setField("address", e.target.value)} /></Field>
        </>);
      case "geo":
        return (<>
          <Field label="Ricerca luogo (opzionale)"><Input placeholder="Torre Eiffel, Parigi" value={fields.query ?? ""} onChange={(e) => setField("query", e.target.value)} /></Field>
          <p className="text-xs text-muted-foreground -mt-2">Oppure inserisci coordinate precise:</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitudine"><Input placeholder="41.9028" value={fields.lat ?? ""} onChange={(e) => setField("lat", e.target.value)} /></Field>
            <Field label="Longitudine"><Input placeholder="12.4964" value={fields.lng ?? ""} onChange={(e) => setField("lng", e.target.value)} /></Field>
          </div>
        </>);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
        </Button>
      )}

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-3">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Generatore QR Code</h2>
            <p className="text-sm text-white/80">Crea QR code per URL, testo, Wi-Fi, contatti e altro</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: inputs ── */}
        <div className="space-y-4 rounded-2xl border bg-white/50 dark:bg-card/50 p-6">

          <Field label="Tipo di contenuto">
            <Select value={qrType} onValueChange={(v) => handleTypeChange(v as QrType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="url">🔗 URL / Link</SelectItem>
                <SelectItem value="text">📝 Testo libero</SelectItem>
                <SelectItem value="email">✉️ Email</SelectItem>
                <SelectItem value="phone">📞 Telefono</SelectItem>
                <SelectItem value="sms">💬 SMS</SelectItem>
                <SelectItem value="wifi">📶 Wi-Fi</SelectItem>
                <SelectItem value="vcard">👤 Contatto (vCard)</SelectItem>
                <SelectItem value="geo">📍 Posizione GPS</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {renderFields()}

          {/* ── Icon panel toggle ── */}
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 transition-colors"
            onClick={() => setShowIconPanel((v) => !v)}
          >
            {showIconPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {hasIcon ? "✓ Icona al centro attiva" : "Aggiungi icona al centro"}
          </button>

          {showIconPanel && (
            <div className="space-y-4 rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4">

              {/* Preset grid */}
              <Field label="Icona predefinita">
                <div className="grid grid-cols-7 gap-1.5">
                  {/* None option */}
                  <button
                    type="button"
                    title="Nessuna icona"
                    onClick={() => setSelectedIconId("none")}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center text-lg transition-all ${selectedIconId === "none" ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40 scale-110 shadow-md" : "border-transparent bg-white dark:bg-card hover:border-violet-300"}`}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {PRESET_ICONS.map((icon) => (
                    <button
                      key={icon.id}
                      type="button"
                      title={icon.label}
                      onClick={() => setSelectedIconId(icon.id)}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center text-lg transition-all ${selectedIconId === icon.id ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40 scale-110 shadow-md" : "border-transparent bg-white dark:bg-card hover:border-violet-300"}`}
                    >
                      {icon.emoji}
                    </button>
                  ))}

                  {/* Upload button */}
                  <button
                    type="button"
                    title="Carica immagine personalizzata"
                    onClick={() => uploadRef.current?.click()}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center text-base transition-all ${selectedIconId === "custom" ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40 scale-110 shadow-md" : "border-dashed border-violet-300 bg-white dark:bg-card hover:border-violet-500"}`}
                  >
                    {customIconUrl && selectedIconId === "custom"
                      ? <img src={customIconUrl} className="w-6 h-6 rounded object-cover" alt="custom" />
                      : <Upload className="h-4 w-4 text-violet-400" />
                    }
                  </button>
                </div>

                <input
                  id={uploadId}
                  ref={uploadRef}
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  onChange={handleUpload}
                />
                {customIconUrl && (
                  <button
                    type="button"
                    onClick={clearCustomIcon}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Rimuovi immagine personalizzata
                  </button>
                )}
              </Field>

              {hasIcon && (
                <>
                  {/* Icon color (for presets only) */}
                  {selectedIconId !== "custom" && (
                    <Field label="Colore icona">
                      <div className="flex items-center gap-2">
                        <input type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                        <Input value={iconColor} onChange={(e) => setIconColor(e.target.value)} className="font-mono text-xs" />
                      </div>
                    </Field>
                  )}

                  {/* Icon background color */}
                  <Field label="Colore sfondo icona">
                    <div className="flex items-center gap-2">
                      <input type="color" value={iconBgColor} onChange={(e) => setIconBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                      <Input value={iconBgColor} onChange={(e) => setIconBgColor(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </Field>

                  {/* Icon size */}
                  <Field label={`Dimensione icona: ${iconSizePct}% del QR`}>
                    <Slider min={10} max={35} step={1} value={[iconSizePct]} onValueChange={([v]) => setIconSizePct(v)} />
                  </Field>

                  {/* Icon padding */}
                  <Field label={`Padding sfondo: ${iconPadding}px`}>
                    <Slider min={0} max={24} step={1} value={[iconPadding]} onValueChange={([v]) => setIconPadding(v)} />
                  </Field>

                  {/* Icon radius */}
                  <Field label={`Raggio angoli: ${iconRadius}px`}>
                    <Slider min={0} max={64} step={2} value={[iconRadius]} onValueChange={([v]) => setIconRadius(v)} />
                  </Field>

                  {/* EC warning */}
                  {(ecLevel === "L" || ecLevel === "M") && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                      Con icona al centro viene usata automaticamente la correzione errori <strong>Q</strong> per garantire la scansione.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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
              <Field label={`Correzione errori: ${ecLevel}${hasIcon && (ecLevel === "L" || ecLevel === "M") ? " → Q (auto)" : ""}`}>
                <Select value={ecLevel} onValueChange={(v) => setEcLevel(v as EcLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L — Bassa (7%)</SelectItem>
                    <SelectItem value="M">M — Media (15%)</SelectItem>
                    <SelectItem value="Q">Q — Quartile (25%)</SelectItem>
                    <SelectItem value="H">H — Alta (30%)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={`Dimensione: ${size}px`}>
                <Slider min={100} max={1000} step={50} value={[size]} onValueChange={([v]) => setSize(v)} />
              </Field>
              <Field label={`Margine: ${margin} moduli`}>
                <Slider min={0} max={10} step={1} value={[margin]} onValueChange={([v]) => setMargin(v)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Colore QR">
                  <div className="flex items-center gap-2">
                    <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                    <Input value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="font-mono text-xs" />
                  </div>
                </Field>
                <Field label="Sfondo QR">
                  <div className="flex items-center gap-2">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border" />
                    <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="font-mono text-xs" />
                  </div>
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: preview ── */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-white/50 dark:bg-card/50 p-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Anteprima</span>
            <button
              type="button"
              onClick={renderQr}
              className="rounded-full p-1 hover:bg-muted transition-colors"
              title="Aggiorna"
            >
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {error ? (
            <div className="flex flex-col items-center justify-center w-64 h-64 rounded-xl border-2 border-dashed border-muted-foreground/30 text-center p-4">
              <QrCode className="h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          ) : (
            <canvas ref={canvasRef} className="rounded-xl shadow-md max-w-full" />
          )}

          {qrData && !error && (
            <p className="text-xs text-muted-foreground text-center break-all max-w-xs px-2">
              <span className="font-semibold">Contenuto:</span>{" "}
              {qrData.length > 80 ? qrData.slice(0, 80) + "…" : qrData}
            </p>
          )}

          <div className="flex gap-2 mt-auto flex-wrap justify-center">
            <Button
              onClick={downloadPng}
              disabled={!!error}
              className="bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white"
            >
              <Download className="h-4 w-4 mr-2" /> PNG
            </Button>
            <Button variant="outline" onClick={downloadSvg} disabled={!!error}>
              <Download className="h-4 w-4 mr-2" />
              {hasIcon ? "PNG (icona)" : "SVG"}
            </Button>
          </div>

          {hasIcon && (
            <p className="text-xs text-muted-foreground text-center">
              Con icona attiva l'esportazione SVG non è supportata — scarica in PNG.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Field sub-component ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}
