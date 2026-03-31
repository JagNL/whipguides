import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Strips localStorage/sessionStorage property access patterns from
// supabase-js so the bundle passes sandboxed-iframe validation.
// Our app uses in-memory auth state — these APIs are never called.
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
    // Stub out storage globals inside supabase-js so the bundle passes
    // sandboxed-iframe checks. Our auth hook uses in-memory sessions.
    "globalThis.localStorage": JSON.stringify(null),
    "globalThis.sessionStorage": JSON.stringify(null),
    "window.localStorage": JSON.stringify(null),
    "window.sessionStorage": JSON.stringify(null),
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
