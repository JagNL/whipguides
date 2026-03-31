import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // ── Hashed static assets (/assets/*) ─────────────────────────────────────
  // Vite content-hashes every file in /assets/ so they are immutable.
  // Long max-age + immutable = browsers & CDNs cache aggressively.
  // CRITICAL: if the file does NOT exist (stale hash from old deploy) we must
  // return 404 — NOT index.html.  Returning index.html with content-type
  // text/html causes "Strict MIME type" errors for <script type=module>.
  app.use(
    "/assets",
    (req: Request, res: Response, next: NextFunction) => {
      const filePath = path.join(distPath, "assets", req.path);
      if (!fs.existsSync(filePath)) {
        // Stale chunk: the browser has a cached index.html from an old deploy.
        // The client-side ChunkLoadError handler will catch this and reload.
        return res.status(404).json({ error: "Asset not found — please refresh" });
      }
      // Set immutable cache headers for hashed assets
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      next();
    },
    express.static(path.join(distPath, "assets")),
  );

  // ── All other static files (favicon, manifest, etc.) ─────────────────────
  app.use(
    express.static(distPath, {
      // index.html must NEVER be cached by the browser or CDN.
      // It contains the current chunk hashes — stale = broken.
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    }),
  );

  // ── SPA fallback ── only for non-asset, non-API paths ────────────────────
  app.use("/{*path}", (req: Request, res: Response) => {
    // If somehow an /assets/ request reaches here (should never happen after
    // the guard above), bail out rather than serving index.html.
    if (req.path.startsWith("/assets/")) {
      return res.status(404).json({ error: "Asset not found" });
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
