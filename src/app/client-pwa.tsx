"use client";

import { useEffect } from "react";

/**
 * Registra il Service Worker di FileForge.
 * Deve essere un componente client separato perché usa useEffect.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/fileforge/sw.js", { scope: "/fileforge/" })
      .catch((err) => {
        // Il SW non è critico — se fallisce l'app funziona comunque
        console.warn("[FileForge] Service Worker registration failed:", err);
      });
  }, []);

  return null;
}
