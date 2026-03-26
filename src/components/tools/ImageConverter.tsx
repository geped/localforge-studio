"use client";

import React, { useState } from 'react';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, RefreshCw, ImageIcon, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ImageConverter({ onBack }: { onBack?: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [outputFormat, setOutputFormat] = useState<string>('image/png');
  const [converting, setConverting] = useState(false);
  const [results, setResults] = useState<{ name: string; url: string }[]>([]);

  const handleConvert = async () => {
    if (files.length === 0) return;
    setConverting(true);
    setResults([]);

    try {
      const newResults = await Promise.all(
        files.map(async (file) => {
          return new Promise<{ name: string; url: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                
                const formatLabel = outputFormat.split('/')[1];
                const fileName = file.name.replace(/\.[^/.]+$/, "") + `.${formatLabel}`;
                const dataUrl = canvas.toDataURL(outputFormat);
                
                resolve({ name: fileName, url: dataUrl });
              };
              img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
          });
        })
      );
      setResults(newResults);
    } catch (error) {
      console.error("Conversion failed", error);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline tracking-tight">Convertitore Immagini</CardTitle>
                <CardDescription className="text-white/80 text-lg">Converti le tue immagini tra JPEG, PNG e WEBP istantaneamente.</CardDescription>
              </div>
            </div>
            {onBack && (
              <Button variant="ghost" className="text-white hover:bg-white/20" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <FileUpload 
            onFileSelect={setFiles} 
            accept="image/*" 
            multiple 
            label="Carica le immagini da convertire"
            description="JPG, PNG, WEBP, BMP supportati"
          />

          {files.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Formato di output:</span>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Seleziona formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image/png">PNG</SelectItem>
                    <SelectItem value="image/jpeg">JPEG</SelectItem>
                    <SelectItem value="image/webp">WEBP</SelectItem>
                    <SelectItem value="image/bmp">BMP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleConvert} 
                disabled={converting}
                className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-bold h-12 px-8"
              >
                {converting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Converti {files.length} file
              </Button>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
              {results.map((res, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-card border border-accent/20 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img src={res.url} alt="preview" className="w-12 h-12 object-cover rounded-md border" />
                    <span className="text-sm font-medium truncate">{res.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-accent hover:text-accent hover:bg-accent/10" asChild>
                    <a href={res.url} download={res.name}>
                      <Download className="h-4 w-4 mr-2" />
                      Scarica
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}