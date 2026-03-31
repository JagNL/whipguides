/**
 * useSEO — sets <title>, meta description, and Open Graph tags dynamically.
 * Call once per page with the relevant data.
 */
import { useEffect } from "react";

interface SEOProps {
  title: string;          // page title (without site name suffix)
  description?: string;
  image?: string | null;  // OG image URL
  url?: string;           // canonical URL (defaults to current)
  type?: "website" | "article" | "profile";
}

const SITE_NAME = "WhipGuides";
const DEFAULT_DESC =
  "WhipGuides — the community for automotive, motorsports, firearms, maker, and music enthusiasts. Buy, sell, connect, and learn.";
const DEFAULT_IMAGE = "https://whipguides-production.up.railway.app/og-default.jpg";

function setMeta(name: string, content: string) {
  // handle both name= and property= (OG) attributes
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`) ||
           document.querySelector<HTMLMetaElement>(`meta[property="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    // OG tags use property, others use name
    if (name.startsWith("og:") || name.startsWith("twitter:")) {
      el.setAttribute("property", name);
    } else {
      el.setAttribute("name", name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({ title, description, image, url, type = "website" }: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    const desc = description || DEFAULT_DESC;
    const img = image || DEFAULT_IMAGE;
    const canonical = url || window.location.href.split("?")[0];

    // <title>
    document.title = fullTitle;

    // Basic meta
    setMeta("description", desc);

    // Canonical
    setLink("canonical", canonical);

    // Open Graph
    setMeta("og:title", fullTitle);
    setMeta("og:description", desc);
    setMeta("og:image", img);
    setMeta("og:url", canonical);
    setMeta("og:type", type);
    setMeta("og:site_name", SITE_NAME);

    // Twitter card
    setMeta("twitter:card", img ? "summary_large_image" : "summary");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    if (img) setMeta("twitter:image", img);
  }, [title, description, image, url, type]);
}
