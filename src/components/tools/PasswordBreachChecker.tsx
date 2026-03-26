"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye, EyeOff, ShieldAlert, ShieldCheck, AlertTriangle,
  ChevronDown, ChevronUp, Lock, Cpu, Server, CheckCircle2,
  AlertCircle, Loader2, Info, ArrowLeft,
} from "lucide-react";

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function sha1Hex(text: string): Promise<string> {
  const data   = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function checkHibp(password: string): Promise<number> {
  const hash   = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" }, // pads response for extra privacy
  });

  if (!res.ok) {
    throw new Error(`Errore API Have I Been Pwned (${res.status}). Riprova tra qualche secondo.`);
  }

  const body = await res.text();
  for (const line of body.split("\n")) {
    const [lineSuffix, countStr] = line.split(":");
    if (lineSuffix?.trim().toUpperCase() === suffix) {
      return parseInt(countStr?.trim() ?? "0", 10);
    }
  }
  return 0;
}

// ─── Password strength ────────────────────────────────────────────────────────

interface Strength { score: number; label: string; barColor: string; textColor: string }

function getStrength(pwd: string): Strength {
  if (!pwd) return { score: 0, label: "", barColor: "", textColor: "" };
  let score = 0;
  if (pwd.length >= 8)         score++;
  if (pwd.length >= 14)        score++;
  if (/[A-Z]/.test(pwd))       score++;
  if (/[0-9]/.test(pwd))       score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { score, label: "Molto debole",  barColor: "bg-red-500",     textColor: "text-red-600" };
  if (score <= 2) return { score, label: "Debole",         barColor: "bg-orange-500",  textColor: "text-orange-600" };
  if (score <= 3) return { score, label: "Discreta",       barColor: "bg-yellow-400",  textColor: "text-yellow-600" };
  if (score <= 4) return { score, label: "Forte",          barColor: "bg-green-500",   textColor: "text-green-600" };
  return             { score, label: "Molto forte",    barColor: "bg-emerald-500", textColor: "text-emerald-600" };
}

// ─── Result helpers ───────────────────────────────────────────────────────────

type CheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; count: number }
  | { status: "error"; message: string };

function formatCount(n: number): string {
  return n.toLocaleString("it-IT");
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { onBack?: () => void }

export function PasswordBreachChecker({ onBack }: Props) {
  const [password,    setPassword]    = useState("");
  const [showPwd,     setShowPwd]     = useState(false);
  const [state,       setState]       = useState<CheckState>({ status: "idle" });
  const [showHowTo,   setShowHowTo]   = useState(false);

  const strength = getStrength(password);

  // ── Check ────────────────────────────────────────────────────────────────

  const handleCheck = useCallback(async () => {
    if (!password) return;
    setState({ status: "loading" });
    try {
      const count = await checkHibp(password);
      setState({ status: "done", count });
    } catch (e: unknown) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Errore sconosciuto." });
    }
  }, [password]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCheck();
  };

  // ── Result panel ──────────────────────────────────────────────────────────

  const renderResult = () => {
    if (state.status === "idle") return null;

    if (state.status === "loading") {
      return (
        <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-5">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <div>
            <p className="font-semibold text-sm">Verifica in corso…</p>
            <p className="text-xs text-muted-foreground">Interrogazione database Have I Been Pwned</p>
          </div>
        </div>
      );
    }

    if (state.status === "error") {
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-5">
          <AlertCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">Impossibile completare la verifica</p>
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">{state.message}</p>
          </div>
        </div>
      );
    }

    const { count } = state;

    if (count === 0) {
      return (
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-2.5">
              <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">Password sicura</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Non trovata in nessuna violazione di dati nota</p>
            </div>
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">
            Questa password non è presente nei database di violazioni di Have I Been Pwned. Questo non garantisce la sicurezza assoluta, ma è un ottimo segnale. Assicurati di non usarla su più siti.
          </p>
        </div>
      );
    }

    const isCritical = count > 10_000;
    const isHigh     = count > 100;

    const borderColor = isCritical ? "border-red-300 dark:border-red-800"
                       : isHigh    ? "border-orange-300 dark:border-orange-800"
                       :             "border-yellow-300 dark:border-yellow-800";
    const bgColor     = isCritical ? "bg-red-50 dark:bg-red-950/30"
                       : isHigh    ? "bg-orange-50 dark:bg-orange-950/30"
                       :             "bg-yellow-50 dark:bg-yellow-950/30";
    const iconColor   = isCritical ? "text-red-600 dark:text-red-400"
                       : isHigh    ? "text-orange-600 dark:text-orange-400"
                       :             "text-yellow-600 dark:text-yellow-400";
    const textColor   = isCritical ? "text-red-800 dark:text-red-300"
                       : isHigh    ? "text-orange-800 dark:text-orange-300"
                       :             "text-yellow-800 dark:text-yellow-300";
    const subColor    = isCritical ? "text-red-700 dark:text-red-400"
                       : isHigh    ? "text-orange-700 dark:text-orange-400"
                       :             "text-yellow-700 dark:text-yellow-400";

    return (
      <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} p-6 space-y-3`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-full bg-white/60 dark:bg-black/20 p-2.5`}>
            <ShieldAlert className={`h-7 w-7 ${iconColor}`} />
          </div>
          <div>
            <p className={`font-bold text-lg ${textColor}`}>
              {isCritical ? "Violazione critica" : "Password compromessa"}
            </p>
            <p className={`text-xs ${subColor}`}>
              Trovata <strong>{formatCount(count)} volte</strong> nei database di violazioni di dati
            </p>
          </div>
        </div>

        <div className={`rounded-xl bg-white/50 dark:bg-black/20 px-4 py-3 text-sm ${textColor} space-y-1`}>
          <p className="font-semibold">Cosa significa?</p>
          <p className={`text-xs leading-relaxed ${subColor}`}>
            Questa password è stata esposta in {formatCount(count)} violazioni di dati e potrebbe
            essere presente nei database del dark web. Hacker e bot la testano automaticamente
            su migliaia di siti.
          </p>
        </div>

        <div className={`text-xs ${subColor} space-y-1`}>
          <p className="font-semibold">Cosa fare adesso:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            <li>Cambia immediatamente questa password su tutti i siti dove la usi</li>
            <li>Usa il <span className="font-semibold">Generatore Password</span> per crearne una sicura</li>
            <li>Attiva l'autenticazione a due fattori (2FA) dove possibile</li>
            <li>Non riusare mai la stessa password su più servizi</li>
          </ul>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
        </Button>
      )}

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-red-900 p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Verifica Password Dark Web</h2>
            <p className="text-sm text-white/70">Controlla se la tua password è stata violata e venduta nel dark web</p>
          </div>
        </div>
      </div>

      {/* Privacy guarantee — ALWAYS VISIBLE */}
      <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Garanzia Privacy — La tua password non viene mai trasmessa</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PrivacyPill
            icon={<Cpu className="h-4 w-4" />}
            title="Elaborazione locale"
            desc="L'hash SHA-1 viene calcolato sul tuo dispositivo, non su un server"
          />
          <PrivacyPill
            icon={<Server className="h-4 w-4" />}
            title="Solo 5 caratteri inviati"
            desc="All'API viene inviato solo il prefisso dell'hash (es. «A3B4C»), mai la password"
          />
          <PrivacyPill
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Verifica offline"
            desc="Il confronto avviene localmente: il server non sa mai cosa stai cercando"
          />
        </div>
        <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-3">
          Nessun log, nessun cookie, nessun database interno. Non salviamo né condividiamo nulla. La tecnologia usata è <strong>k-anonymity</strong> di <a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Have I Been Pwned™</a>, lo stesso standard usato da Google Chrome e Firefox.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-2xl border bg-white/50 dark:bg-card/50 p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Password da verificare
          </label>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              placeholder="Inserisci la password da controllare"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setState({ status: "idle" }); }}
              onKeyDown={handleKeyDown}
              className="pr-10 font-mono text-base"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPwd ? "Nascondi password" : "Mostra password"}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Strength bar */}
          {password && (
            <div className="space-y-1">
              <div className="flex h-1.5 gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.barColor : "bg-muted"}`}
                  />
                ))}
              </div>
              <p className={`text-xs font-semibold ${strength.textColor}`}>{strength.label}</p>
            </div>
          )}
        </div>

        <Button
          onClick={handleCheck}
          disabled={!password || state.status === "loading"}
          className="w-full bg-gradient-to-br from-gray-800 to-red-800 hover:from-gray-900 hover:to-red-900 text-white font-bold"
        >
          {state.status === "loading"
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifica in corso…</>
            : <><ShieldAlert className="h-4 w-4 mr-2" /> Verifica nel Dark Web</>
          }
        </Button>

        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          La password rimane sul tuo dispositivo. Non viene mai inviata.
        </p>
      </div>

      {/* Result */}
      {renderResult()}

      {/* How it works (collapsible) */}
      <div className="rounded-2xl border bg-white/50 dark:bg-card/50 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/40 transition-colors"
          onClick={() => setShowHowTo((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Come funziona la verifica k-anonymity?
          </span>
          {showHowTo ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showHowTo && (
          <div className="px-5 pb-5 space-y-3 border-t">
            <p className="text-xs text-muted-foreground pt-3">
              La tecnica <strong>k-anonymity</strong> garantisce che nemmeno Have I Been Pwned sappia quale password stai cercando.
            </p>
            {[
              {
                step: "1",
                color: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
                title: "Hash locale (SHA-1)",
                desc: 'La tua password viene convertita in un\'impronta digitale sul tuo dispositivo. Es: "password123" → "CBFDAC6008F9CAB4083784CBD1874F76618D2A97"',
              },
              {
                step: "2",
                color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                title: "Invio prefisso (solo 5 caratteri)",
                desc: 'All\'API viene inviato solo "CBFDA" — i restanti 35 caratteri rimangono sul tuo dispositivo. Il server non sa cosa stai cercando.',
              },
              {
                step: "3",
                color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
                title: "Risposta con migliaia di hash",
                desc: "Il server risponde con tutti gli hash che iniziano con quel prefisso (es. 600+ hash diversi) con i relativi conteggi di violazione.",
              },
              {
                step: "4",
                color: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300",
                title: "Verifica locale",
                desc: "Il tuo browser confronta localmente il tuo hash completo con la lista ricevuta. Solo tu conosci il risultato.",
              },
            ].map(({ step, color, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
                  {step}
                </div>
                <div>
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PrivacyPill({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/60 dark:bg-emerald-900/20 p-3">
      <div className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{title}</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
