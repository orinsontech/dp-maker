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

  // Load the frame overlay once and cut it out to transparency. The source
  // PNG has no real alpha (it's opaque off-white both in the inner "hole"
  // and around the outside of the ring, out to the square corners), and the
  // hole isn't a clean circle — the badge plate at the bottom overlaps into
  // it — so each background region is found by flood-filling out from a
  // seed point to wherever the color stops matching, rather than assuming
  // circle geometry.
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
      const tol = 18;
      const visited = new Uint8Array(w * h);

      function floodFillTransparent(startX: number, startY: number) {
        const startP = startY * w + startX;
        if (visited[startP]) return;
        const seedIdx = startP * 4;
        const seedR = data[seedIdx];
        const seedG = data[seedIdx + 1];
        const seedB = data[seedIdx + 2];

        const stack = [startP];
        visited[startP] = 1;
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
      }

      // Inner hole (where the photo shows through).
      floodFillTransparent(Math.round(CIRCLE.cx), Math.round(CIRCLE.cy));
      // Outside the ring, in each of the square's four corners.
      floodFillTransparent(0, 0);
      floodFillTransparent(w - 1, 0);
      floodFillTransparent(0, h - 1);
      floodFillTransparent(w - 1, h - 1);

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
      ctx.fillStyle = "#1b2547";
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

    // The canvas has transparent corners outside the frame ring; flatten
    // onto a white background so the downloaded file has no transparency.
    const out = document.createElement("canvas");
    out.width = FRAME_SIZE;
    out.height = FRAME_SIZE;
    const octx = out.getContext("2d");
    if (!octx) return;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE);
    octx.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = "maha-kumbh-dp.png";
    link.href = out.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="w-full max-w-md lg:max-w-4xl mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <p className="text-[11px] font-semibold tracking-[0.4em] text-amber-400/80 uppercase">
          Pagariya JBN
        </p>
        <h1 className="mt-1 font-serif text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(217,164,65,0.35)]">
          Maha Kumbh
        </h1>
        <div className="mt-2.5 flex items-center justify-center gap-3 text-xs font-semibold tracking-[0.35em] text-amber-300/70 uppercase">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/50" />
          GT | Mumbai
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/50" />
        </div>
      </div>

      <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-b from-[#0d1836] to-[#0a1230] shadow-2xl shadow-black/50 p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row items-center lg:items-start gap-7 lg:gap-12">
        <div className="flex flex-col items-center gap-5 lg:flex-1">
          <p className="text-sm text-slate-300/80 text-center lg:hidden">
            Upload your photo, adjust it inside the circle, and download your Maha Kumbh DP.
          </p>

          <div className="w-full max-w-[320px] lg:max-w-[420px] aspect-square select-none touch-none">
            <canvas
              ref={canvasRef}
              width={FRAME_SIZE}
              height={FRAME_SIZE}
              className={`w-full h-full drop-shadow-[0_10px_35px_rgba(217,164,65,0.4)] ${photo ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>
        </div>

        <div className="w-full lg:flex-1 lg:pt-2 flex flex-col gap-4">
          <p className="hidden lg:block text-sm text-slate-300/80 -mt-1">
            Upload your photo, adjust it inside the circle, and download your Maha Kumbh DP.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-amber-100/90">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="border border-amber-400/20 rounded-xl px-3.5 py-2.5 bg-[#0b1330] text-sm text-amber-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-amber-100/90">Your Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="text-sm text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-amber-500 file:to-yellow-600 file:text-[#0a1230] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:cursor-pointer hover:file:brightness-110 cursor-pointer"
            />
          </label>

          {hasPhoto && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-amber-100/90">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
            </label>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasPhoto}
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0a1230] font-bold uppercase tracking-wide text-sm py-3.5 shadow-lg shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none hover:brightness-110 transition-all"
          >
            <span className="inline-flex items-center gap-2">
              <span className="opacity-70">✦</span> Download DP <span className="opacity-70">✦</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
