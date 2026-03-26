"use client";

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { ImageConverter } from '@/components/tools/ImageConverter';
import { BackgroundRemover } from '@/components/tools/BackgroundRemover';
import { PdfAnalyzer } from '@/components/tools/PdfAnalyzer';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Construction } from 'lucide-react';

export default function ToolPage() {
  const { slug } = useParams();
  const router = useRouter();

  const renderTool = () => {
    switch (slug) {
      case 'image-converter':
        return <ImageConverter />;
      case 'ai-background-remover':
        return <BackgroundRemover />;
      case 'pdf-analyzer':
        return <PdfAnalyzer />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="bg-muted p-8 rounded-full">
              <Construction className="w-16 h-16 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-primary">Strumento in Sviluppo</h1>
            <p className="text-muted-foreground max-w-md">
              Stiamo lavorando duramente per portare questa funzionalità di "{slug}" su FileForge. Torna presto!
            </p>
            <Button onClick={() => router.push('/')} variant="outline" className="rounded-full">
              Torna alla Home
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/')} 
          className="mb-8 hover:bg-white/50"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Torna alla dashboard
        </Button>
        {renderTool()}
      </div>
    </div>
  );
}
