/**
 * server/sanitize.ts
 * Lightweight input sanitization helpers.
 * No external deps — keeps the bundle clean.
 */

/** Strip null bytes + trim. Prevents null-byte injection in DB queries. */
export function sanitizeText(val: unknown, maxLen = 10000): string {
  if (typeof val !== "string") return "";
  return val.replace(/\0/g, "").trim().slice(0, maxLen);
}

/** Validate and parse a positive integer param. Returns NaN if invalid. */
export function parseId(val: string | undefined): number {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

/** Clamp a number between min and max (inclusive). */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/** Allow-list a string against a set of valid values. */
export function allowList<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(val as T) ? (val as T) : fallback;
}
