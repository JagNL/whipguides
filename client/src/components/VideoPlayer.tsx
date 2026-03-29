/**
 * VideoPlayer — provider-agnostic HLS video player.
 *
 * Uses HLS.js for adaptive bitrate in browsers that don't support
 * native HLS (Chrome, Firefox, Edge). Falls back to native <video>
 * on Safari/iOS which supports HLS natively.
 *
 * The player has zero knowledge of which provider created the video.
 * It just needs an HLS manifest URL (m3u8).
 */
import { useEffect, useRef, useState } from "react";
import { Video, Play, Loader2, AlertCircle } from "lucide-react";

interface VideoPlayerProps {
  /** HLS manifest URL (m3u8) from the provider */
  hlsUrl: string | null;
  /** Poster/thumbnail image shown before play */
  thumbnailUrl?: string | null;
  /** CSS class for the wrapper div */
  className?: string;
  /** Auto-play (muted) — useful for feed previews */
  autoPlay?: boolean;
  /** Show controls */
  controls?: boolean;
}

// Dynamically import HLS.js only when needed (code-split friendly)
let hlsModule: any = null;
async function getHls() {
  if (!hlsModule) {
    try {
      // HLS.js is a peer dep — server imports hls.js if installed
      // For client we use the CDN-cached version via dynamic import
      hlsModule = (await import("hls.js")).default;
    } catch {
      hlsModule = null;
    }
  }
  return hlsModule;
}

export function VideoPlayer({
  hlsUrl,
  thumbnailUrl,
  className = "",
  autoPlay = false,
  controls = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "nourl">(
    hlsUrl ? "loading" : "nourl"
  );

  useEffect(() => {
    if (!hlsUrl) { setStatus("nourl"); return; }
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: any = null;
    setStatus("loading");

    (async () => {
      const Hls = await getHls();

      // Safari / iOS support HLS natively
      if (!Hls || !Hls.isSupported()) {
        video.src = hlsUrl;
        video.oncanplay  = () => setStatus("ready");
        video.onerror    = () => setStatus("error");
        return;
      }

      hlsInstance = new Hls({
        // Start at lowest quality for fast first frame
        startLevel: -1,
        // Buffer tuning for short social clips
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Low-latency first frame
        initialLiveManifestSize: 1,
      });

      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("ready");
        if (autoPlay) video.play().catch(() => {/* autoplay blocked — fine */});
      });

      hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          console.warn("[VideoPlayer] HLS fatal error:", data);
          setStatus("error");
        }
      });
    })();

    return () => {
      hlsInstance?.destroy();
      if (video) { video.src = ""; }
    };
  }, [hlsUrl, autoPlay]);

  if (!hlsUrl) {
    return (
      <div className={`bg-secondary rounded-xl aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground ${className}`}>
        <Video className="w-8 h-8 opacity-40" />
        <p className="text-xs">Video unavailable</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden aspect-video ${className}`}>
      {/* Poster shown while loading */}
      {thumbnailUrl && status === "loading" && (
        <img
          src={thumbnailUrl}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Loading spinner */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-black/70 rounded-full p-3">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm">Video unavailable</p>
          <p className="text-xs text-white/60">The video may still be processing</p>
        </div>
      )}

      {/* The actual video element */}
      <video
        ref={videoRef}
        className={`w-full h-full object-contain transition-opacity duration-300 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
        controls={controls}
        playsInline
        preload="metadata"
        poster={thumbnailUrl || undefined}
        muted={autoPlay}
      />
    </div>
  );
}

/**
 * Compact video badge for post/listing cards — shows thumbnail
 * with a play icon overlay. Click to expand.
 */
export function VideoThumbnail({
  hlsUrl,
  thumbnailUrl,
  onClick,
  className = "",
}: {
  hlsUrl: string | null;
  thumbnailUrl?: string | null;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden aspect-video bg-black cursor-pointer group ${className}`}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-secondary flex items-center justify-center">
          <Video className="w-8 h-8 text-muted-foreground opacity-40" />
        </div>
      )}
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="w-12 h-12 rounded-full bg-black/70 group-hover:bg-black/90 flex items-center justify-center transition-all group-hover:scale-110">
          <Play className="w-5 h-5 text-white ml-0.5 fill-white" />
        </div>
      </div>
      {/* Video badge */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-md">
        <Video className="w-3 h-3" /> Video
      </div>
    </div>
  );
}
