import { useCallback, useRef, useState, useEffect } from "react";
import { apiRequest, getToken } from "@/lib/queryClient";
import { Camera, X, Loader2, ImagePlus, Pencil, ZoomIn, ZoomOut, RotateCw, Check, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import AvatarCropModal from "@/components/AvatarCropModal";

// ─── Types ───────────────────────────────────────────────────
interface UploadedImage {
  imageId: string;
  previewUrl: string;   // local object URL for instant preview
  cdnUrl: string | null; // set after Cloudflare confirms
  uploading: boolean;
  error?: string;
}

interface ImageUploaderProps {
  value: string[];          // array of imageIds (what gets saved to DB)
  onChange: (imageIds: string[]) => void;
  maxImages?: number;
  label?: string;
  hint?: string;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
function buildCdnUrl(imageId: string): string {
  if (!imageId || imageId.startsWith("dev-") || imageId.startsWith("http")) return imageId;
  // Server returns the CF Images URL base; we append /<id>/public
  // But we can also derive it from the imageId directly if we know the account hash.
  // We use the /api/upload/image-url route to let the server build it.
  return "";
}

// ─── Component ───────────────────────────────────────────────
export default function ImageUploader({
  value,
  onChange,
  maxImages = 20,
  label = "Photos",
  hint,
  className,
}: ImageUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Sync internal state imageIds back to parent whenever images change
  const syncToParent = useCallback((imgs: UploadedImage[]) => {
    const ids = imgs
      .filter(img => !img.uploading && !img.error)
      // Prefer cdnUrl (full URL) so previews work without needing to reconstruct from key
      .map(img => img.cdnUrl || img.imageId)
      // Strip any temp IDs or blob URLs — these are session-only and break after reload.
      // Only persist actual URLs (http/https/data:) or clean imageIds (CF image keys).
      .filter(url => {
        if (!url) return false;
        if (url.startsWith("uploading-")) return false; // temp ID before upload completes
        if (url.startsWith("blob:")) return false;       // blob URL — only valid this session
        return true;
      });
    onChange(ids);
  }, [onChange]);

  // ── Upload a single file ──────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Images must be under 10 MB.", variant: "destructive" });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const tempId = `uploading-${Date.now()}-${Math.random()}`;

    // Add placeholder immediately for instant feedback
    setImages(prev => {
      if (prev.length >= maxImages) {
        toast({ title: "Photo limit reached", description: `Maximum ${maxImages} photos allowed.` });
        return prev;
      }
      const next = [...prev, { imageId: tempId, previewUrl, cdnUrl: null, uploading: true }];
      return next;
    });

    try {
      // Step 1: Get a Cloudflare direct upload URL from our server
      const urlRes = await apiRequest("POST", "/api/upload/direct-url", {
        metadata: { type: "listing" },
      });
      const { uploadUrl, imageId, devMode } = await urlRes.json();

      if (devMode || !uploadUrl) {
        // No Cloudflare — upload via proxy which returns a base64 data URL
        const token = getToken();
        const proxyForm = new FormData();
        proxyForm.append("file", file);
        proxyForm.append("metadata", JSON.stringify({ type: "listing" }));
        const proxyRes = await fetch("/api/upload/proxy", {
          method: "POST",
          body: proxyForm,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!proxyRes.ok) throw new Error(await proxyRes.text());
        const { imageId: proxyId, cdnUrl: dataUrl } = await proxyRes.json();
        setImages(prev => {
          const next = prev.map(img =>
            img.imageId === tempId
              ? { ...img, imageId: proxyId, uploading: false, cdnUrl: dataUrl || previewUrl }
              : img
          );
          syncToParent(next);
          return next;
        });
        return;
      }

      // Step 2: POST file directly to Cloudflare (bypasses our server)
      const formData = new FormData();
      formData.append("file", file);

      const cfRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!cfRes.ok) throw new Error("Cloudflare upload failed");

      // Step 3: Get public CDN URL
      const cdnRes = await apiRequest("GET", `/api/upload/image-url/${imageId}`);
      const { url: cdnUrl } = await cdnRes.json();

      setImages(prev => {
        const next = prev.map(img =>
          img.imageId === tempId
            ? { ...img, imageId, uploading: false, cdnUrl: cdnUrl || previewUrl }
            : img
        );
        syncToParent(next);
        return next;
      });
    } catch (err) {
      console.error("Upload error:", err);
      setImages(prev => {
        const next = prev.map(img =>
          img.imageId === tempId
            ? { ...img, uploading: false, error: "Upload failed" }
            : img
        );
        // Don't include failed images in parent value
        syncToParent(next.filter(i => !i.error));
        return next;
      });
      toast({ title: "Upload failed", description: "Could not upload image. Try again.", variant: "destructive" });
    }
  }, [maxImages, syncToParent, toast]);

  // ── Handle file selection ─────────────────────────────────
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const remaining = maxImages - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    toUpload.forEach(uploadFile);
  }, [images.length, maxImages, uploadFile]);

  // ── Remove image ──────────────────────────────────────────
  const removeImage = useCallback((imageId: string) => {
    setImages(prev => {
      const img = prev.find(i => i.imageId === imageId);
      if (img?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(img.previewUrl);
      const next = prev.filter(i => i.imageId !== imageId);
      syncToParent(next);
      return next;
    });
  }, [syncToParent]);

  // ── Drag & drop ───────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none">{label}</label>
          <span className="text-xs text-muted-foreground">{images.length}/{maxImages} photos</span>
        </div>
      )}

      {/* Drop zone — only shown when there's room */}
      {canAddMore && (
        <div
          data-testid="input-photo-upload"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/40 bg-secondary/30"
          )}
        >
          <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Drop photos here or click to upload</p>
          <p className="text-xs text-muted-foreground">Up to {maxImages} photos · JPG, PNG, HEIC, WEBP · Max 10 MB each</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
        data-testid="input-file-hidden"
      />

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <div
              key={img.imageId}
              data-testid={`img-upload-${idx}`}
              className="relative aspect-square rounded-lg overflow-hidden bg-secondary group"
            >
              {/* Preview */}
              <img
                src={img.cdnUrl || img.previewUrl}
                alt={`Upload ${idx + 1}`}
                className="w-full h-full object-cover"
              />

              {/* First image badge */}
              {idx === 0 && !img.uploading && (
                <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Cover
                </div>
              )}

              {/* Uploading overlay */}
              {img.uploading && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              )}

              {/* Error overlay */}
              {img.error && (
                <div className="absolute inset-0 bg-destructive/70 flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold px-1 text-center">{img.error}</span>
                </div>
              )}

              {/* Remove button — only when not uploading */}
              {!img.uploading && (
                <button
                  type="button"
                  data-testid={`button-remove-img-${idx}`}
                  onClick={() => removeImage(img.imageId)}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-destructive hover:text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Add more tile */}
          {canAddMore && images.length > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-add-more-photos"
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-secondary/30 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Camera className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Add</span>
            </button>
          )}
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Avatar Uploader (single photo, circular, with crop/zoom) ─
export interface AvatarUploaderProps {
  currentUrl?: string | null;
  onUpload: (imageId: string, previewUrl: string) => void;
  size?: number;
}

export function AvatarUploader({ currentUrl, onUpload, size = 80 }: AvatarUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]           = useState<string | null>(currentUrl || null);
  const [isUploading, setIsUploading]   = useState(false);
  const [cropSrc, setCropSrc]           = useState<string | null>(null); // triggers crop modal

  // Called when user picks a file — open crop modal first
  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const blobUrl = URL.createObjectURL(file);
    setCropSrc(blobUrl);
  };

  // Called when user confirms the crop — upload the cropped blob via server proxy
  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    const localPreview = URL.createObjectURL(blob);
    setPreview(localPreview);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      formData.append("metadata", JSON.stringify({ type: "avatar" }));

      // Use server proxy upload — avoids mobile CORS issues with direct CF uploads
      const token = getToken();
      const res = await fetch("/api/upload/proxy", {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser sets it with the correct multipart boundary
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error(await res.text());
      const { imageId, cdnUrl, devMode } = await res.json();

      // devMode: cdnUrl is a base64 data URL (no Cloudflare configured)
      // production: cdnUrl is the CF Images CDN URL
      // Either way, use cdnUrl if present, else fall back to the local blob preview
      onUpload(imageId, cdnUrl || localPreview);
      toast({ title: "Photo updated" });
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast({ title: "Upload failed", description: "Could not save your photo. Please try again.", variant: "destructive" });
      setPreview(currentUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="relative inline-block" style={{ width: size, height: size }}>
        {/* Circle avatar */}
        <div className="rounded-full overflow-hidden bg-secondary border-2 border-border w-full h-full">
          {preview ? (
            <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Camera className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Upload overlay — always visible on mobile, hover on desktop */}
        <button
          type="button"
          data-testid="button-upload-avatar"
          onClick={() => !isUploading && fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center
            opacity-100 sm:opacity-0 sm:hover:opacity-100 transition-opacity"
          aria-label="Change photo"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <Camera className="w-5 h-5 text-white" />
              <span className="text-[10px] text-white font-medium leading-none">Edit</span>
            </div>
          )}
        </button>

        {/* Edit badge — bottom-right corner (always visible) */}
        {!isUploading && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background"
            aria-label="Edit photo"
          >
            <Pencil className="w-3 h-3 text-white" />
          </button>
        )}

        {/* Hidden input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
        />
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onClose={() => setCropSrc(null)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Cover Crop Modal — landscape rectangular crop (3:1 banner)
// Drag to reposition, scroll/pinch to zoom, no circle clip.
// ─────────────────────────────────────────────────────────────
interface CoverCropModalProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
  aspectRatio?: number; // width/height — default 3 (banner). Use 16/9 for guide.
}

export function CoverCropModal({ imageSrc, onConfirm, onClose, aspectRatio = 3 }: CoverCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const OUT_W = 1200;
  const OUT_H = Math.round(OUT_W / aspectRatio);

  const [zoom, setZoom]         = useState(1);
  const [offset, setOffset]     = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const dragging   = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setLoaded(true); setOffset({ x: 0, y: 0 }); setZoom(1); setRotation(0); };
    img.src = imageSrc;
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = OUT_W; canvas.height = OUT_H;
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    const isRot90 = rotation === 90 || rotation === 270;
    const imgW = isRot90 ? img.height : img.width;
    const imgH = isRot90 ? img.width  : img.height;
    const scale = Math.max(OUT_W / imgW, OUT_H / imgH) * zoom;
    const dW = (isRot90 ? img.height : img.width)  * scale;
    const dH = (isRot90 ? img.width  : img.height) * scale;
    ctx.save();
    ctx.translate(OUT_W / 2, OUT_H / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -dW / 2 + offset.x, -dH / 2 + offset.y, dW, dH);
    ctx.restore();
  }, [zoom, offset, rotation, OUT_W, OUT_H]);

  useEffect(() => { if (loaded) draw(); }, [loaded, draw]);

  const onMouseDown = (e: React.MouseEvent) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const s = OUT_W / (canvasRef.current?.clientWidth || 480);
    setOffset(o => ({ x: o.x + (e.clientX - lastPos.current.x) * s, y: o.y + (e.clientY - lastPos.current.y) * s }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) { dragging.current = true; lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; pinchStart.current = { dist: Math.hypot(dx, dy), zoom }; }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging.current) {
      const s = OUT_W / (canvasRef.current?.clientWidth || 480);
      setOffset(o => ({ x: o.x + (e.touches[0].clientX - lastPos.current.x) * s, y: o.y + (e.touches[0].clientY - lastPos.current.y) * s }));
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && pinchStart.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setZoom(Math.min(4, Math.max(0.5, pinchStart.current.zoom * (d / pinchStart.current.dist))));
    }
  };
  const onTouchEnd = () => { dragging.current = false; pinchStart.current = null; };
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom(z => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001))); };
  const handleConfirm = () => { canvasRef.current?.toBlob(b => { if (b) onConfirm(b); }, "image/jpeg", 0.92); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Adjust cover photo</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Drag to reposition · Scroll or pinch to zoom</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Landscape preview canvas */}
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/20"
          style={{ aspectRatio: String(aspectRatio) }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", cursor: dragging.current ? "grabbing" : "grab", touchAction: "none", display: loaded ? "block" : "none" }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onWheel={onWheel}
          />
          {!loaded && <div className="w-full h-full bg-muted/30 animate-pulse" />}
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-3">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><ZoomOut className="w-4 h-4" /></button>
          <input type="range" min={50} max={400} step={1} value={Math.round(zoom * 100)}
            onChange={e => setZoom(Number(e.target.value) / 100)} className="flex-1 accent-primary h-1.5" />
          <button onClick={() => setZoom(z => Math.min(4, z + 0.1))} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Rotate 90°"><RotateCw className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={!loaded}><Check className="w-4 h-4 mr-1.5" /> Use photo</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cover Uploader — rectangular cover photo with landscape crop
// Drop-in replacement for AvatarUploader when shape = "cover"
// ─────────────────────────────────────────────────────────────
export interface CoverUploaderProps {
  currentUrl?: string | null;
  onUpload: (imageId: string, previewUrl: string) => void;
  aspectRatio?: number; // default 3 (banner). 16/9 for guide.
  label?: string;
}

export function CoverUploader({ currentUrl, onUpload, aspectRatio = 3, label = "Change cover photo" }: CoverUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview]       = useState<string | null>(currentUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropSrc, setCropSrc]       = useState<string | null>(null);

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    const localPreview = URL.createObjectURL(blob);
    setPreview(localPreview);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "cover.jpg");
      formData.append("metadata", JSON.stringify({ type: "cover" }));
      const token = getToken();
      const res = await fetch("/api/upload/proxy", {
        method: "POST", body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const { imageId, cdnUrl } = await res.json();
      onUpload(imageId, cdnUrl || localPreview);
      toast({ title: "Cover photo updated" });
    } catch (err) {
      console.error("Cover upload error:", err);
      toast({ title: "Upload failed", description: "Could not save your cover. Please try again.", variant: "destructive" });
      setPreview(currentUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Rectangular preview — click anywhere to change */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border bg-secondary cursor-pointer group"
        style={{ aspectRatio: String(aspectRatio) }}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <ImageIcon className="w-8 h-8" />
            <span className="text-xs">{label}</span>
          </div>
        )}
        {/* Hover/tap overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 sm:opacity-0 active:opacity-100 transition-opacity">
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <>
              <Pencil className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{label}</span>
            </>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/heic,image/heif"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
      />
      {cropSrc && (
        <CoverCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onClose={() => setCropSrc(null)}
          aspectRatio={aspectRatio}
        />
      )}
    </>
  );
}
