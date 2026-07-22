"use client";

import { useEffect, useRef, useState } from "react";

// frame-image.png is 1254x1254. The circular opening in the frame is centered
// at (626.5, 448.5) with radius 367.5 (measured directly from the source file).
const FRAME_SIZE = 1254;
const CIRCLE = { cx: 626.5, cy: 448.5, r: 367.5 };

export default function FrameMaker() {
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hasPhoto, setHasPhoto] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The source PNG has no real alpha in its "hole" (it's opaque off-white), so
  // it's punched out into a transparent circle on an offscreen canvas once,
  // then that canvas is drawn on top of the photo for every frame.
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragState = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
  }>({ dragging: false, startX: 0, startY: 0, startOffset: { x: 0, y: 0 } });

  // Load the frame overlay once and cut a transparent hole into it. The
  // source PNG has no real alpha in its "hole" (it's opaque off-white), and
  // the hole isn't a clean circle — the badge plate at the bottom overlaps
  // into it — so the hole is found by flood-filling from the center out to
  // wherever the color stops matching, rather than assuming circle geometry.
  useEffect(() => {
    const img = new Image();
    img.src = "/frame-image.png";
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = FRAME_SIZE;
      off.height = FRAME_SIZE;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.drawImage(img, 0, 0, FRAME_SIZE, FRAME_SIZE);

      const imageData = octx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE);
      const data = imageData.data;
      const w = FRAME_SIZE;
      const h = FRAME_SIZE;
      const cx = Math.round(CIRCLE.cx);
      const cy = Math.round(CIRCLE.cy);
      const seedIdx = (cy * w + cx) * 4;
      const seedR = data[seedIdx];
      const seedG = data[seedIdx + 1];
      const seedB = data[seedIdx + 2];
      const tol = 18;

      const visited = new Uint8Array(w * h);
      const stack = [cy * w + cx];
      visited[cy * w + cx] = 1;
      while (stack.length) {
        const p = stack.pop()!;
        const px = p % w;
        const py = (p - px) / w;
        const idx = p * 4;
        data[idx + 3] = 0;

        const neighbors = [
          [px + 1, py],
          [px - 1, py],
          [px, py + 1],
          [px, py - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const np = ny * w + nx;
          if (visited[np]) continue;
          const nIdx = np * 4;
          if (
            Math.abs(data[nIdx] - seedR) <= tol &&
            Math.abs(data[nIdx + 1] - seedG) <= tol &&
            Math.abs(data[nIdx + 2] - seedB) <= tol
          ) {
            visited[np] = 1;
            stack.push(np);
          }
        }
      }

      octx.putImageData(imageData, 0, 0);
      frameCanvasRef.current = off;
      draw();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseScale = photo
    ? Math.max((CIRCLE.r * 2) / photo.naturalWidth, (CIRCLE.r * 2) / photo.naturalHeight)
    : 1;

  function clampOffset(x: number, y: number, currentZoom: number) {
    if (!photo) return { x: 0, y: 0 };
    const drawW = photo.naturalWidth * baseScale * currentZoom;
    const drawH = photo.naturalHeight * baseScale * currentZoom;
    const maxX = Math.max(0, drawW / 2 - CIRCLE.r);
    const maxY = Math.max(0, drawH / 2 - CIRCLE.r);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);

    if (photo) {
      const drawW = photo.naturalWidth * baseScale * zoom;
      const drawH = photo.naturalHeight * baseScale * zoom;
      ctx.save();
      ctx.beginPath();
      ctx.arc(CIRCLE.cx, CIRCLE.cy, CIRCLE.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        photo,
        CIRCLE.cx - drawW / 2 + offset.x,
        CIRCLE.cy - drawH / 2 + offset.y,
        drawW,
        drawH
      );
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(CIRCLE.cx, CIRCLE.cy, CIRCLE.r, 0, Math.PI * 2);
      ctx.fillStyle = "#e5e7eb";
      ctx.fill();
      ctx.restore();
    }

    if (frameCanvasRef.current) {
      ctx.drawImage(frameCanvasRef.current, 0, 0, FRAME_SIZE, FRAME_SIZE);
    }
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, zoom, offset]);

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setHasPhoto(true);
    };
    img.src = url;
  }

  function toCanvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = FRAME_SIZE / rect.width;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!photo) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = toCanvasPoint(e.clientX, e.clientY);
    dragState.current = {
      dragging: true,
      startX: p.x,
      startY: p.y,
      startOffset: offset,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragState.current.dragging) return;
    const p = toCanvasPoint(e.clientX, e.clientY);
    const dx = p.x - dragState.current.startX;
    const dy = p.y - dragState.current.startY;
    const next = clampOffset(
      dragState.current.startOffset.x + dx,
      dragState.current.startOffset.y + dy,
      zoom
    );
    setOffset(next);
  }

  function onPointerUp() {
    dragState.current.dragging = false;
  }

  function handleZoomChange(value: number) {
    setZoom(value);
    setOffset((prev) => clampOffset(prev.x, prev.y, value));
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "maha-kumbh-dp.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-10">
      <div className="rounded-3xl border border-amber-200/70 bg-white shadow-xl shadow-amber-900/5 p-6 sm:p-8 flex flex-col items-center gap-7">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Maha Kumbh DP Maker
          </h1>
          <div className="mx-auto mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-amber-400 to-yellow-600" />
          <p className="text-sm text-slate-500 mt-3">
            Upload your photo, adjust it inside the circle, and download your frame.
          </p>
        </div>

        <div className="w-full max-w-[320px] aspect-square rounded-full overflow-hidden shadow-lg ring-4 ring-amber-100 select-none touch-none">
          <canvas
            ref={canvasRef}
            width={FRAME_SIZE}
            height={FRAME_SIZE}
            className={`w-full h-full ${photo ? "cursor-grab active:cursor-grabbing" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>

        <div className="w-full flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Your Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:text-white file:px-4 file:py-2.5 file:text-sm file:font-medium file:cursor-pointer hover:file:bg-slate-800 cursor-pointer"
            />
          </label>

          {hasPhoto && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </label>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasPhoto}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 font-semibold py-3 shadow-md shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none hover:from-amber-600 hover:to-yellow-700 transition-all"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
