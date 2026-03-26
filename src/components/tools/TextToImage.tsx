"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, Download, RefreshCw } from 'lucide-react';
import { generateImage } from '@/ai/flows/text-to-image-flow';
import { toast } from '@/hooks/use-toast';

export function TextToImage() {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResultUrl(null);

    try {
      const { imageDataUri } = await generateImage({ prompt });
      setResultUrl(imageDataUri);
      toast({
        title: "Immagine Generata!",
        description: "La tua creazione è pronta.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile generare l'immagine. Riprova più tardi.",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-3xl font-headline tracking-tight">AI Image Generator</CardTitle>
            <CardDescription className="text-white/80 text-lg">Trasforma le tue parole in immagini spettacolari.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input 
            placeholder="Descrivi l'immagine (es: Un astronauta che cavalca un unicorno su Marte)" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 h-12 text-lg rounded-xl border-2 focus:border-purple-500"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <Button 
            onClick={handleGenerate} 
            disabled={generating || !prompt.trim()}
            className="h-12 px-8 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg"
          >
            {generating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
            Genera
          </Button>
        </div>

        {generating && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-muted/20 rounded-2xl border-2 border-dashed border-purple-200">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            <p className="text-purple-600 font-medium">Forgiando la tua immagine...</p>
          </div>
        )}

        {resultUrl && !generating && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
            <div className="relative group overflow-hidden rounded-2xl shadow-2xl border-4 border-white max-w-2xl">
              <img src={resultUrl} alt="Generated" className="w-full h-auto object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                 <Button variant="secondary" className="rounded-full" asChild>
                    <a href={resultUrl} download="fileforge-gen-ai.png">
                      <Download className="w-5 h-5 mr-2" /> Scarica
                    </a>
                 </Button>
              </div>
            </div>
            <div className="flex gap-4">
              <Button onClick={() => setResultUrl(null)} variant="outline" className="rounded-xl h-12 px-6">
                <RefreshCw className="mr-2 h-4 w-4" /> Nuovo Prompt
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 px-6" asChild>
                <a href={resultUrl} download="fileforge-gen-ai.png">
                  <Download className="mr-2 h-5 w-5" /> Scarica PNG
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
