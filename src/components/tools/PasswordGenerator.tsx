// c:\Users\pedro\Desktop\FileForge\src\components\tools\PasswordGenerator.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Copy, RefreshCw, ShieldCheck, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PasswordGenerator({ onBack }: { onBack?: () => void }) {
  const [password, setPassword] = useState("");
  const [length, setLength] = useState(16);
  const [type, setType] = useState<"complex" | "easy-read" | "easy-say">("complex");
  const [copied, setCopied] = useState(false);
  const [customSymbols, setCustomSymbols] = useState("!@#$%^&*");

  const COMMON_SYMBOLS = [
    "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", 
    "-", "_", "=", "+", "[", "]", "{", "}", ";", ":", 
    ",", ".", "<", ">", "/", "?", "|", "~", "`"
  ];

  const toggleSymbol = (char: string) => {
    if (customSymbols.includes(char)) {
      setCustomSymbols(prev => prev.split(char).join(""));
    } else {
      setCustomSymbols(prev => prev + char);
    }
  };

  // Opzioni
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [useDashes, setUseDashes] = useState(true);
  const [separatorChar, setSeparatorChar] = useState("-");
  const [separatorStep, setSeparatorStep] = useState(4);

  const generatePassword = () => {
    let newPassword = "";

    if (type === "complex") {
      // Modalità Classica: Tutti i caratteri
      const lower = "abcdefghijklmnopqrstuvwxyz";
      const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const numbers = "0123456789";

      let charset = lower;
      if (includeUppercase) charset += upper;
      if (includeNumbers) charset += numbers;
      if (includeSymbols) charset += customSymbols;

      if (charset.length === 0) charset = lower;

      for (let i = 0; i < length; i++) {
        newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    } else if (type === "easy-read") {
      // Modalità Leggibile: Evita caratteri ambigui (0, O, I, l, 1)
      const lower = "abcdefghijkmnpqrstuvwxyz"; 
      const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; 
      const numbers = "23456789"; 

      let charset = lower;
      if (includeUppercase) charset += upper;
      if (includeNumbers) charset += numbers;
      if (includeSymbols) charset += customSymbols;

      if (charset.length === 0) charset = lower;

      for (let i = 0; i < length; i++) {
        newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    } else if (type === "easy-say") {
      // Modalità Pronunciabile: Alternanza Consonante-Vocale
      const vowels = "aeiou";
      const consonants = "bcdfghjklmnpqrstvwxyz";
      
      let suffix = "";
      // Aggiunge numeri/simboli alla fine per mantenere la pronunciabilità della parte principale
      if (includeNumbers) suffix += Math.floor(Math.random() * 100).toString();
      if (includeSymbols && customSymbols.length > 0) suffix += customSymbols.charAt(Math.floor(Math.random() * customSymbols.length));
      
      // Calcola la lunghezza della parte testuale
      const mainLength = Math.max(3, length - suffix.length);
      
      for (let i = 0; i < mainLength; i++) {
        if (i % 2 === 0) {
           // Consonante
           let char = consonants.charAt(Math.floor(Math.random() * consonants.length));
           if (includeUppercase && i === 0) char = char.toUpperCase(); // Maiuscola iniziale
           newPassword += char;
        } else {
           // Vocale
           let char = vowels.charAt(Math.floor(Math.random() * vowels.length));
           newPassword += char;
        }
      }
      newPassword += suffix;
    }

    if (useDashes && newPassword.length > 0) {
      const step = Math.max(1, separatorStep);
      const char = separatorChar || "-";
      const regex = new RegExp(`.{1,${step}}`, "g");
      newPassword = newPassword.match(regex)?.join(char) || newPassword;
    }

    setPassword(newPassword);
    setCopied(false);
  };

  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (!pwd) return 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strengthScore = calculateStrength(password);
  const strengthInfo = ((score) => {
    if (score <= 2) return { label: "Debole", color: "bg-red-500", text: "text-red-600" };
    if (score === 3) return { label: "Media", color: "bg-yellow-500", text: "text-yellow-600" };
    return { label: "Forte", color: "bg-green-500", text: "text-green-600" };
  })(strengthScore);

  // Aggiorna i simboli di default quando cambia il tipo
  useEffect(() => {
    if (type === "complex") setCustomSymbols("!@#$%^&*()_+~`|}{[]:;?><,./-=");
    else if (type === "easy-read") setCustomSymbols("!@#$%^&*()_+-=");
    else if (type === "easy-say") setCustomSymbols("!@#$%^&*");
  }, [type]);

  // Rigenera quando cambiano le opzioni
  useEffect(() => {
    generatePassword();
  }, [length, type, includeUppercase, includeNumbers, includeSymbols, customSymbols, useDashes, separatorChar, separatorStep]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline tracking-tight">Generatore Password</CardTitle>
                <CardDescription className="text-white/80 text-lg">Crea password sicure, leggibili o pronunciabili in un click.</CardDescription>
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
          
          {/* Display Password */}
          <div className="space-y-4">
            <div className="relative flex items-center">
              <div className="w-full rounded-2xl border-2 bg-muted/30 p-6 pr-16 font-mono text-2xl tracking-wider break-all text-center min-h-[5rem] flex items-center justify-center">
                  {password}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={copyToClipboard} 
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl hover:bg-muted"
                title="Copia"
              >
                  {copied ? <Check className="text-green-600 w-6 h-6" /> : <Copy className="text-muted-foreground w-6 h-6" />}
              </Button>
            </div>
            
            <div className="flex items-center gap-4 px-2">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${strengthInfo.color}`} 
                  style={{ width: `${Math.max(5, (strengthScore / 5) * 100)}%` }} 
                />
              </div>
              <span className={`text-sm font-bold uppercase tracking-wider ${strengthInfo.text}`}>{strengthInfo.label}</span>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              {/* Selettore Tipo */}
              <div className="space-y-3">
                <Label>Modalità Generazione</Label>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1.5">
                    {["complex", "easy-read", "easy-say"].map((t) => (
                      <button 
                          key={t}
                          onClick={() => setType(t as any)}
                          className={cn(
                            "rounded-lg py-2 text-sm font-bold transition-all",
                            type === t ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"
                          )}
                      >
                          {t === "complex" ? "Complessa" : t === "easy-read" ? "Leggibile" : "Pronunciabile"}
                      </button>
                    ))}
                </div>
              </div>

              {/* Slider Lunghezza */}
              <div className="space-y-4 bg-muted/30 p-4 rounded-xl border">
                  <div className="flex justify-between items-center">
                      <Label>Lunghezza</Label>
                      <span className="text-lg font-bold text-primary bg-white px-3 py-1 rounded-md shadow-sm border">{length}</span>
                  </div>
                  <input 
                      type="range" 
                      min="6" 
                      max="64" 
                      value={length} 
                      onChange={(e) => setLength(parseInt(e.target.value))}
                      className="h-3 w-full cursor-pointer appearance-none rounded-full bg-muted-foreground/20 accent-green-600"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>6</span>
                    <span>32</span>
                    <span>64</span>
                  </div>
              </div>

              {/* Checkbox Opzioni */}
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Maiuscole (A-Z)", checked: includeUppercase, set: setIncludeUppercase },
                  { label: "Numeri (0-9)", checked: includeNumbers, set: setIncludeNumbers },
                  { label: "Simboli (!@#)", checked: includeSymbols, set: setIncludeSymbols },
                ].map((opt, i) => (
                  <label key={i} className={cn(
                    "flex-1 min-w-[140px] flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all select-none",
                    opt.checked ? "border-green-500 bg-green-50 text-green-700 font-bold" : "border-muted hover:border-muted-foreground/50"
                  )}>
                      <input 
                        type="checkbox" 
                        checked={opt.checked} 
                        onChange={(e) => opt.set(e.target.checked)} 
                        className="hidden" 
                      />
                      {opt.checked && <Check size={16} />}
                      {opt.label}
                  </label>
                ))}

                {/* Opzione Separatore Personalizzabile */}
                <div className={cn(
                  "flex-1 min-w-[140px] flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all select-none",
                  useDashes ? "border-green-500 bg-green-50" : "border-muted hover:border-muted-foreground/50"
                )}>
                  <label className="flex items-center gap-2 cursor-pointer w-full justify-center">
                    <input 
                      type="checkbox" 
                      checked={useDashes} 
                      onChange={(e) => setUseDashes(e.target.checked)} 
                      className="hidden" 
                    />
                    {useDashes && <Check size={16} className="text-green-700" />}
                    <span className={useDashes ? "text-green-700 font-bold" : "text-muted-foreground"}>Separatore</span>
                  </label>
                  
                  {useDashes && (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-top-1" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text" 
                        maxLength={1}
                        value={separatorChar}
                        onChange={(e) => setSeparatorChar(e.target.value)}
                        className="w-8 h-8 text-center rounded border bg-white text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="-"
                      />
                      <span className="text-[10px] text-muted-foreground font-medium">ogni</span>
                      <input 
                        type="number" 
                        min={1}
                        max={32}
                        value={separatorStep}
                        onChange={(e) => setSeparatorStep(Math.max(1, parseInt(e.target.value) || 4))}
                        className="w-10 h-8 text-center rounded border bg-white text-sm font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {includeSymbols && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 h-full flex flex-col">
                   <Label>Simboli Inclusi</Label>
                   <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-4 rounded-xl border bg-muted/20 flex-1 content-start">
                     {COMMON_SYMBOLS.map((char) => (
                       <button
                         type="button"
                         key={char}
                         onClick={() => toggleSymbol(char)}
                         className={cn(
                           "aspect-square rounded-lg border text-sm font-bold transition-all flex items-center justify-center hover:scale-110",
                           customSymbols.includes(char) 
                             ? "bg-green-600 text-white border-green-600 shadow-md" 
                             : "bg-white text-muted-foreground hover:bg-green-50 hover:text-green-600"
                         )}
                       >
                         {char}
                       </button>
                     ))}
                   </div>
                   <Input 
                     type="text" 
                     value={customSymbols} 
                     onChange={(e) => setCustomSymbols(e.target.value)}
                     placeholder="Simboli personalizzati..."
                     className="h-10"
                   />
                </div>
              )}
            </div>
          </div>

          <Button onClick={generatePassword} className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg rounded-xl gap-3">
              <RefreshCw size={20} /> 
              Genera Nuova Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
