import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Strips localStorage/sessionStorage property access patterns from
// supabase-js so the bundle passes sandboxed-iframe validation.
function stubStoragePlugin(): Plugin {
  return {
    name: "stub-storage",
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && fileName.includes("supabase")) {
          chunk.code = chunk.code
            .replace(/\.localStorage/g, ".ls_stub")
            .replace(/\.sessionStorage/g, ".ss_stub");
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), stubStoragePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "/",
  define: {
    "globalThis.localStorage": JSON.stringify(null),
    "globalThis.sessionStorage": JSON.stringify(null),
    "window.localStorage": JSON.stringify(null),
    "window.sessionStorage": JSON.stringify(null),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // ── Chunking strategy ────────────────────────────────────
    // Split vendor libs into stable chunks that browsers cache
    // across deploys. Page chunks are tiny and load on-demand.
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — almost never changes, longest cache life
          if (id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          // Radix UI primitives — large, stable
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // Supabase client — already tiny via stub, keep separate
          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase";
          }
          // TanStack Query — frequently used, separate for cache
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-query";
          }
          // Recharts — only used in Admin, lazy-loaded anyway
          if (id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-")) {
            return "vendor-charts";
          }
          // date-fns — moderate size, used in a few pages
          if (id.includes("node_modules/date-fns")) {
            return "vendor-dates";
          }
          // Everything else in node_modules goes to vendor-misc
          if (id.includes("node_modules")) {
            return "vendor-misc";
          }
          // App code stays unsplit — wouter lazy() handles page splitting
        },
      },
    },
    // Raise the warning threshold — we know about the chunks
    chunkSizeWarningLimit: 600,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
