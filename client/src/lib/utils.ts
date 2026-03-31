import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * slugify — converts any string into a URL-safe slug.
 * "Polaris Sportsman 500's" → "polaris-sportsman-500s"
 * Used in ID+slug URLs: /groups/14/polaris-sportsman-500s
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")                    // decompose accented chars
    .replace(/[\u0300-\u036f]/g, "")    // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")      // strip non-alphanumeric (keep spaces/hyphens)
    .trim()
    .replace(/[\s_]+/g, "-")            // spaces/underscores → hyphens
    .replace(/-{2,}/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "");             // trim leading/trailing hyphens
}

/** Build a canonical group URL: /groups/14/polaris-sportsman-500s */
export function groupUrl(id: number | string, name?: string | null): string {
  const slug = name ? slugify(name) : null;
  return slug ? `/groups/${id}/${slug}` : `/groups/${id}`;
}

/** Build a canonical guide URL: /guides/23/how-to-rebuild-a-carburetor */
export function guideUrl(id: number | string, title?: string | null): string {
  const slug = title ? slugify(title) : null;
  return slug ? `/guides/${id}/${slug}` : `/guides/${id}`;
}

/** Build a canonical listing URL: /listing/7/1969-camaro-ss */
export function listingUrl(id: number | string, title?: string | null): string {
  const slug = title ? slugify(title) : null;
  return slug ? `/listing/${id}/${slug}` : `/listing/${id}`;
}

/** Build a canonical profile URL: /profile/5/todd-englerth */
export function profileUrl(id: number | string, name?: string | null): string {
  const slug = name ? slugify(name) : null;
  return slug ? `/profile/${id}/${slug}` : `/profile/${id}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; // fallback for non-date strings
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatPrice(cents: number): string {
  return `$${cents.toLocaleString()}`;
}
