// c:\Users\pedro\Desktop\FileForge\src\components\tools\signature-vault.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Lock, Unlock, KeyRound, Trash2, FileUp, FileDown, HelpCircle, Eye, EyeOff, Save, AlertCircle, Edit2, Check, X, Plus, Layout, Activity, MousePointer2, RefreshCcw, Copy, Settings, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { saveFile } from "@/utils/save-file";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { SECURITY_QUESTIONS, generateSecureHash, encryptVault, decryptVault } from "./helpers/vault-manager";

interface VaultPanelProps {
  id: string;
  persistenceKey: string | null; // Se null, è un vault di sessione
  onSelectSignature: (imgData: string) => void;
  signatureToSave?: string | null;
  onSignatureSaved?: () => void;
  onNameChange: (id: string, name: string) => void;
  onClose?: (id: string) => void;
  isActive: boolean;
}

function VaultPanel({ 
  id,
  persistenceKey, 
  onSelectSignature, 
  signatureToSave, 
  onSignatureSaved,
  onNameChange,
  onClose,
  isActive
}: VaultPanelProps) {
  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState<string | null>(null);
  const [savedSignatures, setSavedSignatures] = useState<{id: string, title: string, data: string}[]>([]);
  const [savedQA, setSavedQA] = useState<{id: string, ans: string}[] | null>(null);
  const [savedEntropyKey, setSavedEntropyKey] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState("Nuovo Vault");
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);
  
  // Editing States
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingSigId, setEditingSigId] = useState<string | null>(null);
  const [editSigTitle, setEditSigTitle] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  
  // Inputs
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newSigTitle, setNewSigTitle] = useState("");
  
  // Setup & Recovery
  const [setupStep, setSetupStep] = useState(0); // 0: Pwd, 1: QA, 2: Entropy
  const [setupQA, setSetupQA] = useState([{id: "q1", ans: ""}, {id: "q2", ans: ""}, {id: "q3", ans: ""}]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryMethod, setRecoveryMethod] = useState<"qa" | "key">("qa");
  const [recoveryAnswers, setRecoveryAnswers] = useState(["", "", ""]);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");

  // Settings Inputs
  const [settingsOldPwd, setSettingsOldPwd] = useState("");
  const [settingsNewPwd, setSettingsNewPwd] = useState("");
  const [settingsQA, setSettingsQA] = useState<{id: string, ans: string}[]>([]);

  // Entropy State
  const [entropyStats, setEntropyStats] = useState({ samples: 0, chaos: 0 });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const entropyBuffer = useRef<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastEntropyPoint = useRef<any>(null);

  // Load from LocalStorage (Solo se persistenceKey è presente)
  useEffect(() => {
    if (!persistenceKey) return;
    
    const pwd = localStorage.getItem(`${persistenceKey}_pwd`);
    const data = localStorage.getItem(`${persistenceKey}_data`);
    const qa = localStorage.getItem(`${persistenceKey}_qa`);
    const key = localStorage.getItem(`${persistenceKey}_key`);
    const vName = localStorage.getItem(`${persistenceKey}_name`);
    
    if (pwd) setVaultPassword(pwd);
    if (data) setSavedSignatures(JSON.parse(data));
    if (qa) setSavedQA(JSON.parse(qa));
    if (key) setSavedEntropyKey(key);
    if (vName) {
      setVaultName(vName);
      onNameChange(id, vName);
    } else {
      setVaultName("Il Mio Vault");
      onNameChange(id, "Il Mio Vault");
    }
  }, [persistenceKey]);

  // Helper per salvare lo stato (se persistente)
  const persistState = (
    pwd: string | null, 
    qa: any | null, 
    key: string | null,
    sigs: any[], 
    name: string
  ) => {
    if (!persistenceKey) return;
    
    if (pwd) localStorage.setItem(`${persistenceKey}_pwd`, pwd);
    else localStorage.removeItem(`${persistenceKey}_pwd`);

    if (qa) localStorage.setItem(`${persistenceKey}_qa`, JSON.stringify(qa));
    else localStorage.removeItem(`${persistenceKey}_qa`);

    if (key) localStorage.setItem(`${persistenceKey}_key`, key);
    else localStorage.removeItem(`${persistenceKey}_key`);

    localStorage.setItem(`${persistenceKey}_data`, JSON.stringify(sigs));
    localStorage.setItem(`${persistenceKey}_name`, name);
  };

  // --- Actions ---

  const handleUnlock = async () => {
    // Caso 1: Sblocco di un vault importato cifrato
    if (pendingImportData) {
      try {
        const content = await decryptVault(pendingImportData, passwordInput);
        
        // Carica i dati decifrati
        setVaultPassword(passwordInput); // La password è corretta se decrypt non fallisce
        setSavedQA(content.qa);
        setSavedEntropyKey(content.key || null);
        setSavedSignatures(content.signatures);
        if (content.name) {
          setVaultName(content.name);
          onNameChange(id, content.name);
        }
        
        persistState(passwordInput, content.qa, content.key || null, content.signatures, content.name || vaultName);
        setPendingImportData(null);
        setIsUnlocked(true);
        setPasswordInput("");
        toast({ title: "Vault Decifrato", description: "Importazione completata con successo." });
      } catch (e) {
        toast({ variant: "destructive", title: "Errore Decifratura", description: "Password errata o file corrotto." });
      }
    } else if (passwordInput === vaultPassword) {
      // Caso 2: Sblocco normale
      setIsUnlocked(true);
      setPasswordInput("");
      toast({ title: "Vault Sbloccato", description: "Accesso consentito." });
    } else {
      toast({ variant: "destructive", title: "Errore", description: "Password errata." });
    }
  };

  const handleSetup = () => {
    if (setupStep === 0) {
      if (passwordInput.length < 4) return toast({ variant: "destructive", title: "Password debole" });
      if (passwordInput !== confirmInput) return toast({ variant: "destructive", title: "Le password non coincidono" });
      setSetupStep(1);
    } else if (setupStep === 1) {
      if (setupQA.some(q => !q.ans.trim())) return toast({ variant: "destructive", title: "Compila tutte le domande" });
      setSetupStep(2); // Go to Entropy
    } else {
      // Finalize (Step 2)
      setVaultPassword(passwordInput);
      setSavedQA(setupQA);
      setSavedEntropyKey(generatedKey);
      
      persistState(passwordInput, setupQA, generatedKey, savedSignatures, vaultName);
      
      setIsUnlocked(true);
      setPasswordInput("");
      setSetupStep(0);
      setGeneratedKey(null);
      entropyBuffer.current = [];
      toast({ title: "Vault Configurato", description: "Il tuo archivio è protetto." });
    }
  };

  const handleSaveSignature = () => {
    if (!signatureToSave || !newSigTitle.trim()) return;
    const newSig = { id: Date.now().toString(), title: newSigTitle, data: signatureToSave };
    const updated = [...savedSignatures, newSig];
    
    setSavedSignatures(updated);
    persistState(vaultPassword, savedQA, savedEntropyKey, updated, vaultName);
    
    setNewSigTitle("");
    if (onSignatureSaved) onSignatureSaved();
    toast({ title: "Salvata", description: "Firma aggiunta al vault." });
  };

  const handleDelete = (id: string) => {
    const updated = savedSignatures.filter(s => s.id !== id);
    setSavedSignatures(updated);
    persistState(vaultPassword, savedQA, savedEntropyKey, updated, vaultName);
  };

  const handleRenameSignature = (id: string) => {
    if (!editSigTitle.trim()) return;
    const updated = savedSignatures.map(s => s.id === id ? { ...s, title: editSigTitle } : s);
    setSavedSignatures(updated);
    persistState(vaultPassword, savedQA, savedEntropyKey, updated, vaultName);
    setEditingSigId(null);
    setEditSigTitle("");
    toast({ title: "Firma Rinominata", description: "Modifica salvata." });
  };

  const handleSaveVaultName = () => {
    if (!vaultName.trim()) return;
    persistState(vaultPassword, savedQA, savedEntropyKey, savedSignatures, vaultName);
    onNameChange(id, vaultName);
    setIsEditingName(false);
    toast({ title: "Vault Rinominato", description: `Nuovo nome: ${vaultName}` });
  };

  const handleRecovery = () => {
    if (recoveryMethod === "qa") {
      if (!savedQA) return;
      const isCorrect = recoveryAnswers.every((ans, i) => ans.trim().toLowerCase() === savedQA[i].ans.trim().toLowerCase());
      if (isCorrect) {
        performReset();
      } else {
        toast({ variant: "destructive", title: "Errore", description: "Risposte non corrette." });
      }
    } else {
      // Key Recovery
      if (recoveryKeyInput.trim() === savedEntropyKey) {
        performReset();
      } else {
        toast({ variant: "destructive", title: "Errore", description: "Chiave non valida." });
      }
    }
  };

  const handleUnlockWithKey = () => {
    if (recoveryKeyInput.trim() === savedEntropyKey) {
      setIsUnlocked(true);
      setIsRecovering(false);
      setRecoveryKeyInput("");
      toast({ title: "Sbloccato con Chiave", description: "Accesso consentito." });
    } else {
      toast({ variant: "destructive", title: "Errore", description: "Chiave non valida." });
    }
  };

  const performReset = () => {
    setVaultPassword(null);
    setSavedQA(null);
    setSavedEntropyKey(null);
    persistState(null, null, null, savedSignatures, vaultName); // Mantiene i dati, resetta auth
    
    setIsRecovering(false);
    setIsUnlocked(false);
    setRecoveryAnswers(["", "", ""]);
    setRecoveryKeyInput("");
    toast({ title: "Reset Completato", description: "Imposta una nuova password." });
  };

  // --- Settings Actions ---
  const handleUpdatePassword = () => {
    if (settingsOldPwd !== vaultPassword) return toast({ variant: "destructive", title: "Errore", description: "Vecchia password errata." });
    if (settingsNewPwd.length < 4) return toast({ variant: "destructive", title: "Errore", description: "Nuova password troppo corta." });
    
    setVaultPassword(settingsNewPwd);
    persistState(settingsNewPwd, savedQA, savedEntropyKey, savedSignatures, vaultName);
    setSettingsOldPwd("");
    setSettingsNewPwd("");
    toast({ title: "Password Aggiornata" });
  };

  const handleUpdateQA = () => {
    if (settingsQA.some(q => !q.ans.trim())) return toast({ variant: "destructive", title: "Errore", description: "Compila tutte le risposte." });
    setSavedQA(settingsQA);
    persistState(vaultPassword, settingsQA, savedEntropyKey, savedSignatures, vaultName);
    toast({ title: "Domande Aggiornate" });
  };

  const handleRegenerateKey = () => {
    if (!generatedKey) return;
    setSavedEntropyKey(generatedKey);
    persistState(vaultPassword, savedQA, generatedKey, savedSignatures, vaultName);
    setGeneratedKey(null);
    entropyBuffer.current = [];
    toast({ title: "Chiave Rigenerata", description: "La vecchia chiave non è più valida." });
  };

  // --- Entropy Logic ---

  // Fading Trail Effect
  useEffect(() => {
    // Run effect if in setup step 2 OR if settings modal is open and regenerating key
    const isRegeneratingInSettings = showSettings && !generatedKey; // Simplified check
    const shouldRun = (setupStep === 2 && !generatedKey) || (showSettings && !generatedKey && canvasRef.current);

    if (!shouldRun) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let animationFrameId: number;

    const render = () => {
      if (canvas && ctx) {
        // Fade out existing content
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; // Adjust for trail length
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [setupStep, generatedKey, showSettings]);

  const handleEntropyMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (generatedKey) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const t = performance.now();

    // Draw
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const speed = lastEntropyPoint.current ? lastEntropyPoint.current.v : 0;
      const hue = Math.min(120, speed * 20); // Color based on speed
      ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      if (lastEntropyPoint.current) {
        ctx.beginPath();
        ctx.moveTo(lastEntropyPoint.current.x, lastEntropyPoint.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }

    if (!lastEntropyPoint.current) {
      lastEntropyPoint.current = { x, y, t, v: 0 };
      return;
    }

    const dt = t - lastEntropyPoint.current.t;
    if (dt === 0) return;

    const dx = x - lastEntropyPoint.current.x;
    const dy = y - lastEntropyPoint.current.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const v = dist / dt;
    const dv = v - lastEntropyPoint.current.v;
    const a = dv / dt;
    const angle = Math.atan2(dy, dx);
    
    let angleChange = 0;
    if (lastEntropyPoint.current.angle !== undefined) {
        let diff = angle - lastEntropyPoint.current.angle;
        while (diff <= -Math.PI) diff += Math.PI*2;
        while (diff > Math.PI) diff -= Math.PI*2;
        angleChange = Math.abs(diff * 180 / Math.PI);
    }

    const point = { x, y, t, v, a, angle, angleChange };
    entropyBuffer.current.push(point);
    lastEntropyPoint.current = point;

    // Update stats every 10 samples to avoid lag
    if (entropyBuffer.current.length % 10 === 0) {
      const samples = entropyBuffer.current.length;
      
      // Simple Chaos Calc
      let sharpTurns = 0;
      let velocityVar = 0;
      let vSum = 0;
      
      // Analyze last 500 points for responsiveness
      const subset = entropyBuffer.current.slice(-500);
      subset.forEach(p => {
        if (p.angleChange > 30) sharpTurns++;
        vSum += p.v;
      });
      const vMean = vSum / subset.length;
      subset.forEach(p => velocityVar += Math.pow(p.v - vMean, 2));
      
      const chaos = Math.min(100, Math.floor((sharpTurns / subset.length * 200) + (velocityVar * 10)));
      setEntropyStats({ samples, chaos });
    }
  };

  const generateEntropyKey = async () => {
    const data = JSON.stringify(entropyBuffer.current);
    const key = await generateSecureHash(data);
    setGeneratedKey(key);
    entropyBuffer.current = []; // Destroy raw data
  };

  const handleInteractionStart = () => {
    entropyBuffer.current.push({type: 'start', t: performance.now()});
    lastEntropyPoint.current = null;
  };

  const handleInteractionEnd = () => {
    entropyBuffer.current.push({type: 'end', t: performance.now()});
    lastEntropyPoint.current = null;
  };

  // --- Import / Export Vault ---

  const handleExportVault = async () => {
    if (!isUnlocked) return;
    const vaultData = {
      type: "fileforge-vault",
      version: 1,
      // pwd: vaultPassword, // RIMOSSO: Non salviamo più la password nel file
      qa: savedQA,
      key: savedEntropyKey,
      signatures: savedSignatures,
      name: vaultName
    };
    
    // Cifra i dati prima del salvataggio
    const encryptedData = await encryptVault(vaultData, vaultPassword!);
    
    const blob = new Blob([encryptedData], { type: "application/json" });
    const safeName = vaultName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    saveFile(blob, `${safeName}-${Date.now()}.vault`);
    toast({ title: "Backup Creato", description: "File .vault salvato." });
  };

  const handleImportVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const fileContent = ev.target?.result as string;
        const parsed = JSON.parse(fileContent);
        
        // Verifica se è un file cifrato (V2) o legacy
        if (parsed.v === 2 || parsed.kdf) {
          // File cifrato: Richiede password per sbloccare
          setPendingImportData(fileContent);
          setIsUnlocked(false);
          toast({ title: "Vault Cifrato", description: "Inserisci la password del vault importato per decifrarlo." });
        } else {
          // Legacy (V1 - Non sicuro o Fallback)
          const content = parsed.kdf === "none" ? JSON.parse(atob(parsed.data)) : parsed;
          
          if (content.type !== "fileforge-vault") throw new Error("Formato non valido");
          
          setVaultPassword(content.pwd || "password"); // Fallback per vecchi file
          setSavedQA(content.qa);
          setSavedEntropyKey(content.key || null);
          setSavedSignatures(content.signatures);
          if (content.name) {
            setVaultName(content.name);
            onNameChange(id, content.name);
          }
          
          persistState(content.pwd || "password", content.qa, content.key || null, content.signatures, content.name || vaultName);
          setIsUnlocked(false);
          toast({ title: "Vault Importato", description: "Sblocca per accedere." });
        }
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Errore", description: "File vault corrotto o non valido." });
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  // --- Render ---

  // Se non è attivo, lo nascondiamo con CSS per preservare lo stato (password inserita, ecc.)
  if (!isActive) return <div className="hidden" />;

  if (!vaultPassword) {
    // Setup Mode
    return (
      <div className="space-y-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
        <div className="flex items-center justify-between text-slate-700 font-semibold">
          <div className="flex items-center gap-2"><Shield className="w-5 h-5" /> Configurazione Vault</div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={() => onClose(id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600">
              <X size={16} />
            </Button>
          )}
        </div>
        
        {setupStep === 0 ? (
          pendingImportData ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Vault cifrato rilevato. Inserisci la password per decifrarlo e importarlo.</p>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password del Vault Importato"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="pr-10"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <Button onClick={handleUnlock} className="w-full">Decifra e Importa</Button>
              <Button variant="ghost" size="sm" onClick={() => { setPendingImportData(null); setPasswordInput(""); }} className="w-full text-xs text-muted-foreground">
                Annulla
              </Button>
            </div>
          ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Crea una password per proteggere le tue firme.</p>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nuova Password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="pr-10"
              />
              <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-muted-foreground">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Input type="password" placeholder="Conferma Password" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
            <Button onClick={handleSetup} className="w-full">Continua</Button>

            <div className="relative mt-4">
               <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
               <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-2 text-muted-foreground">Oppure</span></div>
            </div>

            <div className="relative">
                <input type="file" accept=".vault" onChange={handleImportVault} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Button variant="outline" className="w-full gap-2"><FileUp size={16} /> Ripristina Backup Vault</Button>
            </div>
          </div>
          )
        ) : setupStep === 1 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Imposta domande di sicurezza per il recupero.</p>
            {setupQA.map((q, i) => (
              <div key={i} className="space-y-1">
                <Select value={q.id} onValueChange={(v) => {
                  const n = [...setupQA]; n[i].id = v; setSetupQA(n);
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{SECURITY_QUESTIONS.map(sq => <SelectItem key={sq.id} value={sq.id}>{sq.text}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Risposta" value={q.ans} onChange={(e) => {
                  const n = [...setupQA]; n[i].ans = e.target.value; setSetupQA(n);
                }} className="h-8 text-xs" />
              </div>
            ))}
            <Button onClick={handleSetup} className="w-full">Salva Configurazione</Button>
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-700">
              <Activity size={16} /> Entropia Crittografica
            </div>
            <p className="text-xs text-muted-foreground">
              Muovi il mouse nell'area sottostante per generare una chiave privata sicura basata sul caos del movimento.
            </p>
            
            {!generatedKey ? (
              <div className="space-y-3">
                <div className="relative rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/50 overflow-hidden h-40 cursor-crosshair">
                  <canvas 
                    ref={canvasRef}
                    width={400}
                    height={160}
                    className="w-full h-full touch-none"
                    onMouseMove={handleEntropyMove}
                    onTouchMove={handleEntropyMove}
                    onMouseEnter={handleInteractionStart}
                    onTouchStart={handleInteractionStart}
                    onMouseLeave={handleInteractionEnd}
                    onTouchEnd={handleInteractionEnd}
                  />
                  {entropyStats.samples === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-purple-300 pointer-events-none">
                      <MousePointer2 size={48} className="animate-bounce opacity-50" />
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-100 p-2 rounded">
                    <span className="text-muted-foreground">Campioni:</span> 
                    <span className={cn("font-bold ml-1", entropyStats.samples >= 1500 ? "text-green-600" : "text-orange-500")}>{entropyStats.samples}/1500</span>
                  </div>
                  <div className="bg-slate-100 p-2 rounded">
                    <span className="text-muted-foreground">Caos:</span> 
                    <span className={cn("font-bold ml-1", entropyStats.chaos >= 25 ? "text-green-600" : "text-orange-500")}>{entropyStats.chaos}%/25%</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => handleSetup()} className="flex-1 text-xs">Salta</Button>
                  <Button 
                    onClick={generateEntropyKey} 
                    disabled={entropyStats.samples < 1500 || entropyStats.chaos < 25}
                    className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Genera Chiave
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-green-50 p-3 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 text-green-800 text-xs font-bold"><Check size={14}/> Chiave Generata (SHA-256)</div>
                <div className="bg-white p-2 rounded border text-[10px] font-mono break-all text-slate-600 select-all">
                  {generatedKey}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedKey); toast({title: "Copiato!"}); }} className="flex-1 gap-2">
                    <Copy size={14} /> Copia
                  </Button>
                  <Button size="sm" onClick={handleSetup} className="flex-1">
                    Fine e Salva
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!isUnlocked) {
    // Locked Mode
    return (
      <div className="space-y-4 p-4 bg-slate-50 rounded-xl border animate-in fade-in">
        <div className="flex items-center justify-between text-slate-700 font-semibold">
          <div className="flex items-center gap-2"><Lock className="w-5 h-5" /> {vaultName} (Bloccato)</div>
          <div className="flex gap-1">
            {isRecovering && <Button variant="ghost" size="sm" onClick={() => setIsRecovering(false)} className="h-6 text-xs mr-1">Annulla</Button>}
            {onClose && (
                <Button variant="ghost" size="sm" onClick={() => onClose(id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600">
                <X size={16} />
                </Button>
            )}
          </div>
        </div>

        {!isRecovering ? (
          <div className="space-y-3">
            <Input 
              type="password" 
              placeholder={pendingImportData ? "Password del Vault Importato" : "Inserisci Password"} 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
            />
            <Button onClick={handleUnlock} className="w-full">{pendingImportData ? "Decifra e Importa" : "Sblocca"}</Button>
            <div className="flex justify-between text-xs pt-2">
              {pendingImportData ? (
                <button onClick={() => { setPendingImportData(null); setPasswordInput(""); }} className="text-muted-foreground hover:text-primary hover:underline">Annulla importazione</button>
              ) : (
                <button onClick={() => setIsRecovering(true)} className="text-muted-foreground hover:text-primary hover:underline">Password dimenticata?</button>
              )}
              <div className="relative overflow-hidden">
                 <input type="file" accept=".vault" onChange={handleImportVault} className="absolute inset-0 opacity-0 cursor-pointer" />
                 <span className="text-muted-foreground hover:text-primary hover:underline cursor-pointer">Importa Backup</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-orange-50 p-3 rounded-lg border border-orange-100">
            <div className="flex items-center justify-between text-orange-800 text-xs font-bold mb-2">
              <div className="flex items-center gap-2"><HelpCircle size={14}/> Recupero Account</div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setRecoveryMethod("qa")} 
                  className={cn("px-2 py-0.5 rounded", recoveryMethod === "qa" ? "bg-orange-200" : "hover:bg-orange-100")}
                >Domande</button>
                <button 
                  onClick={() => setRecoveryMethod("key")} 
                  className={cn("px-2 py-0.5 rounded", recoveryMethod === "key" ? "bg-orange-200" : "hover:bg-orange-100")}
                >Chiave</button>
              </div>
            </div>

            {recoveryMethod === "qa" ? (
              <>
                {savedQA?.map((q, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-muted-foreground mb-1">{SECURITY_QUESTIONS.find(sq => sq.id === q.id)?.text}</p>
                    <Input value={recoveryAnswers[i]} onChange={(e) => {
                      const n = [...recoveryAnswers]; n[i] = e.target.value; setRecoveryAnswers(n);
                    }} className="h-8 text-xs bg-white" placeholder="Risposta..." />
                  </div>
                ))}
                <Button onClick={handleRecovery} variant="destructive" className="w-full h-8 text-xs mt-2">Resetta Password</Button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Inserisci la tua chiave di entropia (SHA-256) per sbloccare o resettare.</p>
                <textarea 
                  value={recoveryKeyInput}
                  onChange={(e) => setRecoveryKeyInput(e.target.value)}
                  className="w-full h-20 p-2 text-[10px] font-mono border rounded bg-white resize-none"
                  placeholder="Incolla la tua chiave qui..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleUnlockWithKey} className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700">Sblocca</Button>
                  <Button onClick={handleRecovery} variant="destructive" className="flex-1 h-8 text-xs">Resetta Pwd</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Unlocked Mode
  return (
    <div className="space-y-4 p-4 bg-white rounded-xl border shadow-sm animate-in fade-in">
      <div className="flex items-center justify-between border-b pb-2">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-1 mr-2">
            <Input 
              value={vaultName} 
              onChange={(e) => setVaultName(e.target.value)} 
              className="h-7 text-sm font-bold" 
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveVaultName}><Check size={14}/></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700 font-semibold group cursor-pointer" onClick={() => setIsEditingName(true)}>
            <Unlock className="w-5 h-5" /> 
            <span className="truncate max-w-[150px]">{vaultName}</span>
            <Edit2 size={12} className="opacity-0 group-hover:opacity-50" />
          </div>
        )}
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setShowSettings(true); setSettingsQA(savedQA || []); }} title="Impostazioni Vault" className="h-7 w-7 text-slate-600">
            <Settings size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleExportVault} title="Esporta Backup Vault" className="h-7 w-7">
            <FileDown size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsUnlocked(false)} title="Blocca" className="h-7 w-7 text-slate-500">
            <Lock size={14} />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={() => onClose(id)} title="Chiudi Vault" className="h-7 w-7 text-red-500 hover:bg-red-50">
                <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Save Current Signature Section */}
      {signatureToSave && (
        <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
          <span className="text-xs font-bold text-muted-foreground">Salva firma corrente</span>
          <div className="flex gap-2">
            <Input 
              placeholder="Titolo (es. Sigla)" 
              value={newSigTitle} 
              onChange={(e) => setNewSigTitle(e.target.value)} 
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={handleSaveSignature} className="shrink-0">
              <Save size={14} className="mr-1" /> Salva
            </Button>
          </div>
        </div>
      )}

      {/* Saved Signatures List */}
      <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
        {savedSignatures.length === 0 ? (
          <div className="col-span-2 text-center py-6 text-muted-foreground text-xs border-2 border-dashed rounded-lg">
            Nessuna firma salvata
          </div>
        ) : (
          savedSignatures.map((sig) => (
            <div 
              key={sig.id} 
              className="relative group rounded-lg border bg-slate-50 p-2 hover:border-primary hover:shadow-md transition-all cursor-pointer"
              onClick={() => onSelectSignature(sig.data)}
            >
              <div className="aspect-[2/1] flex items-center justify-center overflow-hidden bg-white rounded border border-slate-100 mb-1">
                <img src={sig.data} alt={sig.title} className="max-w-full max-h-full object-contain" />
              </div>
              
              {editingSigId === sig.id ? (
                <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                  <Input 
                    value={editSigTitle} 
                    onChange={(e) => setEditSigTitle(e.target.value)} 
                    className="h-6 text-[10px] px-1"
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 shrink-0" onClick={() => handleRenameSignature(sig.id)}>
                    <Check size={10} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 shrink-0" onClick={() => setEditingSigId(null)}>
                    <X size={10} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] font-bold truncate text-slate-600 flex-1">{sig.title}</p>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditingSigId(sig.id); setEditSigTitle(sig.title); }} className="p-1 text-slate-400 hover:text-blue-600">
                      <Edit2 size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(sig.id); }} className="p-1 text-slate-400 hover:text-red-600">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Impostazioni Vault</DialogTitle>
            <DialogDescription>Modifica le credenziali e la sicurezza del tuo archivio.</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="pwd" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pwd">Password</TabsTrigger>
              <TabsTrigger value="qa">Domande</TabsTrigger>
              <TabsTrigger value="key">Chiave</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pwd" className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Vecchia Password</Label>
                <Input type="password" value={settingsOldPwd} onChange={(e) => setSettingsOldPwd(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Nuova Password</Label>
                <Input type="password" value={settingsNewPwd} onChange={(e) => setSettingsNewPwd(e.target.value)} />
              </div>
              <Button onClick={handleUpdatePassword} className="w-full mt-2">Aggiorna Password</Button>
            </TabsContent>
            
            <TabsContent value="qa" className="space-y-3 py-2">
              {settingsQA.map((q, i) => (
                <div key={i} className="space-y-1">
                  <Select value={q.id} onValueChange={(v) => {
                    const n = [...settingsQA]; n[i].id = v; setSettingsQA(n);
                  }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{SECURITY_QUESTIONS.map(sq => <SelectItem key={sq.id} value={sq.id}>{sq.text}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={q.ans} onChange={(e) => {
                    const n = [...settingsQA]; n[i].ans = e.target.value; setSettingsQA(n);
                  }} className="h-8 text-xs" />
                </div>
              ))}
              <Button onClick={handleUpdateQA} className="w-full mt-2">Salva Domande</Button>
            </TabsContent>
            
            <TabsContent value="key" className="space-y-3 py-2">
              <div className="bg-slate-50 p-3 rounded border text-xs font-mono break-all">
                {savedEntropyKey || "Nessuna chiave generata."}
              </div>
              <Button variant="outline" size="sm" onClick={() => { if(savedEntropyKey) navigator.clipboard.writeText(savedEntropyKey); toast({title: "Copiata"}); }} className="w-full gap-2">
                <Copy size={14} /> Copia Chiave Corrente
              </Button>
              
              <div className="relative rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/50 overflow-hidden h-32 cursor-crosshair mt-4">
                  {!generatedKey ? (
                    <>
                      <canvas 
                        ref={canvasRef}
                        width={400}
                        height={128}
                        className="w-full h-full touch-none"
                        onMouseMove={handleEntropyMove}
                        onTouchMove={handleEntropyMove}
                        onMouseEnter={handleInteractionStart}
                        onTouchStart={handleInteractionStart}
                        onMouseLeave={handleInteractionEnd}
                        onTouchEnd={handleInteractionEnd}
                      />
                      <div className="absolute top-2 right-2 text-[10px] bg-white/80 px-2 rounded pointer-events-none">
                        {entropyStats.samples}/1500
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-green-50/90 text-green-700 font-bold">
                      Nuova Chiave Pronta!
                    </div>
                  )}
              </div>
              <Button 
                onClick={handleRegenerateKey} 
                disabled={!generatedKey}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> Sostituisci Chiave
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Main Manager Component ---

interface SignatureVaultProps {
  onSelectSignature: (imgData: string) => void;
  signatureToSave?: string | null;
  onSignatureSaved?: () => void;
}

export function SignatureVault(props: SignatureVaultProps) {
  const [tabs, setTabs] = useState<{ id: string; name: string; type: 'local' | 'session' }[]>([
    { id: 'local', name: 'Il Mio Vault', type: 'local' }
  ]);
  const [activeTabId, setActiveTabId] = useState('local');
  const [vaultToClose, setVaultToClose] = useState<string | null>(null);

  const handleAddTab = () => {
    if (tabs.length >= 3) {
      toast({ variant: "destructive", title: "Limite Raggiunto", description: "Puoi aprire massimo 3 vault contemporaneamente." });
      return;
    }
    const newId = `session-${Date.now()}`;
    setTabs([...tabs, { id: newId, name: 'Nuovo Vault', type: 'session' }]);
    setActiveTabId(newId);
  };

  const handleCloseRequest = (id: string) => {
    setVaultToClose(id);
  };

  const confirmClose = () => {
    if (!vaultToClose) return;
    const newTabs = tabs.filter(t => t.id !== vaultToClose);
    setTabs(newTabs);
    if (activeTabId === vaultToClose) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
    setVaultToClose(null);
    toast({ title: "Vault Chiuso", description: "La sessione è stata terminata." });
  };

  const updateTabName = useCallback((id: string, name: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-colors min-w-[100px] max-w-[150px]",
              activeTabId === tab.id 
                ? "bg-white border-primary text-primary shadow-sm" 
                : "bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200"
            )}
          >
            <span className="truncate flex-1 text-left">{tab.name}</span>
            {tab.type === 'session' && (
              <span 
                onClick={(e) => { e.stopPropagation(); handleCloseRequest(tab.id); }}
                className="opacity-50 hover:opacity-100 hover:text-red-500 p-0.5 rounded-full"
              >
                <X size={12} />
              </span>
            )}
          </button>
        ))}
        
        {tabs.length < 3 && (
          <button 
            onClick={handleAddTab}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
            title="Apri nuovo vault"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Vault Panels */}
      <div className="relative">
        {tabs.map(tab => (
          <VaultPanel
            key={tab.id}
            id={tab.id}
            isActive={activeTabId === tab.id}
            persistenceKey={tab.type === 'local' ? 'fileforge_vault' : null}
            onNameChange={updateTabName}
            onClose={tab.type === 'session' ? handleCloseRequest : undefined}
            {...props}
          />
        ))}
      </div>

      {/* Close Confirmation Dialog */}
      <Dialog open={!!vaultToClose} onOpenChange={(open) => !open && setVaultToClose(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chiudere questo Vault?</DialogTitle>
            <DialogDescription>
              Se hai delle firme non salvate o non esportate in questo vault di sessione, andranno perse.
              Il vault locale rimane sempre salvato.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVaultToClose(null)}>Annulla</Button>
            <Button onClick={confirmClose} variant="destructive">
              Chiudi Vault
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
