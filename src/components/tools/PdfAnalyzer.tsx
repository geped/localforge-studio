"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, Search, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function PdfAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzePdfOutput | null>(null);

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);

    try {
      const reader = new FileReader();
      const pdfDataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const analysis = await analyzePdf({ pdfDataUri });
      setResult(analysis);
      toast({
        title: "Analisi completata!",
        description: "Il documento è stato analizzato con successo.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile analizzare il PDF. Riprova più tardi.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-3xl font-headline tracking-tight">AI PDF Analyzer</CardTitle>
            <CardDescription className="text-white/80 text-lg">Riassumi e comprendi documenti complessi in pochi secondi.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        {!result ? (
          <div className="space-y-6">
            <FileUpload 
              onFileSelect={handleFileSelect} 
              accept="application/pdf" 
              label="Carica un documento PDF"
              description="Analisi automatica con Gemini 2.5 Flash"
            />
            {file && (
              <Button 
                onClick={handleAnalyze} 
                disabled={analyzing}
                className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg rounded-xl"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                    Analizzando il contenuto...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="mr-3 h-6 w-6" />
                    Inizia Analisi AI
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Search className="text-red-600" /> Risultati dell'Analisi
              </h3>
              <Badge variant="outline" className="border-red-200 text-red-600">
                Lingua: {result.language}
              </Badge>
            </div>

            <div className="grid gap-6">
              <div className="bg-muted/30 p-6 rounded-2xl border">
                <h4 className="font-bold mb-3 text-primary">Riassunto Esecutivo</h4>
                <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
              </div>

              <div className="bg-white dark:bg-card p-6 rounded-2xl border shadow-sm">
                <h4 className="font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="text-green-500 w-5 h-5" /> Punti Chiave
                </h4>
                <ul className="space-y-3">
                  {result.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={() => { setResult(null); setFile(null); }}
              className="w-full rounded-xl h-12"
            >
              Analizza un altro documento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}