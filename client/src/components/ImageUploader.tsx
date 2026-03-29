import { useCallback, useRef, useState } from "react";
import { apiRequest, getToken } from "@/lib/queryClient";
import { Camera, X, Loader2, ImagePlus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
      .map(img => img.cdnUrl || img.imageId);
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
