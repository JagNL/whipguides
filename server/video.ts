/**
 * WhipGuides — Video API Routes
 * /api/video
 *
 * All provider interaction goes through video-provider.ts.
 * Swap providers there without touching this file.
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "./auth";
import { getVideoProvider } from "./video-provider";

export const videoRouter = Router();
videoRouter.use(requireAuth);

// ── Limits (seconds + bytes) ──────────────────────────────────
const LIMITS = {
  group:   { maxSeconds: 90,  maxBytes: 500 * 1024 * 1024 },
  listing: { maxSeconds: 60,  maxBytes: 500 * 1024 * 1024 },
  default: { maxSeconds: 90,  maxBytes: 500 * 1024 * 1024 },
} as const;

// ── Kill switch helpers ───────────────────────────────────────
function isVideoEnabled(context: string): { allowed: boolean; reason?: string } {
  if (process.env.VIDEO_ENABLED === "false") {
    return { allowed: false, reason: "Video uploads are currently disabled by the administrator." };
  }
  if (context === "group" && process.env.VIDEO_GROUP_ENABLED === "false") {
    return { allowed: false, reason: "Video uploads in groups are currently disabled." };
  }
  if (context === "listing" && process.env.VIDEO_LISTING_ENABLED === "false") {
    return { allowed: false, reason: "Video uploads in listings are currently disabled." };
  }
  return { allowed: true };
}

// ── Multer — memory, 500 MB, video only ──────────────────────
const videoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    cb(new Error("Only video files are allowed (mp4, mov, webm, etc.)"));
  },
});

// ============================================================
// POST /api/video/upload
// Body (multipart): file + context ("group" | "listing")
// Returns: videoId, hlsUrl, dashUrl, thumbnailUrl, devMode
// ============================================================
videoRouter.post("/upload", videoMulter.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No video file provided" });

  const context = ((req.body.context as string) || "group").toLowerCase();
  const limit   = LIMITS[context as keyof typeof LIMITS] || LIMITS.default;
  const currentUser = (req as any).currentUser;

  // Kill switch
  const { allowed, reason } = isVideoEnabled(context);
  if (!allowed) return res.status(403).json({ error: reason });

  // File size guard (multer already enforces, but double-check)
  if (req.file.size > limit.maxBytes) {
    return res.status(400).json({ error: `Video too large. Maximum is ${limit.maxBytes / 1024 / 1024}MB.` });
  }

  const provider = getVideoProvider();

  try {
    const result = await provider.upload({
      buffer:             req.file.buffer,
      mimeType:           req.file.mimetype,
      filename:           req.file.originalname || "video.mp4",
      maxDurationSeconds: limit.maxSeconds,
      metadata: {
        uploadedBy: String(currentUser?.id || "unknown"),
        context,
        provider:   provider.name,
      },
    });

    return res.status(201).json(result);
  } catch (err: any) {
    console.error(`[video/upload] ${provider.name} error:`, err.message);
    return res.status(500).json({ error: err.message || "Video upload failed" });
  }
});

// ============================================================
// GET /api/video/:videoId/status
// Poll until { ready: true } before showing player
// ============================================================
videoRouter.get("/:videoId/status", async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const provider    = getVideoProvider();

  try {
    const status = await provider.getStatus(videoId);
    return res.json(status);
  } catch (err: any) {
    console.error(`[video/status] ${provider.name} error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE /api/video/:videoId
// Called when a post/listing is deleted — cleanup at provider
// ============================================================
videoRouter.delete("/:videoId", async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const provider    = getVideoProvider();

  try {
    await provider.delete(videoId);
    return res.json({ success: true });
  } catch (err: any) {
    console.error(`[video/delete] ${provider.name} error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/video/provider-info  (admin only — shows current provider)
// ============================================================
videoRouter.get("/provider-info", async (req: Request, res: Response) => {
  const currentUser = (req as any).currentUser;
  if ((currentUser as any)?.siteRole !== "super_admin" && (currentUser as any)?.siteRole !== "site_admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const provider = getVideoProvider();
  return res.json({
    name:         provider.name,
    configured:   provider.isConfigured(),
    videoEnabled: process.env.VIDEO_ENABLED !== "false",
    groupEnabled: process.env.VIDEO_GROUP_ENABLED !== "false",
    listingEnabled: process.env.VIDEO_LISTING_ENABLED !== "false",
    limits: LIMITS,
  });
});
