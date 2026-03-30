/**
 * server/affiliate-providers.ts
 *
 * Provider-agnostic affiliate product search interface.
 * Each provider knows how to search its catalog and return standardised products.
 *
 * Providers: Amazon PA API, RockAuto (scrape-free via affiliate links), 
 *            Brownells, eBay Motors, Summit Racing, Sweetwater, generic.
 *
 * Products are normalised to AffiliateProduct before storage.
 */

export interface AffiliateProductCandidate {
  title: string;
  description?: string;
  productUrl: string;
  affiliateUrl: string;
  imageUrl?: string;
  priceCents?: number;
  brand?: string;
  partNumber?: string;
  fitsMake?: string;
  fitsYearStart?: number;
  fitsYearEnd?: number;
  fitsEngine?: string;
  universalFit?: boolean;
  qualityTier?: "premium" | "standard" | "budget";
  providerMeta?: Record<string, any>;
}

export interface AffiliateSearchQuery {
  term: string;              // e.g. "K&N air filter 2003 Mustang GT"
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  category?: string;         // e.g. "intake", "brakes"
  maxResults?: number;
}

export interface AffiliateProviderConfig {
  affiliateTag?: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
}

export interface AffiliateProvider {
  name: string;
  displayName: string;
  isConfigured(): boolean;
  search(query: AffiliateSearchQuery, config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]>;
  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string;
}

// ─── Amazon Product Advertising API ─────────────────────────
export class AmazonProvider implements AffiliateProvider {
  name = "amazon";
  displayName = "Amazon";

  isConfigured() {
    return !!(process.env.AMAZON_ASSOCIATE_TAG &&
              process.env.AMAZON_ACCESS_KEY &&
              process.env.AMAZON_SECRET_KEY);
  }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const tag = config.affiliateTag || process.env.AMAZON_ASSOCIATE_TAG || "";
    // If it's an ASIN, build the URL
    const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch) {
      return `https://www.amazon.com/dp/${asinMatch[1]}?tag=${tag}`;
    }
    const url = new URL(productUrl.startsWith("http") ? productUrl : `https://www.amazon.com${productUrl}`);
    if (tag) url.searchParams.set("tag", tag);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    // Amazon PA API v5 — requires signed requests (SigV4)
    // Full implementation requires the paapi5-nodejs-sdk or custom SigV4
    // We build the search term for now and return structured links
    // Full PA API integration: https://webservices.amazon.com/paapi5/documentation/
    const tag = config.affiliateTag || process.env.AMAZON_ASSOCIATE_TAG || "";
    if (!tag) return [];

    // Build a direct search URL as fallback when PA API isn't configured
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query.term)}&tag=${tag}`;

    // TODO: When AMAZON_ACCESS_KEY + AMAZON_SECRET_KEY are set, use PA API for real product data
    // For now return a "search page" link — still earns commission if user buys
    return [{
      title: `Search Amazon: ${query.term}`,
      productUrl: searchUrl,
      affiliateUrl: searchUrl,
      universalFit: true,
      qualityTier: "standard",
      providerMeta: { type: "search_page", tag },
    }];
  }
}

// ─── RockAuto ────────────────────────────────────────────────
export class RockAutoProvider implements AffiliateProvider {
  name = "rockauto";
  displayName = "RockAuto";
  private baseUrl = "https://www.rockauto.com";

  isConfigured() {
    // RockAuto has no public API — uses affiliate links with partnercode
    return !!(process.env.ROCKAUTO_PARTNER_CODE);
  }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const code = config.affiliateTag || process.env.ROCKAUTO_PARTNER_CODE || "";
    const url = productUrl.startsWith("http") ? new URL(productUrl) : new URL(`${this.baseUrl}${productUrl}`);
    if (code) url.searchParams.set("partnercode", code);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    const code = config.affiliateTag || process.env.ROCKAUTO_PARTNER_CODE || "";
    const { make, model, year, term } = query;

    // RockAuto deep-link format for vehicle-specific searches
    // https://www.rockauto.com/en/catalog/[make],[model],[year]
    let searchUrl = `${this.baseUrl}/en/partsearch/?searchtext=${encodeURIComponent(term)}`;
    if (make && model && year) {
      searchUrl = `${this.baseUrl}/en/catalog/${encodeURIComponent(make.toLowerCase())},${encodeURIComponent(model.toLowerCase())},${year}`;
    }
    if (code) searchUrl += `${searchUrl.includes("?") ? "&" : "?"}partnercode=${code}`;

    return [{
      title: `RockAuto: ${term}${make && year ? ` for ${year} ${make} ${model}` : ""}`,
      productUrl: searchUrl,
      affiliateUrl: searchUrl,
      fitsMake: make,
      fitsYearStart: year,
      fitsYearEnd: year,
      universalFit: !make,
      qualityTier: "standard",
      providerMeta: { type: "catalog_page", code },
    }];
  }
}

// ─── Brownells (firearms) ────────────────────────────────────
export class BrownellsProvider implements AffiliateProvider {
  name = "brownells";
  displayName = "Brownells";
  private baseUrl = "https://www.brownells.com";

  isConfigured() {
    return !!(process.env.BROWNELLS_AFFILIATE_ID);
  }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const id = config.affiliateTag || process.env.BROWNELLS_AFFILIATE_ID || "";
    const url = productUrl.startsWith("http") ? new URL(productUrl) : new URL(`${this.baseUrl}${productUrl}`);
    if (id) url.searchParams.set("utm_source", "whipguides");
    if (id) url.searchParams.set("rcode", id);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    const id = config.affiliateTag || process.env.BROWNELLS_AFFILIATE_ID || "";
    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query.term)}&rcode=${id}`;
    return [{
      title: `Brownells: ${query.term}`,
      productUrl: searchUrl,
      affiliateUrl: searchUrl,
      universalFit: true,
      qualityTier: "standard",
      providerMeta: { type: "search_page" },
    }];
  }
}

// ─── MidwayUSA (firearms + outdoors) ────────────────────────
export class MidwayUSAProvider implements AffiliateProvider {
  name = "midwayusa";
  displayName = "MidwayUSA";
  private baseUrl = "https://www.midwayusa.com";

  isConfigured() { return !!(process.env.MIDWAYUSA_AFFILIATE_ID); }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const id = config.affiliateTag || process.env.MIDWAYUSA_AFFILIATE_ID || "";
    const url = productUrl.startsWith("http") ? new URL(productUrl) : new URL(`${this.baseUrl}${productUrl}`);
    if (id) url.searchParams.set("utm_source", id);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, _config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    const id = process.env.MIDWAYUSA_AFFILIATE_ID || "";
    const searchUrl = `${this.baseUrl}/c/search?utm_source=${id}&utm_term=${encodeURIComponent(query.term)}`;
    return [{ title: `MidwayUSA: ${query.term}`, productUrl: searchUrl, affiliateUrl: searchUrl, universalFit: true, qualityTier: "standard" }];
  }
}

// ─── Summit Racing ───────────────────────────────────────────
export class SummitRacingProvider implements AffiliateProvider {
  name = "summit_racing";
  displayName = "Summit Racing";
  private baseUrl = "https://www.summitracing.com";

  isConfigured() { return !!(process.env.SUMMIT_AFFILIATE_ID); }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const id = config.affiliateTag || process.env.SUMMIT_AFFILIATE_ID || "";
    const url = productUrl.startsWith("http") ? new URL(productUrl) : new URL(`${this.baseUrl}${productUrl}`);
    if (id) url.searchParams.set("seid", id);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, _config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    const id = process.env.SUMMIT_AFFILIATE_ID || "";
    const { make, model, year, term } = query;
    let searchUrl = `${this.baseUrl}/search/results?autocomplete=${encodeURIComponent(term)}&seid=${id}`;
    if (make && year) {
      searchUrl = `${this.baseUrl}/select-vehicle/results?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model || "")}&keyword=${encodeURIComponent(term)}&seid=${id}`;
    }
    return [{ title: `Summit Racing: ${term}`, productUrl: searchUrl, affiliateUrl: searchUrl, fitsMake: make, fitsYearStart: year, universalFit: !make, qualityTier: "premium" }];
  }
}

// ─── Sweetwater (music) ──────────────────────────────────────
export class SweetwaterProvider implements AffiliateProvider {
  name = "sweetwater";
  displayName = "Sweetwater";
  private baseUrl = "https://www.sweetwater.com";

  isConfigured() { return !!(process.env.SWEETWATER_AFFILIATE_ID); }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const id = config.affiliateTag || process.env.SWEETWATER_AFFILIATE_ID || "";
    const url = productUrl.startsWith("http") ? new URL(productUrl) : new URL(`${this.baseUrl}${productUrl}`);
    if (id) url.searchParams.set("utm_source", id);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, _config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    const id = process.env.SWEETWATER_AFFILIATE_ID || "";
    const searchUrl = `${this.baseUrl}/store/search.php?s=${encodeURIComponent(query.term)}&utm_source=${id}`;
    return [{ title: `Sweetwater: ${query.term}`, productUrl: searchUrl, affiliateUrl: searchUrl, universalFit: true, qualityTier: "premium" }];
  }
}

// ─── Generic (any vendor with a search URL template) ────────
export class GenericProvider implements AffiliateProvider {
  name = "generic";
  displayName = "Generic";

  isConfigured() { return true; }

  buildAffiliateUrl(productUrl: string, config: AffiliateProviderConfig): string {
    const url = productUrl.startsWith("http") ? new URL(productUrl) : new URL(`https://example.com${productUrl}`);
    if (config.affiliateTag) url.searchParams.set("ref", config.affiliateTag);
    return url.toString();
  }

  async search(query: AffiliateSearchQuery, config: AffiliateProviderConfig): Promise<AffiliateProductCandidate[]> {
    const base = config.baseUrl || "";
    if (!base) return [];
    const tag = config.affiliateTag || "";
    const searchUrl = `${base}/search?q=${encodeURIComponent(query.term)}${tag ? `&ref=${tag}` : ""}`;
    return [{ title: query.term, productUrl: searchUrl, affiliateUrl: searchUrl, universalFit: true, qualityTier: "standard" }];
  }
}

// ─── Registry ────────────────────────────────────────────────
const AFFILIATE_PROVIDERS: Record<string, AffiliateProvider> = {
  amazon:        new AmazonProvider(),
  rockauto:      new RockAutoProvider(),
  brownells:     new BrownellsProvider(),
  midwayusa:     new MidwayUSAProvider(),
  summit_racing: new SummitRacingProvider(),
  sweetwater:    new SweetwaterProvider(),
  generic:       new GenericProvider(),
};

export function getAffiliateProvider(type: string): AffiliateProvider {
  return AFFILIATE_PROVIDERS[type] || AFFILIATE_PROVIDERS.generic;
}

export function getAllAffiliateProviders(): AffiliateProvider[] {
  return Object.values(AFFILIATE_PROVIDERS);
}

export function getAffiliateProviderStatus() {
  return Object.entries(AFFILIATE_PROVIDERS).map(([key, p]) => ({
    key,
    displayName: p.displayName,
    configured: p.isConfigured(),
  }));
}

// ─── Vertical → recommended providers ───────────────────────
export const VERTICAL_PROVIDERS: Record<string, string[]> = {
  automotive:   ["rockauto", "summit_racing", "amazon"],
  powersports:  ["rockauto", "summit_racing", "amazon"],
  firearms:     ["brownells", "midwayusa", "amazon"],
  outdoors:     ["midwayusa", "amazon"],
  music:        ["sweetwater", "amazon"],
  maker:        ["amazon"],
  tech:         ["amazon"],
  collectibles: ["amazon"],
  general:      ["amazon"],
};
