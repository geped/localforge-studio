// c:\Users\pedro\Desktop\FileForge\src\components\tools\helpers\signature-canvas.tsx

"use client";

import React, { useRef, useState, useImperativeHandle, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface SignatureCanvasRef {
  clear: () => void;
  toDataURL: () => string | null;
  isEmpty: () => boolean;
  getCanvas: () => HTMLCanvasElement | null;
}

interface SignatureCanvasProps {
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(
  ({ width = 600, height = 360, penColor = "#000000", penWidth = 4, className, onStart, onEnd }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          setHasDrawn(false);
        }
      },
      toDataURL: () => {
        if (!hasDrawn || !canvasRef.current) return null;
        return canvasRef.current.toDataURL("image/png");
      },
      isEmpty: () => !hasDrawn,
      getCanvas: () => canvasRef.current
    }));

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      let clientX, clientY;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      // Prevent scrolling on touch
      if ('touches' in e) {
        // e.preventDefault(); // Gestito da CSS touch-none solitamente, ma utile
      }
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      setIsDrawing(true);
      setHasDrawn(true);
      if (onStart) onStart();

      const { x, y } = getCoordinates(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      if (isDrawing) {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        ctx?.closePath();
        if (onEnd) onEnd();
      }
    };

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={cn("touch-none cursor-crosshair", className)}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    );
  }
);

SignatureCanvas.displayName = "SignatureCanvas";
