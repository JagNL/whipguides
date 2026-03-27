import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ListingCard from "@/components/ListingCard";
import AdCard, { injectAdsIntoFeed } from "@/components/AdCard";
import LocationPicker from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal, TrendingUp, Zap, Shield, Search, X, MapPin,
  DollarSign, Bell, BellOff, BookmarkPlus, Clock, Sparkles, ChevronRight,
  Star, RotateCcw, Save, RefreshCw, AlertTriangle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCfUrl, useGoogleMapsKey } from "@/hooks/use-cf-url";
import type { Listing } from "@shared/schema";

// ── Feed with injected ads ───────────────────────────────────
function FeedWithAds({ listings }: { listings: any[] }) {
  const { data: ads = [] } = useQuery<any[]>({
    queryKey: ["/api/ads/serve", "marketplace"],
    queryFn: () => apiRequest("GET", "/api/ads/serve?context=marketplace&limit=3").then(r => r.json()),
    staleTime: 60_000,
  });
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const activeAds = ads.filter((a: any) => !dismissedIds.includes(a.id));
  const feed = injectAdsIntoFeed(listings, activeAds, 8);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {feed.map((item: any, i) => {
        if (item.__isAd) {
          return <AdCard key={`ad-${item.ad.id}`} ad={item.ad} compact onDismiss={() => setDismissedIds(d => [...d, item.ad.id])} />;
        }
        return <ListingCard key={(item as any).id} listing={item as any} />;
      })}
    </div>
  );
}

// ── Session ID for anonymous tracking ────────────────────────
let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) _sessionId = `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  return _sessionId;
}

const CATEGORIES = [
  "All",
  // Vehicles
  "Cars", "Trucks", "SUVs & Crossovers", "Motorcycles", "ATVs",
  "UTVs / Side-by-Sides", "Dirt Bikes", "Jet Skis / PWC", "Boats",
  "Snowmobiles", "RVs & Campers", "Classic & Antique Vehicles",
  // Parts
  "Parts & Accessories", "Engine & Drivetrain", "Body & Exterior",
  "Wheels & Tires", "Performance Parts",
  // General
  "Furniture & Home", "Electronics & Gadgets", "Collectibles & Antiques",
  "Firearms & Hunting", "Sporting Goods", "Tools & Equipment", "Other",
];
const CONDITIONS = ["Any", "New", "Like New", "Excellent", "Good", "Fair"];
const SORT_OPTIONS = [
  { value: "default", label: "Featured First" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest First" },
  { value: "mileage_asc", label: "Lowest Mileage" },
];

const DATE_POSTED_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => String(CURRENT_YEAR - i));

// ── Saved Search Banner ───────────────────────────────────────
function SaveSearchBanner({ filters, onSave }: { filters: any; onSave: () => void }) {
  const hasFilters = filters.q || filters.category !== "All" || filters.condition !== "any" ||
    filters.minPrice || filters.maxPrice || filters.make || filters.model ||
    filters.minYear || filters.maxYear;
  if (!hasFilters) return null;
  return (
    <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2 mb-3 text-sm">
      <Bell className="w-4 h-4 text-primary shrink-0" />
      <span className="text-muted-foreground flex-1">Save this search and get notified of new matches</span>
      <Button size="sm" variant="outline" onClick={onSave} className="gap-1.5 shrink-0 h-7 text-xs">
        <Save className="w-3 h-3" /> Save Search
      </Button>
    </div>
  );
}

// ── Listing grid skeleton ─────────────────────────────────────
function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Horizontal listing scroll ─────────────────────────────────
function ListingRow({ listings, emptyText }: { listings: any[]; emptyText?: string }) {
  if (!listings.length) return emptyText ? (
    <p className="text-sm text-muted-foreground py-2">{emptyText}</p>
  ) : null;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
      {listings.map(l => (
        <div key={l.id} className="w-52 shrink-0">
          <ListingCard listing={l} compact />
        </div>
      ))}
    </div>
  );
}

// ── Save Search Modal ─────────────────────────────────────────
function SaveSearchModal({ filters, onClose, onSaved }: { filters: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(() => {
    const parts = [];
    if (filters.q) parts.push(filters.q);
    if (filters.category && filters.category !== "All") parts.push(filters.category);
    if (filters.make) parts.push(filters.make);
    return parts.join(" ") || "My search";
  });
  const [notify, setNotify] = useState(true);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/saved-searches", {
      name: name.trim(),
      query: filters.q || "",
      filters: {
        category: filters.category !== "All" ? filters.category : undefined,
        condition: filters.condition !== "any" ? filters.condition : undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        make: filters.make || undefined,
        model: filters.model || undefined,
        minYear: filters.minYear || undefined,
        maxYear: filters.maxYear || undefined,
        location: filters.locationFilter || undefined,
      },
      notify,
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Search saved!", description: notify ? "You'll be notified of new matches." : "Saved without notifications." });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't save search", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Save This Search
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Search name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="mt-1 bg-secondary" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setNotify(n => !n)}
              className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${notify ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${notify ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <div>
              <p className="text-sm font-medium">Notify me</p>
              <p className="text-xs text-muted-foreground">Get notified when new matching listings appear</p>
            </div>
          </label>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()} className="flex-1 gap-1.5">
            <Bell className="w-3.5 h-3.5" /> {saveMutation.isPending ? "Saving..." : "Save & Watch"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Location + Radius Bar ─────────────────────────────────────────────

const SNAP_MARKERS = [
  { miles: 0,   label: "Any" },
  { miles: 10,  label: "10" },
  { miles: 25,  label: "25" },
  { miles: 50,  label: "50" },
  { miles: 100, label: "100" },
  { miles: 250, label: "250" },
  { miles: 500, label: "500" },
];
const MAX_MILES = 500;

function snapMiles(raw: number): number {
  const nearest = SNAP_MARKERS.find(m => Math.abs(m.miles - raw) <= 8);
  return nearest ? nearest.miles : raw;
}
function milesToKm(mi: number): string { return (mi * 1.609).toFixed(0); }

// Reverse-geocode a lat/lng to a city, state string using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const a = data.address || {};
    const STATE_ABBR: Record<string, string> = {
      Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",
      Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",
      Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",
      Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",
      Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV",
      "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
      "North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",
      Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
      Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",
      Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY",
    };
    const city = a.city || a.town || a.village || a.county || "";
    const state = a.state ? (STATE_ABBR[a.state] || a.state) : "";
    return city && state ? `${city}, ${state}` : city || state || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ── Google Maps component ───────────────────────────────────────────
function GoogleMap({
  lat, lng, radiusMiles, onDragEnd,
}: {
  lat: number; lng: number; radiusMiles: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");

  const GOOGLE_API_KEY = useGoogleMapsKey();

  const initMap = useCallback(() => {
    const G = (window as any).google?.maps;
    if (!G || !mapRef.current || mapInstanceRef.current) return;

    const map = new G.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 11,
      mapTypeId: mapType,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false, // we build our own toggle
      styles: [
        { featureType: "all", elementType: "geometry", stylers: [{ color: "#1a1d27" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1117" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3048" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#1e2333" }] },
        { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#1a2510" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0f1117" }] },
      ],
    });
    mapInstanceRef.current = map;

    // Draggable marker
    const marker = new G.Marker({
      position: { lat, lng },
      map,
      draggable: true,
      icon: {
        path: G.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "hsl(25, 95%, 53%)",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2.5,
      },
      title: "Drag to change search location",
      cursor: "grab",
    });
    markerRef.current = marker;

    // Move circle live while dragging
    marker.addListener("drag", () => {
      const pos = marker.getPosition();
      if (circleRef.current) {
        circleRef.current.setCenter(pos);
      }
    });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      onDragEnd(pos.lat(), pos.lng());
    });

    // Circle
    if (radiusMiles > 0) {
      circleRef.current = new G.Circle({
        map,
        center: { lat, lng },
        radius: radiusMiles * 1609.34,
        strokeColor: "hsl(25, 95%, 53%)",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "hsl(25, 95%, 53%)",
        fillOpacity: 0.08,
      });
      map.fitBounds(circleRef.current.getBounds(), 20);
    }
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_API_KEY) return;
    if ((window as any).google?.maps) { initMap(); return; }
    if (!document.getElementById("google-maps-js")) {
      const script = document.createElement("script");
      script.id = "google-maps-js";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => {
        if ((window as any).google?.maps) { clearInterval(poll); initMap(); }
      }, 100);
      return () => clearInterval(poll);
    }
  }, []);

  // Update circle + marker when radius/position changes
  useEffect(() => {
    const G = (window as any).google?.maps;
    const map = mapInstanceRef.current;
    if (!G || !map) return;

    if (markerRef.current) markerRef.current.setPosition({ lat, lng });

    if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }

    if (radiusMiles > 0) {
      circleRef.current = new G.Circle({
        map,
        center: { lat, lng },
        radius: radiusMiles * 1609.34,
        strokeColor: "hsl(25, 95%, 53%)",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "hsl(25, 95%, 53%)",
        fillOpacity: 0.08,
      });
      map.fitBounds(circleRef.current.getBounds(), 20);
    } else {
      map.panTo({ lat, lng });
      map.setZoom(11);
    }
  }, [radiusMiles, lat, lng]);

  // Switch map type
  useEffect(() => {
    if (mapInstanceRef.current) mapInstanceRef.current.setMapTypeId(mapType);
  }, [mapType]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {/* Map type toggle */}
      <div className="absolute top-2 left-2 flex gap-1 z-10">
        {(["roadmap", "satellite"] as const).map(t => (
          <button key={t} onClick={() => setMapType(t)}
            className={`text-[10px] font-semibold px-2 py-1 rounded border transition-all backdrop-blur
              ${mapType === t
                ? "bg-primary text-white border-primary"
                : "bg-card/80 text-muted-foreground border-border hover:border-primary/40"}`}>
            {t === "roadmap" ? "Map" : "Satellite"}
          </button>
        ))}
      </div>
      {/* Drag hint */}
      <div className="absolute bottom-2 left-2 bg-card/80 backdrop-blur text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 pointer-events-none">
        Drag pin to move search center
      </div>
    </div>
  );
}

// ── Leaflet map (fallback — no API key needed) ──────────────────────
function LeafletMap({
  lat, lng, radiusMiles, onDragEnd,
}: {
  lat: number; lng: number; radiusMiles: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    leafletRef.current = L;

    const map = L.map(mapRef.current, {
      center: [lat, lng], zoom: 11,
      zoomControl: true, scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Draggable orange marker
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;background:hsl(25,95%,53%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);cursor:grab"></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
    markerRef.current = marker;

    // Move circle live while dragging
    marker.on("drag", () => {
      const p = marker.getLatLng();
      if (circleRef.current) {
        circleRef.current.setLatLng([p.lat, p.lng]);
      }
    });

    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onDragEndRef.current(p.lat, p.lng);
    });

    // Show "Drag to move" tooltip
    marker.bindTooltip("Drag to move search area", { permanent: false, direction: "top", offset: [0, -12] });
  }, []);

  // Load Leaflet CSS + JS
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if ((window as any).L) { initMap(); }
    else if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => {
        if ((window as any).L) { clearInterval(poll); initMap(); }
      }, 100);
      return () => clearInterval(poll);
    }
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  // Update circle + marker position
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }
    if (radiusMiles > 0) {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusMiles * 1609.34,
        color: "hsl(25, 95%, 53%)", fillColor: "hsl(25, 95%, 53%)",
        fillOpacity: 0.08, weight: 2,
      }).addTo(map);
      map.flyToBounds(circleRef.current.getBounds(), { duration: 0.4, padding: [20, 20] });
    } else {
      map.flyTo([lat, lng], 11, { duration: 0.4 });
    }
  }, [radiusMiles, lat, lng]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: "208px" }} />
      <div className="absolute bottom-2 left-2 bg-white/80 text-[10px] text-gray-700 px-1.5 py-0.5 rounded shadow pointer-events-none">
        Drag pin · scroll to zoom
      </div>
    </div>
  );
}

// ── Unified RadiusMap — uses Google if key present, else Leaflet ────
function RadiusMap({
  lat, lng, radiusMiles, onDragEnd,
}: {
  lat: number; lng: number; radiusMiles: number;
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const GOOGLE_API_KEY = useGoogleMapsKey();
  if (GOOGLE_API_KEY) {
    return <GoogleMap lat={lat} lng={lng} radiusMiles={radiusMiles} onDragEnd={onDragEnd} />;
  }
  return <LeafletMap lat={lat} lng={lng} radiusMiles={radiusMiles} onDragEnd={onDragEnd} />;
}

// ── LocationRadiusBar ────────────────────────────────────────────────
function LocationRadiusBar({
  locationFilter, searchLat, searchLng, radiusMiles,
  onLocationChange, onRadiusChange, onClear,
}: {
  locationFilter: string;
  searchLat: number | undefined;
  searchLng: number | undefined;
  radiusMiles: string;
  onLocationChange: (display: string, coords?: { lat: number; lng: number }) => void;
  onRadiusChange: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Track whether a location pick is in-flight so we don't close the panel
  const pickingLocation = useRef(false);

  const hasLocation = !!searchLat;
  const currentMiles = radiusMiles === "any" ? 0 : Math.max(0, Math.min(MAX_MILES, Number(radiusMiles)));
  const sliderPct = (currentMiles / MAX_MILES) * 100;

  // Auto-open panel when location is set from the pill button
  useEffect(() => {
    if (searchLat && !open) setOpen(true);
  }, [searchLat]);

  // Close on outside click — but not while a location pick is in-flight
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickingLocation.current) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSliderChange = (raw: number) => {
    const snapped = snapMiles(raw);
    onRadiusChange(snapped === 0 ? "any" : String(snapped));
  };

  // When user drags the marker: reverse-geocode and update location
  const handleMapDragEnd = useCallback(async (lat: number, lng: number) => {
    setIsDragging(true);
    const display = await reverseGeocode(lat, lng);
    onLocationChange(display, { lat, lng });
    setIsDragging(false);
  }, [onLocationChange]);

  const activeLabel = hasLocation && currentMiles > 0
    ? `${locationFilter} · ${currentMiles} mi`
    : locationFilter || "Nationwide";

  return (
    <div className="border-b border-border bg-background sticky top-[57px] z-30 shadow-sm" ref={panelRef}>
      <div className="max-w-7xl mx-auto px-4 py-2">

        {/* Collapsed pill */}
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all
              ${open ? "bg-primary/10 border-primary text-primary"
                : hasLocation ? "bg-secondary border-border hover:border-primary/40 text-foreground"
                : "bg-secondary border-border hover:border-primary/40 text-muted-foreground"}`}
            data-testid="button-location-pill">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[220px]">{isDragging ? "Updating location…" : activeLabel}</span>
            {hasLocation && currentMiles > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
          {(locationFilter || currentMiles > 0) && (
            <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Expanded panel */}
        {open && (
          <div className="mt-2 mb-1 bg-card border border-border rounded-2xl overflow-hidden shadow-2xl max-w-lg">

            {/* Map */}
            <div className="relative overflow-hidden" style={{ height: "220px" }}>
              {hasLocation && searchLat && searchLng !== undefined ? (
                <RadiusMap
                  lat={searchLat}
                  lng={searchLng}
                  radiusMiles={currentMiles}
                  onDragEnd={handleMapDragEnd}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/20">
                  <MapPin className="w-7 h-7 opacity-20" />
                  <p className="text-xs">Enter a location below to see the map</p>
                </div>
              )}
            </div>

            <div className="p-4 space-y-5">

              {/* Location input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Your location
                  {isDragging && <span className="ml-2 text-primary normal-case font-normal">Reverse geocoding…</span>}
                </label>
                <LocationPicker
                  value={locationFilter}
                  onChange={(display, coords) => {
                    // Mark as picking so outside-click handler doesn't close panel
                    pickingLocation.current = true;
                    onLocationChange(display, coords);
                    // Keep panel open after selection — clear flag after paint
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => { pickingLocation.current = false; });
                    });
                  }}
                  placeholder="ZIP code or city"
                />
                {locationFilter && !hasLocation && (
                  <p className="text-[10px] text-yellow-400">Pick from the dropdown to pin your location on the map</p>
                )}
              </div>

              {/* Radius slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search radius</label>
                  {hasLocation && currentMiles > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-1">
                        <span className="text-base font-extrabold text-primary">{currentMiles}</span>
                        <span className="text-xs text-primary/80 ml-1">mi</span>
                      </div>
                      <span className="text-muted-foreground text-xs">≈</span>
                      <div className="bg-secondary border border-border rounded-lg px-2 py-1">
                        <span className="text-sm font-bold">{milesToKm(currentMiles)}</span>
                        <span className="text-xs text-muted-foreground ml-1">km</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">Nationwide</span>
                  )}
                </div>

                <div className={`relative ${!hasLocation ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="relative h-2 rounded-full" style={{
                    background: `linear-gradient(to right, hsl(25 95% 53%) ${sliderPct}%, hsl(var(--secondary)) ${sliderPct}%)`
                  }}>
                    {SNAP_MARKERS.filter(m => m.miles > 0).map(m => (
                      <div key={m.miles}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-3 rounded-full"
                        style={{ left: `${(m.miles / MAX_MILES) * 100}%`, background: currentMiles >= m.miles ? "hsl(25 95% 70%)" : "hsl(var(--border))" }}
                      />
                    ))}
                  </div>
                  <input
                    type="range" min={0} max={MAX_MILES} step={1}
                    value={currentMiles}
                    onChange={e => handleSliderChange(Number(e.target.value))}
                    disabled={!hasLocation}
                    className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex justify-between">
                  {SNAP_MARKERS.map(m => (
                    <button key={m.miles}
                      onClick={() => hasLocation && onRadiusChange(m.miles === 0 ? "any" : String(m.miles))}
                      disabled={!hasLocation}
                      className={`text-[10px] font-medium px-1 py-0.5 rounded transition-all
                        ${m.miles === currentMiles ? "text-primary bg-primary/10 font-bold" : "text-muted-foreground hover:text-foreground"}
                        ${!hasLocation ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >{m.label}</button>
                  ))}
                </div>

                {!hasLocation && <p className="text-[10px] text-muted-foreground text-center">Set a location above to enable radius filtering</p>}
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => setOpen(false)} className="gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Apply
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Module-level location memory (persists across navigation, not refresh) ─
// Can't use localStorage in this iframe env, so we use module state.
let _savedLocation = { display: "", lat: undefined as number | undefined, lng: undefined as number | undefined, radius: "any" };

// ── Main HomePage ──────────────────────────────────────────────
export default function HomePage() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const urlParams = new URLSearchParams(location.split("?")[1] || "");

  const [search, setSearch] = useState(urlParams.get("search") || "");
  const [activeSearch, setActiveSearch] = useState(urlParams.get("search") || "");
  const [activeCategory, setActiveCategory] = useState("All");
  const [condition, setCondition] = useState("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [locationFilter, setLocationFilter] = useState(_savedLocation.display);
  const [searchLat, setSearchLat] = useState<number | undefined>(_savedLocation.lat);
  const [searchLng, setSearchLng] = useState<number | undefined>(_savedLocation.lng);
  const [radiusMiles, setRadiusMiles] = useState(_savedLocation.radius);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [minMileage, setMinMileage] = useState("");
  const [maxMileage, setMaxMileage] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "foryou" | "recent">("browse");

  const hasActiveFilters = activeSearch || activeCategory !== "All" || condition !== "any" ||
    minPrice || maxPrice || locationFilter || make || model || minYear || maxYear || minMileage || maxMileage || radiusMiles !== "any";

  const currentFilters = { q: activeSearch, category: activeCategory, condition, minPrice, maxPrice, locationFilter, make, model, minYear, maxYear, radiusMiles };

  // ── Browse listings ──
  // Active search coords — initialized from saved if present
  const [activeSearchLat, setActiveSearchLat] = useState<number | undefined>(_savedLocation.lat);
  const [activeSearchLng, setActiveSearchLng] = useState<number | undefined>(_savedLocation.lng);
  const [activeRadius, setActiveRadius] = useState(_savedLocation.radius);

  // Persist location to module state whenever it changes
  useEffect(() => {
    _savedLocation = { display: locationFilter, lat: searchLat, lng: searchLng, radius: radiusMiles };
    // Also immediately apply to active search so results update without needing Apply Filters
    setActiveSearchLat(searchLat);
    setActiveSearchLng(searchLng);
    setActiveRadius(radiusMiles);
  }, [locationFilter, searchLat, searchLng, radiusMiles]);

  const { data: listings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/search/listings", { q: activeSearch, activeCategory, condition, minPrice, maxPrice, locationFilter, make, model, minYear, maxYear, minMileage, maxMileage, sortBy, activeSearchLat, activeSearchLng, activeRadius }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeSearch) params.set("q", activeSearch);
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (condition !== "any") params.set("condition", condition);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      if (locationFilter) params.set("location", locationFilter);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (minYear) params.set("minYear", minYear);
      if (maxYear) params.set("maxYear", maxYear);
      if (minMileage) params.set("minMileage", minMileage);
      if (maxMileage) params.set("maxMileage", maxMileage);
      if (sortBy !== "default") params.set("sort", sortBy);
      if (activeSearchLat !== undefined) params.set("searchLat", String(activeSearchLat));
      if (activeSearchLng !== undefined) params.set("searchLng", String(activeSearchLng));
      if (activeRadius && activeRadius !== "any") params.set("radiusMiles", activeRadius);
      if (datePosted !== "any") params.set("datePosted", datePosted);
      return apiRequest("GET", `/api/search/listings?${params.toString()}`).then(r => r.json());
    },
  });

  // ── For You recommendations ──
  const sessionId = getSessionId();
  const { data: recommendations = [] } = useQuery<any[]>({
    queryKey: ["/api/recommendations", sessionId],
    queryFn: () => apiRequest("GET", "/api/recommendations", undefined).then(r => r.json()),
    enabled: activeTab === "foryou",
  });

  // ── Recently viewed ──
  const { data: recentlyViewed = [] } = useQuery<any[]>({
    queryKey: ["/api/recently-viewed", sessionId],
    queryFn: () => apiRequest("GET", "/api/recently-viewed", undefined).then(r => r.json()),
    enabled: true, // always fetch — self-referencing in enabled caused TDZ crash
  });

  // ── Saved searches ──
  const { data: savedSearches = [] } = useQuery<any[]>({
    queryKey: ["/api/saved-searches"],
    queryFn: () => apiRequest("GET", "/api/saved-searches").then(r => r.json()),
    enabled: isAuthenticated,
  });

  const deleteSearchMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saved-searches/${id}`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] }),
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setActiveSearch(search.trim());
  };

  const resetFilters = () => {
    setSearch(""); setActiveSearch(""); setActiveCategory("All");
    setCondition("any"); setMinPrice(""); setMaxPrice(""); setLocationFilter("");
    setSearchLat(undefined); setSearchLng(undefined); setRadiusMiles("any");
    setActiveSearchLat(undefined); setActiveSearchLng(undefined); setActiveRadius("any");
    setMake(""); setModel(""); setMinYear(""); setMaxYear("");
    setMinMileage(""); setMaxMileage(""); setSortBy("default"); setDatePosted("any");
  };

  const applySearch = (s: any) => {
    const f = s.filters || {};
    setActiveSearch(s.query || ""); setSearch(s.query || "");
    setActiveCategory(f.category || "All");
    setCondition(f.condition || "any");
    setMinPrice(f.minPrice?.toString() || "");
    setMaxPrice(f.maxPrice?.toString() || "");
    setMake(f.make || ""); setModel(f.model || "");
    setMinYear(f.minYear?.toString() || ""); setMaxYear(f.maxYear?.toString() || "");
    setLocationFilter(f.location || "");
    setActiveTab("browse");
    toast({ title: `Applied "${s.name}"` });
  };

  return (
    <div>
      {/* Hero */}
      <div className="relative bg-card border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1400&q=80)" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 py-10 md:py-14">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-sm font-semibold tracking-wide uppercase">The Motorsports Marketplace</span>
            </div>
            <h1 className="text-display text-4xl md:text-5xl font-extrabold text-foreground mb-4 leading-none">
              Buy. Sell.<br /><span className="text-primary">Ride.</span>
            </h1>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-lg">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-hero-search"
                  placeholder="Search make, model, category..."
                  className="pl-9 h-11 bg-card/90 border-border text-base"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(""); setActiveSearch(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Button type="submit" size="lg" className="h-11 font-bold">Search</Button>
            </form>
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/sell"><Button variant="outline" size="sm">List Your Ride</Button></Link>
              <Link href="/groups"><Button variant="ghost" size="sm">Browse Communities</Button></Link>
              {isAuthenticated && (
                <Link href="/saved">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5" /> Saved Lists
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="relative border-t border-border bg-card/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8 overflow-x-auto">
            {[{ icon: TrendingUp, value: "12,400+", label: "Active Listings" }, { icon: Zap, value: "4,800+", label: "Transactions" }, { icon: Shield, value: "9,200+", label: "Verified Users" }].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2 shrink-0">
                <Icon className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm">{value}</span>
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Always-visible Location + Radius bar ──────────────── */}
      <LocationRadiusBar
        locationFilter={locationFilter}
        searchLat={searchLat}
        searchLng={searchLng}
        radiusMiles={radiusMiles}
        onLocationChange={(display, coords) => {
          setLocationFilter(display);
          setSearchLat(coords?.lat);
          setSearchLng(coords?.lng);
          if (!display) setRadiusMiles("any");
        }}
        onRadiusChange={setRadiusMiles}
        onClear={() => {
          setLocationFilter("");
          setSearchLat(undefined);
          setSearchLng(undefined);
          setRadiusMiles("any");
        }}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Saved searches bar */}
        {isAuthenticated && savedSearches.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Searches</span>
              <Link href="/saved">
                <span className="text-xs text-primary ml-auto hover:underline cursor-pointer">Manage</span>
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {savedSearches.slice(0, 6).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => applySearch(s)}
                  className="flex items-center gap-1.5 shrink-0 text-xs px-3 py-1.5 rounded-full bg-secondary border border-border hover:border-primary/40 hover:text-primary transition-colors"
                  data-testid={`saved-search-${s.id}`}
                >
                  {s.notify ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3 text-muted-foreground" />}
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab bar: Browse / For You / Recently Viewed */}
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          {[
            { key: "browse", label: "Browse", icon: Search },
            { key: "foryou", label: "For You", icon: Sparkles },
            { key: "recent", label: "Recently Viewed", icon: Clock },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── For You tab ── */}
        {activeTab === "foryou" && (
          <div>
            {recommendations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No recommendations yet</p>
                <p className="text-sm mt-1">Browse some listings and we'll start personalizing your feed.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("browse")}>Browse Marketplace</Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Personalized based on what you've viewed
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {recommendations.map((l: any) => <ListingCard key={l.id} listing={l} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Recently Viewed tab ── */}
        {activeTab === "recent" && (
          <div>
            {recentlyViewed.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">Nothing viewed yet</p>
                <p className="text-sm mt-1">Listings you view will appear here.</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("browse")}>Start Browsing</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentlyViewed.map((l: any) => <ListingCard key={l.id} listing={l} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Browse tab ── */}
        {activeTab === "browse" && (
          <>
            {/* Category pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button key={cat}
                  data-testid={`filter-category-${cat.toLowerCase().replace(" ", "-")}`}
                  onClick={() => setActiveCategory(cat)}
                  className={`category-pill shrink-0 border ${activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >{cat}</button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="text-sm text-muted-foreground flex-1 flex items-center gap-2 flex-wrap">
                {isLoading ? "Searching..." : `${listings.length} listing${listings.length !== 1 ? "s" : ""}`}
                {activeSearch && <span className="text-foreground font-medium"> for "{activeSearch}"</span>}
                {activeCategory !== "All" && <span className="text-primary font-medium"> in {activeCategory}</span>}
                {activeSearchLat && activeRadius !== "any" && locationFilter && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                    <MapPin className="w-3 h-3" />
                    {locationFilter} · {activeRadius} mi
                    <button onClick={() => { setLocationFilter(""); setSearchLat(undefined); setSearchLng(undefined); setRadiusMiles("any"); }} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(f => !f)}
                className={`gap-1.5 ${showFilters ? "border-primary text-primary" : ""}`}
                data-testid="button-toggle-filters">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </Button>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44 h-8 text-sm bg-secondary" data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground gap-1" data-testid="button-reset-filters">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </Button>
              )}
            </div>

            {/* Save search banner */}
            {isAuthenticated && (
              <SaveSearchBanner filters={currentFilters} onSave={() => setSaveSearchOpen(true)} />
            )}

            {/* Advanced filters */}
            {showFilters && (
              <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-xs font-medium text-muted-foreground">Condition</label>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Date Posted
                    </label>
                    <Select value={datePosted} onValueChange={setDatePosted}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATE_POSTED_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Make</label>
                    <Input placeholder="e.g. Ford" value={make} onChange={e => setMake(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Model</label>
                    <Input placeholder="e.g. F-150" value={model} onChange={e => setModel(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  {/* Location + radius moved to the always-visible bar above the results */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" />Min Price</label>
                    <Input type="number" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" />Max Price</label>
                    <Input type="number" placeholder="Any" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Year From</label>
                    <Select value={minYear} onValueChange={setMinYear}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Year To</label>
                    <Select value={maxYear} onValueChange={setMaxYear}>
                      <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Max Mileage</label>
                    <Input type="number" placeholder="e.g. 50000" value={maxMileage} onChange={e => setMaxMileage(e.target.value)} className="h-8 text-sm bg-secondary" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSearch} className="gap-1.5">
                    <Search className="w-3.5 h-3.5" /> Apply Filters
                  </Button>
                </div>
              </div>
            )}

            {/* Listings grid */}
            {isLoading ? <ListingGridSkeleton /> :
              listings.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-semibold mb-1">No listings found</p>
                  <p className="text-sm">{hasActiveFilters ? "Try adjusting your search or filters." : "Be the first to list in this category."}</p>
                  {hasActiveFilters && <Button variant="outline" className="mt-4" onClick={resetFilters}>Clear filters</Button>}
                  {!hasActiveFilters && <Link href="/sell"><Button className="mt-4">List Your Ride</Button></Link>}
                </div>
              ) : (
<FeedWithAds listings={listings} />
              )
            }
          </>
        )}
      </div>

      {/* Save search modal */}
      {saveSearchOpen && (
        <SaveSearchModal
          filters={currentFilters}
          onClose={() => setSaveSearchOpen(false)}
          onSaved={() => setSaveSearchOpen(false)}
        />
      )}
    </div>
  );
}
