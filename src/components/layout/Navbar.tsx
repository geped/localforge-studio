
"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    const initialColorValue = root.classList.contains('dark');
    setIsDark(initialColorValue);
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-card/80 backdrop-blur-md transition-colors duration-300">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg text-white">
            <Boxes className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold font-headline tracking-tighter text-primary">
            FileForge
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme} 
            className="rounded-full w-10 h-10 hover:bg-muted"
            title={isDark ? "Passa a tema chiaro" : "Passa a tema scuro"}
          >
            {isDark ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-primary" />}
          </Button>
        </div>
      </div>
    </nav>
  );
}
