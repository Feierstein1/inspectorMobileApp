"use client";

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from "react";

export type SignatureCanvasHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
  loadImage: (url: string) => Promise<void>;
};

type Props = {
  width?: number;
  height?: number;
  disabled?: boolean;
};

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, Props>(
  function SignatureCanvas({ width = 480, height = 160, disabled = false }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);
    const [empty, setEmpty] = useState(true);

    useImperativeHandle(ref, () => ({
      isEmpty: () => !hasDrawn.current,
      toDataURL: () => {
        const canvas = canvasRef.current;
        if (!canvas) return "";
        // Composite onto a white background so the PNG isn't transparent
        const flat = document.createElement("canvas");
        flat.width = canvas.width;
        flat.height = canvas.height;
        const ctx = flat.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, flat.width, flat.height);
        ctx.drawImage(canvas, 0, 0);
        return flat.toDataURL("image/png");
      },
      clear: () => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        hasDrawn.current = false;
        setEmpty(true);
      },
      loadImage: (url: string) => new Promise((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) return resolve();
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve();
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const dpr = window.devicePixelRatio || 1;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Draw scaled to the CSS dimensions so it fits the visible area
          ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
          hasDrawn.current = true;
          setEmpty(false);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      }),
    }));

    // Scale canvas for high-DPI screens
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, [width, height]);

    function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || disabled) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (!hasDrawn.current) {
        hasDrawn.current = true;
        setEmpty(false);
      }
    }

    function onPointerUp() {
      drawing.current = false;
    }

    return (
      <div className="space-y-2">
        <div
          className={`relative border-2 rounded-lg overflow-hidden bg-white ${
            disabled
              ? "border-gray-200 dark:border-gray-700"
              : "border-gray-300 dark:border-gray-600 cursor-crosshair"
          }`}
          style={{ width, height }}
        >
          <canvas
            ref={canvasRef}
            style={{ width, height, display: "block" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
          {empty && !disabled && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none select-none">
              Sign here
            </p>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              const ctx = canvasRef.current?.getContext("2d");
              if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              hasDrawn.current = false;
              setEmpty(true);
            }}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
          >
            Clear
          </button>
        )}
      </div>
    );
  }
);
