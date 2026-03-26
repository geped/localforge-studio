"use client";

import React from "react";
import { HeicConverter } from "@/components/tools/heic-converter";
import { PdfSigner } from "@/components/tools/pdf-signer";
import { FileText, Image as ImageIcon, PenTool, Smartphone } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-12">
        
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">FileForge Studio</h1>
          <p className="text-muted-foreground text-lg">
            Suite di strumenti per la gestione documentale.
          </p>
        </div>

        {/* Categoria: PDF Suite */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="rounded-lg bg-red-100 p-2 text-red-600">
              <FileText size={28} />
            </div>
            <h2 className="text-2xl font-semibold">PDF Suite</h2>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Strumento: Firma PDF */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b p-4 bg-muted/30">
                <div className="flex items-center gap-2 font-medium">
                  <PenTool size={18} className="text-purple-600" />
                  Firma Digitale (Mobile)
                </div>
              </div>
              <div className="p-4">
                <PdfSigner />
              </div>
            </div>
          </div>
        </section>

        {/* Categoria: Immagini */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b pb-4">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <ImageIcon size={28} />
            </div>
            <h2 className="text-2xl font-semibold">Immagini</h2>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Strumento: Convertitore HEIC */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="border-b p-4 bg-muted/30">
                <div className="flex items-center gap-2 font-medium">
                  <Smartphone size={18} className="text-blue-600" />
                  Convertitore HEIC (iPhone)
                </div>
              </div>
              <div className="p-4">
                <HeicConverter />
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}