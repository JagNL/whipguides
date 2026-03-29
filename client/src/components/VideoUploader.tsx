/**
 * VideoUploader — provider-agnostic video upload component.
 *
 * The client only knows about /api/video/upload — it has no idea
 * which provider the server is using. Swapping providers is invisible here.
 *
 * Props:
 *   context    — "group" | "listing" (determines limits server-side)
 *   onUploaded — callback with { videoId, hlsUrl, thumbnailUrl }
 *   onRemove   — callback when user removes the video
 */
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Video, X, Loader2, AlertCircle, CheckCircle2, Upload } from "lucide-react";

export interface VideoUploadResult {
  videoId: string;
  hlsUrl: string | null;
  dashUrl: string | null;
  thumbnailUrl: string | null;
  devMode: boolean;
}

interface VideoUploaderProps {
  context: "group" | "listing";
  onUploaded: (result: VideoUploadResult) => void;
  onRemove?: () => void;
  currentVideo?: VideoUploadResult | null;
  disabled?: boolean;
}

const CONTEXT_LIMITS = {
  group:   { maxSec: 90,  label: "90 seconds" },
  listing: { maxSec: 60,  label: "60 seconds" },
};

export function VideoUploader({
  context,
  onUploaded,
  onRemove,
  currentVideo,
  disabled = false,
}: VideoUploaderProps) {
  const { toast } = useToast();
  const fileRef   = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const limit = CONTEXT_LIMITS[context];

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Video files only", description: "Please select an mp4, mov, or webm file.", variant: "destructive" });
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum video size is 500 MB.", variant: "destructive" });
      return;
    }

    // Local preview blob
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setState("uploading");
    setProgress(0);
    setErrorMsg("");

    // Upload via server — XHR for progress events
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("context", context);

    try {
      const token = getToken();
      const result = await new Promise<VideoUploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/video/upload");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 400) reject(new Error(data.error || "Upload failed"));
            else resolve(data as VideoUploadResult);
          } catch { reject(new Error("Invalid server response")); }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });

      setState("done");
      onUploaded(result);
      toast({ title: "Video uploaded", description: result.devMode ? "Dev mode — no provider configured." : "Processing... it will be ready shortly." });
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Upload failed");
      setLocalPreview(null);
      toast({ title: "Video upload failed", description: err.message, variant: "destructive" });
    }
  }, [context, onUploaded, toast]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const remove = () => {
    setState("idle");
    setLocalPreview(null);
    setProgress(0);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
    onRemove?.();
  };

  // ── If a video is already attached ────────────────────────
  if (currentVideo || state === "done") {
    const thumb = currentVideo?.thumbnailUrl;
    return (
      <div className="relative rounded-xl overflow-hidden bg-secondary border border-border aspect-video group">
        {thumb ? (
          <img src={thumb} alt="Video thumbnail" className="w-full h-full object-cover" />
        ) : localPreview ? (
          <video src={localPreview} className="w-full h-full object-cover" muted />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Video className="w-8 h-8" />
            <span className="text-xs">Video attached</span>
          </div>
        )}
        {/* Processing badge */}
        {state === "done" && !currentVideo?.thumbnailUrl && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 text-white text-xs px-2 py-1 rounded-lg">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing…
          </div>
        )}
        {/* Remove button */}
        <button
          onClick={remove}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md">
          <Video className="w-3 h-3" /> Video
        </div>
      </div>
    );
  }

  // ── Uploading state ────────────────────────────────────────
  if (state === "uploading") {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 aspect-video flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="w-32">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">{progress}% uploaded</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (state === "error") {
    return (
      <div
        className="rounded-xl border border-destructive/40 bg-destructive/5 aspect-video flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-destructive/10 transition-colors"
        onClick={() => setState("idle")}
      >
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-xs text-destructive font-medium">{errorMsg}</p>
        <p className="text-[10px] text-muted-foreground">Click to try again</p>
      </div>
    );
  }

  // ── Idle / drop zone ───────────────────────────────────────
  return (
    <div
      className={`rounded-xl border-2 border-dashed aspect-video flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer select-none
        ${disabled ? "opacity-50 cursor-not-allowed border-border" : "border-border hover:border-primary/50 hover:bg-primary/5"}`}
      onClick={() => !disabled && fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); }}
      onDrop={e => { if (!disabled) handleDrop(e); }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Upload className="w-7 h-7 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">Drop video or click to upload</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          mp4, mov, webm · max {limit.label} · 500 MB
        </p>
      </div>
    </div>
  );
}
