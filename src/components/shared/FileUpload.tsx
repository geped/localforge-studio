"use client";

import React, { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  accept,
  multiple = false,
  label = "Scegli un file o trascinalo qui",
  description = "Supporta PDF, DOCX, Immagini",
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newFiles = multiple ? [...selectedFiles, ...files] : [files[0]];
      setSelectedFiles(newFiles);
      onFileSelect(newFiles);
    }
  }, [multiple, onFileSelect, selectedFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      const newFiles = multiple ? [...selectedFiles, ...files] : [files[0]];
      setSelectedFiles(newFiles);
      onFileSelect(newFiles);
    }
  }, [multiple, onFileSelect, selectedFiles]);

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFileSelect(newFiles);
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative group cursor-pointer border-2 border-dashed rounded-xl p-10 transition-all duration-200 ease-in-out flex flex-col items-center justify-center gap-4",
          isDragging 
            ? "border-accent bg-accent/5 scale-[1.01]" 
            : "border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5",
          selectedFiles.length > 0 && "border-primary/30 bg-primary/5"
        )}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
          accept={accept}
          multiple={multiple}
        />
        
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200",
          isDragging ? "scale-110 bg-accent text-white" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
        )}>
          {selectedFiles.length > 0 ? <CheckCircle2 size={32} /> : <Upload size={32} />}
        </div>
        
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>

        <Button variant="outline" className="mt-2 pointer-events-none group-hover:bg-primary group-hover:text-white transition-colors">
          Seleziona File
        </Button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-card rounded-lg border shadow-sm animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <File size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              </div>
              <button 
                onClick={() => removeFile(idx)}
                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}