import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";
import { VideoUploader, type VideoUploadResult } from "@/components/VideoUploader";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useAppConfig } from "@/hooks/use-cf-url";
import { useAuth } from "@/hooks/use-auth";
import ImageUploader from "@/components/ImageUploader";
import LocationPicker from "@/components/LocationPicker";
import {
  DollarSign, MapPin, Tag, Gauge, CheckSquare, Wrench, Package,
  Car, ChevronRight, ChevronLeft, Camera, Sparkles,
} from "lucide-react";

// ── Listing type definitions ──────────────────────────────────
const LISTING_TYPES = [
  {
    id: "vehicle",
    label: "Vehicle",
    icon: "🚗",
    description: "Car, truck, motorcycle, ATV, jet ski, boat...",
    color: "border-blue-500/30 bg-blue-500/5",
    activeColor: "border-blue-500 bg-blue-500/15 text-blue-400",
  },
  {
    id: "parts",
    label: "Parts & Accessories",
    icon: "🔧",
    description: "Engine parts, wheels, seats, body panels, covers...",
    color: "border-orange-500/30 bg-orange-500/5",
    activeColor: "border-orange-500 bg-orange-500/15 text-orange-400",
  },
  {
    id: "general",
    label: "General Item",
    icon: "📦",
    description: "Furniture, electronics, tools, clothing, collectibles...",
    color: "border-purple-500/30 bg-purple-500/5",
    activeColor: "border-purple-500 bg-purple-500/15 text-purple-400",
  },
] as const;

type ListingType = "vehicle" | "parts" | "general";

// ── Categories by type ────────────────────────────────────────
const VEHICLE_CATEGORIES = [
  "Cars", "Trucks", "SUVs & Crossovers", "Motorcycles", "ATVs",
  "UTVs / Side-by-Sides", "Dirt Bikes", "Jet Skis / PWC", "Boats",
  "Snowmobiles", "RVs & Campers", "Trailers", "Classic & Antique Vehicles",
];

const PARTS_CATEGORIES = [
  "Engine & Drivetrain", "Suspension & Steering", "Brakes",
  "Body & Exterior", "Interior", "Wheels & Tires", "Electrical",
  "Performance Parts", "Audio & Electronics", "Towing & Hauling",
  "Boat Parts & Marine", "ATV / UTV Parts", "Motorcycle Parts",
  "Jet Ski Parts", "Tools & Equipment", "Safety & Protective Gear",
];

const GENERAL_CATEGORIES = [
  "Furniture & Home", "Electronics & Gadgets", "Clothing & Apparel",
  "Sporting Goods", "Outdoor & Camping", "Garden & Patio",
  "Collectibles & Antiques", "Firearms & Hunting", "Jewelry & Watches",
  "Musical Instruments", "Books & Media", "Toys & Games",
  "Baby & Kids", "Health & Beauty", "Pet Supplies",
  "Business & Industrial", "Other",
];

const CONDITIONS = ["New", "Like New", "Excellent", "Good", "Fair", "Parts Only"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => String(CURRENT_YEAR - i));

// ── Form field component ──────────────────────────────────────
function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CreateListingPage() {
  const [step, setStep] = useState(0); // 0=type, 1=details, 2=photos+price
  const [listingType, setListingType] = useState<ListingType>("vehicle");
  const [uploadedImageIds, setUploadedImageIds] = useState<string[]>([]);
  const [listingVideo, setListingVideo] = useState<VideoUploadResult | null>(null);
  const config = useAppConfig();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [freeItem, setFreeItem] = useState(false);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  // Vehicle fields
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  // Parts fields
  const [fitsMake, setFitsMake] = useState("");
  const [fitsModel, setFitsModel] = useState("");
  const [fitsYearMin, setFitsYearMin] = useState("");
  const [fitsYearMax, setFitsYearMax] = useState("");
  const [partNumber, setPartNumber] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h2 className="text-display text-2xl font-extrabold mb-2">Sign in to list an item</h2>
        <p className="text-muted-foreground mb-6">Create a free account to reach thousands of buyers.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const { mutate: createListing, isPending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/listings", {
        title: title.trim(),
        description: description.trim(),
        price: freeItem ? 0 : Number(price),
        category,
        condition,
        location: location.trim(),
        latitude: locationLat,
        longitude: locationLng,
        images: uploadedImageIds,
        videoId:           listingVideo?.videoId || null,
        videoHlsUrl:       listingVideo?.hlsUrl || null,
        videoThumbnailUrl: listingVideo?.thumbnailUrl || null,
        listingType,
        // Vehicle
        year: year ? Number(year) : undefined,
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        mileage: mileage ? Number(mileage) : undefined,
        // Parts
        fitsMake: fitsMake.trim() || undefined,
        fitsModel: fitsModel.trim() || undefined,
        fitsYearMin: fitsYearMin ? Number(fitsYearMin) : undefined,
        fitsYearMax: fitsYearMax ? Number(fitsYearMax) : undefined,
        partNumber: partNumber.trim() || undefined,
      }).then(r => r.json()),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "Listing posted!", description: "Your item is now live." });
      navigate(`/listing/${listing.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message || "Failed to post listing.", variant: "destructive" }),
  });

  const canProceed = () => {
    if (step === 0) return true; // type always selected
    if (step === 1) {
      if (!title.trim() || title.trim().length < 5) return false;
      if (!description.trim() || description.trim().length < 20) return false;
      if (!category) return false;
      if (!condition) return false;
      if (!location.trim()) return false;
      return true;
    }
    if (step === 2) {
      return freeItem || (!!price && Number(price) >= 0);
    }
    return true;
  };

  const handleNext = () => {
    if (step < 2) setStep(s => s + 1);
    else createListing();
  };

  const categories = listingType === "vehicle" ? VEHICLE_CATEGORIES
    : listingType === "parts" ? PARTS_CATEGORIES
    : GENERAL_CATEGORIES;

  const STEPS = ["What are you selling?", "Item Details", "Photos & Price"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-display text-3xl font-extrabold mb-1">
          {step === 0 ? "What are you selling?" : "List Your Item"}
        </h1>
        <p className="text-muted-foreground text-sm">Reach thousands of buyers on WhipGuides.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            {i > 0 && <div className={`flex-1 h-0.5 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-primary/20 text-primary border-2 border-primary" :
              "bg-secondary text-muted-foreground"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">

        {/* ── Step 0: Listing Type ── */}
        {step === 0 && (
          <div className="space-y-3">
            {LISTING_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => { setListingType(type.id); setCategory(""); }}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  listingType === type.id ? type.activeColor : `${type.color} hover:border-border`
                }`}
                data-testid={`type-${type.id}`}
              >
                <span className="text-3xl shrink-0">{type.icon}</span>
                <div>
                  <p className="font-bold text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                </div>
                {listingType === type.id && (
                  <CheckSquare className="w-5 h-5 ml-auto shrink-0 mt-0.5" />
                )}
              </button>
            ))}

            {/* Category quick-select after type chosen */}
            {listingType && (
              <div className="pt-2">
                <Field label="Category" required>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-secondary" data-testid="select-category">
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Item Details ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">
                {LISTING_TYPES.find(t => t.id === listingType)?.icon}
              </span>
              <div>
                <p className="font-bold text-sm">{LISTING_TYPES.find(t => t.id === listingType)?.label}</p>
                <p className="text-xs text-muted-foreground">{category}</p>
              </div>
              <button onClick={() => setStep(0)} className="ml-auto text-xs text-primary hover:underline">Change</button>
            </div>

            {/* Vehicle-specific fields */}
            {listingType === "vehicle" && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Year">
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="bg-secondary h-9" data-testid="select-year">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any year</SelectItem>
                      {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Make">
                  <Input placeholder="Ford, Yamaha..." value={make} onChange={e => setMake(e.target.value)} className="bg-secondary h-9" data-testid="input-make" />
                </Field>
                <Field label="Model">
                  <Input placeholder="F-150, YZ450F..." value={model} onChange={e => setModel(e.target.value)} className="bg-secondary h-9" data-testid="input-model" />
                </Field>
                <Field label="Mileage / Hours">
                  <Input type="number" placeholder="34,000" value={mileage} onChange={e => setMileage(e.target.value)} className="bg-secondary h-9" data-testid="input-mileage" />
                </Field>
                <Field label="VIN (optional)" hint="Helps build buyer trust">
                  <Input placeholder="1HGCM82633A..." value={vin} onChange={e => setVin(e.target.value)} className="bg-secondary h-9 col-span-2" />
                </Field>
              </div>
            )}

            {/* Parts-specific fields */}
            {listingType === "parts" && (
              <div className="bg-secondary/60 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Fits Vehicle (optional — helps buyers find you)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field label="Year From">
                    <Select value={fitsYearMin} onValueChange={setFitsYearMin}>
                      <SelectTrigger className="bg-card h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Year To">
                    <Select value={fitsYearMax} onValueChange={setFitsYearMax}>
                      <SelectTrigger className="bg-card h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Make">
                    <Input placeholder="Ford, Yamaha..." value={fitsMake} onChange={e => setFitsMake(e.target.value)} className="bg-card h-9" />
                  </Field>
                  <Field label="Model">
                    <Input placeholder="F-150..." value={fitsModel} onChange={e => setFitsModel(e.target.value)} className="bg-card h-9" />
                  </Field>
                </div>
                <Field label="Part Number (optional)">
                  <Input placeholder="e.g. OEM-12345" value={partNumber} onChange={e => setPartNumber(e.target.value)} className="bg-card h-9 max-w-xs" />
                </Field>
              </div>
            )}

            {/* Title */}
            <Field label="Title" required hint={
              listingType === "vehicle" ? "e.g., '2022 Ford F-250 Super Duty — Lifted 4x4'" :
              listingType === "parts" ? "e.g., 'K&N Cold Air Intake fits 2015-2022 F-150'" :
              "e.g., 'Ashley 3-piece sectional sofa — like new'"
            }>
              <Input
                data-testid="input-title"
                placeholder={
                  listingType === "vehicle" ? "Year Make Model + key details" :
                  listingType === "parts" ? "Part name + what it fits" :
                  "Describe what you're selling"
                }
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-secondary"
              />
              <div className="flex justify-end">
                <span className={`text-xs ${title.length < 5 ? "text-muted-foreground" : "text-primary"}`}>
                  {title.length}/80
                </span>
              </div>
            </Field>

            {/* Description */}
            <Field label="Description" required hint="More detail = more serious buyers">
              <Textarea
                data-testid="input-description"
                placeholder={
                  listingType === "vehicle"
                    ? "Describe condition, service history, modifications, reason for selling, any issues..."
                    : listingType === "parts"
                    ? "Describe condition, why you're selling, installation notes, compatibility notes..."
                    : "Describe the item, its condition, dimensions, age, any defects..."
                }
                rows={5}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-secondary resize-none"
              />
            </Field>

            {/* Condition */}
            <Field label="Condition" required>
              <div className="grid grid-cols-3 gap-2">
                {(listingType === "parts" || listingType === "general"
                  ? CONDITIONS
                  : CONDITIONS.filter(c => c !== "Parts Only")
                ).map(cond => (
                  <button key={cond} type="button"
                    onClick={() => setCondition(cond)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                      condition === cond
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                    }`}
                    data-testid={`button-condition-${cond.toLowerCase().replace(/ /g, "-")}`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </Field>

            {/* Location */}
            <Field label="Location" required>
              <LocationPicker
                data-testid="input-location"
                value={location}
                onChange={(display, coords) => {
                  setLocation(display);
                  setLocationLat(coords?.lat);
                  setLocationLng(coords?.lng);
                }}
                placeholder="City, State or ZIP code"
              />
              {locationLat && (
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" /> Location pinned — buyers can search by distance
                </p>
              )}
            </Field>
          </div>
        )}

        {/* ── Step 2: Photos + Price ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">Photos & Price</h2>
            </div>

            <ImageUploader
              value={uploadedImageIds}
              onChange={setUploadedImageIds}
              maxImages={20}
              label="Photos"
              hint="Listings with 5+ photos get 4× more views. First photo is your cover."
            />

            {/* Video (1 per listing, 60 sec max) */}
            {config.videoListingEnabled && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">Walk-Around Video</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Optional · 60 sec max</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">A short video dramatically increases buyer interest. Show the vehicle running, walk around, engine bay, etc.</p>
                <VideoUploader
                  context="listing"
                  onUploaded={setListingVideo}
                  onRemove={() => setListingVideo(null)}
                  currentVideo={listingVideo}
                />
              </div>
            )}

            {/* Price */}
            <Field label="Asking Price" required>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeItem}
                    onChange={e => setFreeItem(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                    data-testid="checkbox-free"
                  />
                  <span className="text-sm">Give away for free</span>
                </label>
                {!freeItem && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <Input
                      data-testid="input-price"
                      type="number"
                      placeholder="0"
                      className="pl-7 bg-secondary"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </Field>

            {/* Preview */}
            <div className="bg-secondary rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2 text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Preview
              </p>
              <p className="font-bold text-primary text-xl">{freeItem ? "FREE" : price ? `$${Number(price).toLocaleString()}` : "$—"}</p>
              <p className="text-foreground font-medium">{title || "(no title)"}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {condition} · {category} · {location}
                {listingType === "vehicle" && year && make && ` · ${year} ${make} ${model}`}
                {listingType === "parts" && fitsMake && ` · Fits ${fitsMake}${fitsModel ? " " + fitsModel : ""}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{uploadedImageIds.length} photo{uploadedImageIds.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5" data-testid="button-prev-step">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        ) : <div />}
        <Button
          type="button"
          onClick={handleNext}
          disabled={!canProceed() || isPending}
          className="font-bold px-8 gap-1.5"
          data-testid="button-next-step"
        >
          {isPending ? "Posting..." :
            step < 2 ? <>Continue <ChevronRight className="w-4 h-4" /></> :
            "Post Listing"
          }
        </Button>
      </div>
    </div>
  );
}
