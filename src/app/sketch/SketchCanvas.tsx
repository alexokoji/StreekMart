"use client";

import { useEffect, useRef, useState } from "react";
import { Garments, type Garment } from "@/lib/enums";

const COLORS = ["#111111", "#b9881e", "#6b1a2a", "#0b6e4f", "#3b82f6", "#ec4899", "#a3a3a3", "#ffffff"];
const SIZES = [2, 4, 8, 14];

// Controlled canvas. The parent owns `title` and `garment` state; this
// component owns the canvas pixels and emits a fresh dataURL via
// `onSnapshot` after each stroke so the 3D viewer can pick it up.
//
// The canvas is fixed at 1024×1024 internally (square texture, good for
// mapping onto cylinder/cone primitives) but rendered smaller via CSS so it
// no longer dominates the page.
export function SketchCanvas({
  title,
  setTitle,
  garment,
  setGarment,
  onSnapshot,
  onSave,
  saving,
}: {
  title: string;
  setTitle: (s: string) => void;
  garment: Garment;
  setGarment: (g: Garment) => void;
  onSnapshot: (dataUrl: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(4);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    onSnapshot(c.toDataURL("image/png"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const c = canvasRef.current;
    if (c) onSnapshot(c.toDataURL("image/png"));
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    onSnapshot(c.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-ink-900" : "border-ink-200"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSize(s)}
              className={`rounded-md border px-2 py-1 text-xs ${size === s ? "border-gold-500 bg-gold-50 text-gold-700" : "border-ink-200 text-ink-700"}`}
            >
              {s}px
            </button>
          ))}
        </div>
        <button type="button" onClick={clear} className="btn-secondary text-xs">Clear</button>
      </div>

      {/* Centered, capped width — no longer takes the whole row. */}
      <div className="mx-auto w-full max-w-xl">
        <canvas
          ref={canvasRef}
          width={1024}
          height={1024}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="aspect-square w-full cursor-crosshair touch-none rounded-lg border border-ink-200 bg-white"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <input
          className="input"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="input"
          value={garment}
          onChange={(e) => setGarment(e.target.value as Garment)}
          aria-label="Garment type"
        >
          {Garments.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <button type="button" className="btn-gold" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save sketch"}
        </button>
      </div>
      <p className="text-[11px] text-ink-500">
        Tag the garment — the 3D Mockup tab wraps your drawing onto a matching mannequin.
      </p>
    </div>
  );
}
