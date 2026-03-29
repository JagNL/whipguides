/**
 * WhipGuides — Video Provider Abstraction
 *
 * Switching providers later is a one-file change:
 *   1. Implement VideoProvider interface below
 *   2. Update getVideoProvider() to return your new provider
 *   3. Set the right env vars
 *
 * Current provider: Cloudflare Stream
 * Future: Mux, Bunny Stream, api.video, self-hosted FFmpeg → R2
 */

// ── Core interface ─────────────────────────────────────────────
export interface UploadedVideo {
  /** Provider-assigned video ID (opaque string) */
  videoId: string;
  /** HLS manifest URL for adaptive playback */
  hlsUrl: string | null;
  /** MPEG-DASH manifest (optional, for Chromecast/desktop) */
  dashUrl: string | null;
  /** Static thumbnail/poster image URL */
  thumbnailUrl: string | null;
  /** True when running without a configured provider */
  devMode: boolean;
}

export interface VideoStatus {
  ready: boolean;
  state: "queued" | "inprogress" | "ready" | "error" | "devmode";
  duration: number | null;
  thumbnailUrl: string | null;
}

export interface VideoProvider {
  /** Human-readable name (for logs / admin UI) */
  name: string;
  /** True when all required env vars are set */
  isConfigured(): boolean;
  /**
   * Upload a raw video buffer. Returns resolved URLs immediately
   * (providers transcode asynchronously; use getStatus() to poll).
   */
  upload(params: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
    maxDurationSeconds: number;
    metadata?: Record<string, string>;
  }): Promise<UploadedVideo>;
  /** Poll readiness — Cloudflare transcodes async, usually <30s */
  getStatus(videoId: string): Promise<VideoStatus>;
  /** Delete a video from the provider */
  delete(videoId: string): Promise<void>;
}

// ── Dev/No-op provider ─────────────────────────────────────────
// Used when no real provider is configured (local dev, missing keys)
class DevVideoProvider implements VideoProvider {
  name = "Dev (no-op)";
  isConfigured() { return false; }

  async upload() {
    return {
      videoId: `dev-${Date.now()}`,
      hlsUrl: null,
      dashUrl: null,
      thumbnailUrl: null,
      devMode: true,
    };
  }

  async getStatus(): Promise<VideoStatus> {
    return { ready: true, state: "devmode", duration: null, thumbnailUrl: null };
  }

  async delete() {}
}

// ── Cloudflare Stream provider ────────────────────────────────
class CloudflareStreamProvider implements VideoProvider {
  name = "Cloudflare Stream";

  private accountId: string;
  private token: string;
  private base: string;

  constructor(accountId: string, token: string) {
    this.accountId = accountId;
    this.token     = token;
    this.base      = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;
  }

  isConfigured() { return !!(this.accountId && this.token); }

  async upload({ buffer, mimeType, filename, maxDurationSeconds, metadata = {} }): Promise<UploadedVideo> {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), filename);
    form.append("maxDurationSeconds", String(maxDurationSeconds));
    form.append("requireSignedURLs", "false");
    form.append("meta", JSON.stringify({ name: filename, ...metadata }));

    const res  = await fetch(this.base, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
    });
    const json = await res.json() as any;

    if (!res.ok || !json.success) {
      const msg = json.errors?.[0]?.message || "Cloudflare Stream upload failed";
      throw new Error(msg);
    }

    const r = json.result;
    return {
      videoId:      r.uid,
      hlsUrl:       `https://videodelivery.net/${r.uid}/manifest/video.m3u8`,
      dashUrl:      `https://videodelivery.net/${r.uid}/manifest/video.mpd`,
      thumbnailUrl: r.thumbnail || `https://videodelivery.net/${r.uid}/thumbnails/thumbnail.jpg`,
      devMode: false,
    };
  }

  async getStatus(videoId: string): Promise<VideoStatus> {
    const res  = await fetch(`${this.base}/${videoId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const json = await res.json() as any;
    const r    = json.result;
    const state = r?.status?.state || "inprogress";

    return {
      ready:        r?.readyToStream ?? false,
      state:        (["queued","inprogress","ready","error"].includes(state) ? state : "inprogress") as VideoStatus["state"],
      duration:     r?.duration ?? null,
      thumbnailUrl: r?.thumbnail ?? null,
    };
  }

  async delete(videoId: string) {
    await fetch(`${this.base}/${videoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
}

// ── Mux provider stub (future) ─────────────────────────────────
// class MuxProvider implements VideoProvider {
//   name = "Mux";
//   constructor(private tokenId: string, private tokenSecret: string) {}
//   isConfigured() { return !!(this.tokenId && this.tokenSecret); }
//   async upload(...) { /* POST https://api.mux.com/video/v1/uploads */ }
//   async getStatus(videoId) { /* GET https://api.mux.com/video/v1/assets/:id */ }
//   async delete(videoId)    { /* DELETE https://api.mux.com/video/v1/assets/:id */ }
// }

// ── Bunny Stream provider stub (future) ───────────────────────
// class BunnyStreamProvider implements VideoProvider {
//   name = "Bunny Stream";
//   constructor(private libraryId: string, private apiKey: string) {}
//   isConfigured() { return !!(this.libraryId && this.apiKey); }
//   async upload(...) { /* https://video.bunnycdn.com/library/:id/videos */ }
//   ...
// }

// ── Factory: reads env vars to select provider ─────────────────
let _provider: VideoProvider | null = null;

export function getVideoProvider(): VideoProvider {
  if (_provider) return _provider;

  // Provider priority (first configured wins):
  // 1. Cloudflare Stream (VIDEO_PROVIDER=cloudflare or default)
  // 2. More providers added here in the future
  const preferred = (process.env.VIDEO_PROVIDER || "cloudflare").toLowerCase();

  if (preferred === "cloudflare" || preferred === "cf") {
    const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "";
    const token     = process.env.CF_STREAM_TOKEN || "";
    if (accountId && token) {
      _provider = new CloudflareStreamProvider(accountId, token);
      console.log("[video] Provider: Cloudflare Stream");
      return _provider;
    }
  }

  // Fallback
  console.warn("[video] No video provider configured — using Dev no-op. Set CF_ACCOUNT_ID + CF_STREAM_TOKEN.");
  _provider = new DevVideoProvider();
  return _provider;
}

// Reset cached provider (useful for tests)
export function resetVideoProvider() { _provider = null; }
