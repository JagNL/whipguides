/**
 * WhipGuides — Upload Server
 * Uses Cloudflare R2 via S3-compatible API for all image storage.
 * Falls back to base64 data URLs when R2 is not configured (dev mode).
 *
 * Env vars required:
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_ENDPOINT        — https://<account-id>.r2.cloudflarestorage.com
 *   R2_BUCKET          — e.g. whipguides-r2
 *   CLOUDFLARE_IMAGES_URL — public CDN URL e.g. https://pub-xxx.r2.dev
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { requireAuth } from "./auth";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { randomUUID } from "crypto";

// ── R2 client ──────────────────────────────────────────────────
const R2_ENDPOINT    = process.env.R2_ENDPOINT || "";
const R2_BUCKET      = process.env.R2_BUCKET || "whipguides-r2";
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY || "";
const PUBLIC_URL     = (process.env.CLOUDFLARE_IMAGES_URL || "").replace(/\/$/, "");

export const isR2Configured = () => !!(R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY);

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
  }
  return _s3;
}

// ── Multer — memory storage, 10 MB max, images only ───────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard cap
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ── Image compression via sharp ────────────────────────────────
async function compressImage(
  buffer: Buffer,
  mimetype: string,
  maxWidth = 2000
): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const img = sharp(buffer).rotate(); // auto-rotate from EXIF

    const meta = await img.metadata();
    if (meta.width && meta.width > maxWidth) {
      img.resize({ width: maxWidth, withoutEnlargement: true });
    }

    // Always output as JPEG (smaller, universally supported)
    const compressed = await img
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    return { buffer: compressed, contentType: "image/jpeg" };
  } catch {
    // If sharp fails (e.g. unsupported format), pass through original
    return { buffer, contentType: mimetype };
  }
}

// ── Core R2 upload function ────────────────────────────────────
async function uploadToR2(
  buffer: Buffer,
  contentType: string,
  folder = "uploads"
): Promise<{ key: string; url: string }> {
  const ext = contentType === "image/jpeg" ? "jpg"
    : contentType === "image/png" ? "png"
    : contentType === "image/webp" ? "webp"
    : "jpg";

  const key = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  await getS3().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : key;
  return { key, url };
}

// ── Router ─────────────────────────────────────────────────────
export const uploadRouter = Router();
uploadRouter.use(requireAuth);

// ============================================================
// POST /api/upload/proxy
// Main upload endpoint — client sends file, server compresses
// and stores in R2. Returns imageId (key) + cdnUrl.
// ============================================================
uploadRouter.post("/proxy", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  // Determine folder from metadata
  let folder = "uploads";
  try {
    const meta = req.body.metadata
      ? (typeof req.body.metadata === "string" ? JSON.parse(req.body.metadata) : req.body.metadata)
      : {};
    if (meta.type === "avatar") folder = "avatars";
    else if (meta.type === "listing") folder = "listings";
    else if (meta.type === "cover") folder = "covers";
    else if (meta.type === "guide") folder = "guides";
    else if (meta.type === "business") folder = "business";
  } catch {}

  if (!isR2Configured()) {
    // Dev fallback — base64 data URL
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    return res.json({ imageId: `data-${Date.now()}`, cdnUrl: dataUrl, devMode: true });
  }

  try {
    // Compress before uploading
    const { buffer, contentType } = await compressImage(req.file.buffer, req.file.mimetype);
    const { key, url } = await uploadToR2(buffer, contentType, folder);

    res.json({ imageId: key, cdnUrl: url, devMode: false });
  } catch (err: any) {
    console.error("R2 upload error:", err);
    res.status(500).json({ error: "Upload failed", detail: err.message });
  }
});

// ============================================================
// POST /api/upload/direct-url
// Returns a pre-signed PUT URL so the client can upload directly
// to R2 without going through our server (for large files).
// ============================================================
uploadRouter.post("/direct-url", async (req: Request, res: Response) => {
  if (!isR2Configured()) {
    return res.json({ uploadUrl: null, imageId: `dev-${Date.now()}`, devMode: true });
  }

  const { contentType = "image/jpeg", folder = "uploads" } = req.body;
  const ext = contentType.split("/")[1] || "jpg";
  const key = `${folder}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  const signedUrl = await getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300 } // 5 minutes
  );

  const cdnUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : key;
  res.json({ uploadUrl: signedUrl, imageId: key, cdnUrl, devMode: false });
});

// ============================================================
// GET /api/upload/image-url/:imageId
// Resolves a stored key/id to a public CDN URL.
// ============================================================
uploadRouter.get("/image-url/:imageId(*)", (req: Request, res: Response) => {
  const { imageId } = req.params;
  if (!imageId) return res.json({ url: null });

  // Already a full URL (data URI or https)
  if (imageId.startsWith("data:") || imageId.startsWith("http")) {
    return res.json({ url: imageId });
  }

  const url = PUBLIC_URL ? `${PUBLIC_URL}/${imageId}` : null;
  res.json({ url });
});

// ============================================================
// DELETE /api/upload/:key — remove from R2
// ============================================================
uploadRouter.delete("/:key(*)", async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!isR2Configured() || !key) return res.json({ success: true });

  try {
    await getS3().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    res.json({ success: true });
  } catch (err: any) {
    console.error("R2 delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Helper exported for other server files
// ============================================================
export function cfImageUrl(imageId: string): string {
  if (!imageId) return "";
  if (imageId.startsWith("data:") || imageId.startsWith("http")) return imageId;
  return PUBLIC_URL ? `${PUBLIC_URL}/${imageId}` : imageId;
}

// Legacy compat — old code checked isCloudflareConfigured
export const isCloudflareConfigured = isR2Configured;
