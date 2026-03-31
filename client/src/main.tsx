import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Migrate users arriving on old hash URLs (e.g. from bookmarks/emails sent before the SEO switch)
// Redirect /#/path -> /path so wouter's browser router picks it up
if (window.location.hash.startsWith("#/")) {
  const newPath = window.location.hash.slice(1); // drop the "#"
  window.history.replaceState(null, "", newPath + window.location.search);
}

createRoot(document.getElementById("root")!).render(<App />);
