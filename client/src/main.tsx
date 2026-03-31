import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Stale chunk auto-recovery ─────────────────────────────────────────
// After a new deploy, lazy-loaded chunks get new content-hash filenames.
// Any browser tab still holding the old index.html will request old chunk
// URLs that no longer exist → the server returns 404 → Vite fires
// "vite:preloadError".  We catch it here and do a single hard reload to
// pick up the new index.html + chunk manifest.
// The sessionStorage flag prevents an infinite reload loop.
window.addEventListener("vite:preloadError", () => {
  const key = "__wg_chunk_reload";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

// ── Hash-URL migration ───────────────────────────────────────────
// Migrate users arriving on old hash URLs (e.g. from bookmarks/emails sent before the SEO switch)
// Redirect /#/path -> /path so wouter's browser router picks it up
if (window.location.hash.startsWith("#/")) {
  const newPath = window.location.hash.slice(1); // drop the "#"
  window.history.replaceState(null, "", newPath + window.location.search);
}

createRoot(document.getElementById("root")!).render(<App />);
