"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
        <div className="rounded-xl border bg-card p-6 shadow-lg text-center max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">Si è verificato un errore critico</h2>
          <p className="text-sm text-muted-foreground mb-4">Il sistema ha riscontrato un problema di caricamento.</p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}