/**
 * LocationPicker — geocoding-backed location input.
 * Uses OpenStreetMap Nominatim (free, no API key).
 *
 * Renders a text input with autocomplete dropdown.
 * On selection stores city/state display text + lat/lng.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X, Navigation } from "lucide-react";

export interface LocationResult {
  display: string;   // "Austin, TX"
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: string;                               // display text
  onChange: (display: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: any;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export default function LocationPicker({
  value,
  onChange,
  placeholder = "City, State or ZIP code",
  className = "",
  "data-testid": testId,
}: LocationPickerProps) {
  const [query, setQuery]           = useState(value);
  const [results, setResults]       = useState<LocationResult[]>([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [locating, setLocating]     = useState(false);
  const containerRef                = useRef<HTMLDivElement>(null);

  // Keep query in sync if parent value changes
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Geocode with Nominatim
  const geocode = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          format: "json",
          addressdetails: "1",
          limit: "6",
          countrycodes: "us",
        });
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        const mapped: LocationResult[] = data
          .filter((r: any) => r.address)
          .map((r: any) => {
            const a = r.address;
            // Build "City, ST" style label
            const city = a.city || a.town || a.village || a.county || a.state;
            const state = a.state;
            const display = state && city !== state
              ? `${city}, ${STATE_ABBR[state] || state}`
              : city || r.display_name.split(",")[0];
            return { display, lat: Number(r.lat), lng: Number(r.lon) };
          })
          // Dedupe by display
          .filter((r: LocationResult, i: number, arr: LocationResult[]) =>
            arr.findIndex(x => x.display === r.display) === i
          );
        setResults(mapped);
        setOpen(mapped.length > 0);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v, undefined); // clear coords until user picks from dropdown
    geocode(v);
  };

  const handleSelect = (r: LocationResult) => {
    setQuery(r.display);
    onChange(r.display, { lat: r.lat, lng: r.lng });
    setOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery("");
    onChange("", undefined);
    setResults([]);
    setOpen(false);
  };

  // "Use my location" via browser Geolocation API
  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lng } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const a = data.address || {};
          const city = a.city || a.town || a.village || a.county || "";
          const state = a.state || "";
          const display = city && state ? `${city}, ${STATE_ABBR[state] || state}` : city || state;
          setQuery(display);
          onChange(display, { lat, lng });
        } catch {
          // fallback: just use coordinates
          onChange(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          data-testid={testId}
          className="w-full bg-secondary border border-border rounded-lg pl-8 pr-16 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleGeolocate}
            disabled={locating}
            title="Use my location"
            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
          >
            {locating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Navigation className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(r)} // mousedown fires before blur
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-secondary transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              {r.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── US state abbreviation map ─────────────────────────────────
const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};
