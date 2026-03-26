
"use client";

import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { HeicConverter } from '@/components/tools/heic-converter';
import { PdfSigner } from '@/components/tools/pdf-signer';
import { AiToSvgConverter } from '@/components/tools/AiToSvgConverter';
import {
  FileText,
  ImageIcon,
  Minimize2,
  Combine,
  Scissors,
  ArrowRightLeft,
  Boxes,
  Layers,
  ImagePlus,
  GalleryHorizontal,
  Home as HomeIcon,
  PenTool,
  Wrench,
  FileType,
  ShieldCheck,
  ScanLine,
  Smartphone,
  Eraser,
  QrCode,
  Barcode,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ImageConverter } from '@/components/tools/ImageConverter';
import { BackgroundRemover } from '@/components/tools/BackgroundRemover';
import { PdfMerger } from '@/components/tools/PdfMerger';
import { PdfSplitter } from '@/components/tools/PdfSplitter';
import { PdfOrganizer } from '@/components/tools/PdfOrganizer';
import { PdfCompressor } from '@/components/tools/PdfCompressor';
import { PdfToWord } from '@/components/tools/PdfToWord';
import { ImagesToPdf } from '@/components/tools/ImagesToPdf';
import { PdfToImages } from '@/components/tools/PdfToImages';
import { Button } from '@/components/ui/button';
import { PasswordGenerator } from '@/components/tools/PasswordGenerator';
import { MetadataCleaner } from '@/components/tools/MetadataCleaner';
import { QrCodeGenerator } from '@/components/tools/QrCodeGenerator';
import { BarcodeGenerator } from '@/components/tools/BarcodeGenerator';
import { PasswordBreachChecker } from '@/components/tools/PasswordBreachChecker';

// ─── Tipo tool ────────────────────────────────────────────────────────────────

type Tool = {
  id: string;
  name: string;
  icon: React.ReactNode;
  desc: string;
  gradient: string;     // bg-gradient-to-br classes per l'icona
  cardBg: string;       // hover background della card
  borderHover: string;  // hover border della card
};

export default function Home() {
  const [activeTab, setActiveTab]                   = useState("images");
  const [activeImageTool, setActiveImageTool]       = useState<string | null>(null);
  const [activePdfTool, setActivePdfTool]           = useState<string | null>(null);
  const [activeOtherTool, setActiveOtherTool]       = useState<string | null>(null);
  const [activeSecurityTool, setActiveSecurityTool] = useState<string | null>(null);

  // ── Definizione strumenti ────────────────────────────────────────────────

  const imageTools: Tool[] = [
    {
      id: "converter", name: "Converti Immagine", icon: <ArrowRightLeft />,
      desc: "Converti tra JPG, PNG, WebP, AVIF e altri formati",
      gradient: "from-violet-600 to-fuchsia-600",
      cardBg: "hover:bg-violet-50/60 dark:hover:bg-violet-900/10",
      borderHover: "hover:border-violet-300 dark:hover:border-violet-700",
    },
    {
      id: "heic", name: "Converti HEIC", icon: <Smartphone />,
      desc: "Trasforma foto iPhone in formati universali",
      gradient: "from-blue-600 to-cyan-500",
      cardBg: "hover:bg-blue-50/60 dark:hover:bg-blue-900/10",
      borderHover: "hover:border-blue-300 dark:hover:border-blue-700",
    },
    {
      id: "bg-remover", name: "Rimuovi Sfondo", icon: <Eraser />,
      desc: "Rimozione AI dello sfondo con un click",
      gradient: "from-teal-600 to-emerald-500",
      cardBg: "hover:bg-teal-50/60 dark:hover:bg-teal-900/10",
      borderHover: "hover:border-teal-300 dark:hover:border-teal-700",
    },
    {
      id: "metadata", name: "Metadati & Pulizia", icon: <ScanLine />,
      desc: "Analizza e rimuovi dati nascosti dalle immagini",
      gradient: "from-blue-600 to-indigo-600",
      cardBg: "hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10",
      borderHover: "hover:border-indigo-300 dark:hover:border-indigo-700",
    },
  ];

  const pdfTools: Tool[] = [
    {
      id: "merge", name: "Unisci PDF", icon: <Combine />,
      desc: "Combina più documenti in uno solo",
      gradient: "from-indigo-500 to-blue-600",
      cardBg: "hover:bg-indigo-50/60 dark:hover:bg-indigo-900/10",
      borderHover: "hover:border-indigo-300 dark:hover:border-indigo-700",
    },
    {
      id: "split", name: "Dividi PDF", icon: <Scissors />,
      desc: "Estrai pagine o dividi documenti",
      gradient: "from-rose-500 to-orange-500",
      cardBg: "hover:bg-rose-50/60 dark:hover:bg-rose-900/10",
      borderHover: "hover:border-rose-300 dark:hover:border-rose-700",
    },
    {
      id: "organize", name: "Organizza PDF", icon: <Layers />,
      desc: "Riordina, aggiungi o elimina pagine",
      gradient: "from-purple-500 to-violet-600",
      cardBg: "hover:bg-purple-50/60 dark:hover:bg-purple-900/10",
      borderHover: "hover:border-purple-300 dark:hover:border-purple-700",
    },
    {
      id: "imgtopdf", name: "Immagini a PDF", icon: <ImagePlus />,
      desc: "Crea un PDF partendo da più immagini",
      gradient: "from-pink-500 to-rose-600",
      cardBg: "hover:bg-pink-50/60 dark:hover:bg-pink-900/10",
      borderHover: "hover:border-pink-300 dark:hover:border-pink-700",
    },
    {
      id: "pdftoimg", name: "PDF a Immagini", icon: <GalleryHorizontal />,
      desc: "Estrai le pagine come file PNG separati",
      gradient: "from-cyan-500 to-sky-600",
      cardBg: "hover:bg-cyan-50/60 dark:hover:bg-cyan-900/10",
      borderHover: "hover:border-cyan-300 dark:hover:border-cyan-700",
    },
    {
      id: "compress", name: "Comprimi PDF", icon: <Minimize2 />,
      desc: "Riduci dimensioni senza perdere qualità",
      gradient: "from-amber-500 to-orange-600",
      cardBg: "hover:bg-amber-50/60 dark:hover:bg-amber-900/10",
      borderHover: "hover:border-amber-300 dark:hover:border-amber-700",
    },
    {
      id: "toword", name: "PDF a Word", icon: <ArrowRightLeft />,
      desc: "Converti in formato editabile",
      gradient: "from-teal-500 to-green-600",
      cardBg: "hover:bg-teal-50/60 dark:hover:bg-teal-900/10",
      borderHover: "hover:border-teal-300 dark:hover:border-teal-700",
    },
    {
      id: "sign", name: "Firma PDF (Mobile)", icon: <PenTool />,
      desc: "Firma documenti direttamente da iPhone/iPad",
      gradient: "from-slate-500 to-slate-700",
      cardBg: "hover:bg-slate-50/60 dark:hover:bg-slate-900/10",
      borderHover: "hover:border-slate-300 dark:hover:border-slate-600",
    },
  ];

  const otherTools: Tool[] = [
    {
      id: "ai-to-svg", name: "AI to SVG", icon: <FileType />,
      desc: "Converti file .ai in SVG vettoriali",
      gradient: "from-orange-500 to-amber-600",
      cardBg: "hover:bg-orange-50/60 dark:hover:bg-orange-900/10",
      borderHover: "hover:border-orange-300 dark:hover:border-orange-700",
    },
    {
      id: "qr-code", name: "Generatore QR Code", icon: <QrCode />,
      desc: "Crea QR code per URL, testo, Wi-Fi, contatti e altro",
      gradient: "from-violet-600 to-purple-700",
      cardBg: "hover:bg-violet-50/60 dark:hover:bg-violet-900/10",
      borderHover: "hover:border-violet-300 dark:hover:border-violet-700",
    },
    {
      id: "barcode", name: "Generatore Codice a Barre", icon: <Barcode />,
      desc: "Crea barcode EAN, UPC, Code 128, Code 39 e altri standard",
      gradient: "from-slate-600 to-gray-800",
      cardBg: "hover:bg-slate-50/60 dark:hover:bg-slate-900/10",
      borderHover: "hover:border-slate-300 dark:hover:border-slate-600",
    },
  ];

  const securityTools: Tool[] = [
    {
      id: "password-gen", name: "Password Generator", icon: <ShieldCheck />,
      desc: "Genera password sicure e personalizzabili",
      gradient: "from-green-600 to-emerald-600",
      cardBg: "hover:bg-green-50/60 dark:hover:bg-green-900/10",
      borderHover: "hover:border-green-300 dark:hover:border-green-700",
    },
    {
      id: "breach-check", name: "Verifica Password Dark Web", icon: <ShieldAlert />,
      desc: "Controlla se la tua password è stata violata — privacy garantita",
      gradient: "from-gray-800 to-red-800",
      cardBg: "hover:bg-red-50/60 dark:hover:bg-red-900/10",
      borderHover: "hover:border-red-300 dark:hover:border-red-700",
    },
  ];

  // ── Componenti condivisi ──────────────────────────────────────────────────

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <Button variant="ghost" onClick={onClick} className="mb-2">
      <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
    </Button>
  );

  const ToolGrid = ({ tools, onSelect }: { tools: Tool[]; onSelect: (id: string) => void }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tools.map((tool) => (
        <Card
          key={tool.id}
          className={`group cursor-pointer transition-all duration-200 bg-white/50 dark:bg-card/50 ${tool.cardBg} ${tool.borderHover}`}
          onClick={() => onSelect(tool.id)}
        >
          <CardContent className="p-6 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.gradient} text-white flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200`}>
              {tool.icon}
            </div>
            <div>
              <h3 className="font-bold">{tool.name}</h3>
              <p className="text-xs text-muted-foreground">{tool.desc}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // ── Render sezioni ────────────────────────────────────────────────────────

  const renderImageTool = () => {
    switch (activeImageTool) {
      case "converter":  return <ImageConverter      onBack={() => setActiveImageTool(null)} />;
      case "heic":       return <HeicConverter        onBack={() => setActiveImageTool(null)} />;
      case "bg-remover": return <BackgroundRemover    onBack={() => setActiveImageTool(null)} />;
      case "metadata":   return <MetadataCleaner      onBack={() => setActiveImageTool(null)} />;
      default:
        return <ToolGrid tools={imageTools} onSelect={setActiveImageTool} />;
    }
  };

  const renderPdfTool = () => {
    switch (activePdfTool) {
      case "merge":    return <PdfMerger    onBack={() => setActivePdfTool(null)} />;
      case "split":    return <PdfSplitter  onBack={() => setActivePdfTool(null)} />;
      case "organize": return <PdfOrganizer onBack={() => setActivePdfTool(null)} />;
      case "imgtopdf": return <ImagesToPdf  onBack={() => setActivePdfTool(null)} />;
      case "pdftoimg": return <PdfToImages  onBack={() => setActivePdfTool(null)} />;
      case "compress": return <PdfCompressor onBack={() => setActivePdfTool(null)} />;
      case "toword":   return <PdfToWord    onBack={() => setActivePdfTool(null)} />;
      case "sign":     return <PdfSigner onBack={() => setActivePdfTool(null)} />;
      default:
        return <ToolGrid tools={pdfTools} onSelect={setActivePdfTool} />;
    }
  };

  const renderOtherTool = () => {
    switch (activeOtherTool) {
      case "ai-to-svg": return <AiToSvgConverter onBack={() => setActiveOtherTool(null)} />;
      case "qr-code":   return <QrCodeGenerator  onBack={() => setActiveOtherTool(null)} />;
      case "barcode":   return <BarcodeGenerator  onBack={() => setActiveOtherTool(null)} />;
      default:
        return <ToolGrid tools={otherTools} onSelect={setActiveOtherTool} />;
    }
  };

  const renderSecurityTool = () => {
    switch (activeSecurityTool) {
      case "password-gen": return <PasswordGenerator onBack={() => setActiveSecurityTool(null)} />;
      case "breach-check":
        return <PasswordBreachChecker onBack={() => setActiveSecurityTool(null)} />;
      default:
        return <ToolGrid tools={securityTools} onSelect={setActiveSecurityTool} />;
    }
  };

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-64 space-y-6">
            <div className="p-4 bg-white dark:bg-card rounded-2xl shadow-sm border space-y-2">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-4">Categorie</h2>

              <Button
                variant="ghost"
                className="w-full justify-start rounded-xl font-semibold text-muted-foreground hover:text-primary mb-2"
                onClick={() => (window as any).electronAPI?.goHome?.()}
              >
                <HomeIcon className="mr-2 h-4 w-4" />
                Vai al menu
              </Button>

              <Button
                variant={activeTab === "images" ? "default" : "ghost"}
                className="w-full justify-start rounded-xl font-semibold"
                onClick={() => { setActiveTab("images"); setActiveImageTool(null); }}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Immagini
              </Button>

              <Button
                variant={activeTab === "security" ? "default" : "ghost"}
                className="w-full justify-start rounded-xl font-semibold"
                onClick={() => { setActiveTab("security"); setActiveSecurityTool(null); }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Sicurezza
              </Button>

              <Button
                variant={activeTab === "other" ? "default" : "ghost"}
                className="w-full justify-start rounded-xl font-semibold"
                onClick={() => { setActiveTab("other"); setActiveOtherTool(null); }}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Altri Strumenti
              </Button>

              <Button
                variant={activeTab === "pdf" ? "default" : "ghost"}
                className="w-full justify-start rounded-xl font-semibold"
                onClick={() => { setActiveTab("pdf"); setActivePdfTool(null); }}
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF Suite
              </Button>
            </div>
          </aside>

          {/* ── Contenuto principale ── */}
          <div className="flex-1">
            <Tabs value={activeTab} className="w-full">

              <TabsContent value="images" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Immagini & Grafica</h1>
                    <p className="text-muted-foreground">Converti, ottimizza e pulisci le tue risorse grafiche.</p>
                  </div>
                  {renderImageTool()}
                </div>
              </TabsContent>

              <TabsContent value="security" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Sicurezza</h1>
                    <p className="text-muted-foreground">Strumenti essenziali per la tua privacy digitale.</p>
                  </div>
                  {renderSecurityTool()}
                </div>
              </TabsContent>

              <TabsContent value="other" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">Altri Strumenti</h1>
                    <p className="text-muted-foreground">Utility varie per conversioni e sicurezza.</p>
                  </div>
                  {renderOtherTool()}
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">PDF Suite</h1>
                    <p className="text-muted-foreground">Gestione professionale e manipolazione dei tuoi documenti.</p>
                  </div>
                  {renderPdfTool()}
                </div>
              </TabsContent>

            </Tabs>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white dark:bg-card py-6 mt-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            <span className="font-bold tracking-tighter text-primary">FileForge</span>
          </div>
          <p className="text-muted-foreground text-xs">
            © 2026 LocalForge Studio. Strumenti veloci, sicuri, pronti all'uso.
          </p>
        </div>
      </footer>
    </div>
  );
}
