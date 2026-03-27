/**
 * AvatarCropModal — canvas-based crop + zoom editor.
 * No dependencies. Works on mobile touch and desktop mouse.
 *
 * Usage:
 *   <AvatarCropModal
 *     imageSrc={blobUrl}
 *     onConfirm={(croppedBlob) => { ... }}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCw, Check, X } from "lucide-react";

interface Props {
  imageSrc: string;          // blob: URL of the selected image
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}

const OUTPUT_SIZE = 400; // canvas output px (square)

export default function AvatarCropModal({ imageSrc, onConfirm, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);

  // State
  const [zoom, setZoom]       = useState(1);       // 1 = fit, 3 = 3x
  const [offset, setOffset]   = useState({ x: 0, y: 0 }); // centre offset in image-space px
  const [rotation, setRotation] = useState(0);     // degrees (0/90/180/270)
  const [loaded, setLoaded]   = useState(false);

  // Drag state (mouse + touch)
  const dragging    = useRef(false);
  const lastPos     = useRef({ x: 0, y: 0 });
  const pinchStart  = useRef<{ dist: number; zoom: number } | null>(null);

  // ── Load image ─────────────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // ── Draw to canvas ─────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d")!;
    canvas.width  = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Rotate around centre
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Scale and offset
    // Compute how big the image should be when zoom=1 (fit the shorter side to OUTPUT_SIZE)
    const isRotated90 = rotation === 90 || rotation === 270;
    const imgW = isRotated90 ? img.height : img.width;
    const imgH = isRotated90 ? img.width  : img.height;
    const scale = (OUTPUT_SIZE / Math.min(imgW, imgH)) * zoom;

    const drawW = (isRotated90 ? img.height : img.width)  * scale;
    const drawH = (isRotated90 ? img.width  : img.height) * scale;

    ctx.drawImage(
      img,
      -drawW / 2 + offset.x,
      -drawH / 2 + offset.y,
      drawW,
      drawH
    );

    ctx.restore();

    // Circle border
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [zoom, offset, rotation]);

  useEffect(() => {
    if (loaded) draw();
  }, [loaded, draw]);

  // ── Mouse drag ─────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    // Convert screen px → image-space px (canvas is displayed at ~280px, output is 400px)
    const scale = OUTPUT_SIZE / (canvasRef.current?.clientWidth || 280);
    setOffset(o => ({ x: o.x + dx * scale, y: o.y + dy * scale }));
  };
  const onMouseUp = () => { dragging.current = false; };

  // ── Touch drag + pinch ─────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      lastPos.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const scale = OUTPUT_SIZE / (canvasRef.current?.clientWidth || 280);
      setOffset(o => ({ x: o.x + dx * scale, y: o.y + dy * scale }));
    } else if (e.touches.length === 2 && pinchStart.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newZoom = Math.min(4, Math.max(0.5, pinchStart.current.zoom * (dist / pinchStart.current.dist)));
      setZoom(newZoom);
    }
  };
  const onTouchEnd = () => {
    dragging.current  = false;
    pinchStart.current = null;
  };

  // ── Wheel zoom ─────────────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)));
  };

  // ── Confirm: export canvas as blob ─────────────────────────
  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Adjust photo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Drag to reposition · Pinch or slider to zoom</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas */}
        <div className="relative flex justify-center">
          {/* Guide circle overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="rounded-full border-2 border-white/30"
              style={{ width: "calc(100% - 24px)", aspectRatio: "1" }}
            />
          </div>
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              aspectRatio: "1",
              borderRadius: "50%",
              cursor: dragging.current ? "grabbing" : "grab",
              touchAction: "none",
              display: loaded ? "block" : "none",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
          />
          {!loaded && (
            <div className="w-full aspect-square rounded-full bg-muted/30 animate-pulse" />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <Slider
            min={50} max={400} step={1}
            value={[Math.round(zoom * 100)]}
            onValueChange={([v]) => setZoom(v / 100)}
            className="flex-1"
          />
          <button onClick={() => setZoom(z => Math.min(4, z + 0.1))}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={!loaded}>
            <Check className="w-4 h-4 mr-1.5" /> Use photo
          </Button>
        </div>
      </div>
    </div>
  );
}
