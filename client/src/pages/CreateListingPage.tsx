import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Camera, DollarSign, MapPin, Tag, Gauge, CheckSquare } from "lucide-react";
import { useState } from "react";

const CATEGORIES = ["Cars", "Trucks", "ATVs", "Jet Skis", "Motorcycles", "Boats", "Snowmobiles", "Parts & Accessories", "Other"];
const CONDITIONS = ["Like New", "Excellent", "Good", "Fair"];

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Please write a more detailed description"),
  price: z.coerce.number().min(1, "Enter a valid price"),
  category: z.string().min(1, "Select a category"),
  condition: z.string().min(1, "Select a condition"),
  location: z.string().min(2, "Enter a location"),
  year: z.coerce.number().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  mileage: z.coerce.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

const STEPS = [
  { id: 1, label: "Category & Condition" },
  { id: 2, label: "Details" },
  { id: 3, label: "Photos & Price" },
];

export default function CreateListingPage() {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      category: "",
      condition: "",
      location: "",
      year: undefined,
      make: "",
      model: "",
      mileage: undefined,
    },
  });

  const { mutate: createListing, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("POST", "/api/listings", {
        ...data,
        images: ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80"],
        createdAt: "Just now",
      }).then(r => r.json()),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "Listing posted!", description: "Your item is now live on WhipGuides." });
      navigate(`/listing/${listing.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to post listing. Try again.", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormData) => {
    if (step < 3) { setStep(s => s + 1); return; }
    createListing(data);
  };

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-display text-3xl font-extrabold mb-1">List Your Ride</h1>
        <p className="text-muted-foreground text-sm">Reach thousands of qualified buyers in your area.</p>
      </div>

      {/* Step progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${i > 0 ? "flex-1" : ""}`}>
                {i > 0 && (
                  <div className={`flex-1 h-0.5 transition-colors ${step > i ? "bg-primary" : "bg-border"}`} />
                )}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  step > s.id ? "bg-primary text-primary-foreground" :
                  step === s.id ? "bg-primary/20 text-primary border-2 border-primary" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {step > s.id ? "✓" : s.id}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map(s => (
            <span key={s.id} className={`text-center ${step === s.id ? "text-primary font-semibold" : ""}`}
              style={{ flex: 1 }}>{s.label}</span>
          ))}
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">

            {/* Step 1: Category + Condition */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">What are you selling?</h2>
                </div>

                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-testid="select-category">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="condition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition *</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      {CONDITIONS.map(cond => (
                        <button
                          key={cond}
                          type="button"
                          data-testid={`button-condition-${cond.toLowerCase().replace(" ", "-")}`}
                          onClick={() => field.onChange(cond)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                            field.value === cond
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <CheckSquare className={`w-4 h-4 ${field.value === cond ? "text-primary" : "text-muted-foreground"}`} />
                            {cond}
                          </div>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" />Location *</FormLabel>
                    <FormControl>
                      <Input data-testid="input-location" placeholder="City, State (e.g., Austin, TX)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Tell us about it</h2>
                </div>

                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Listing Title *</FormLabel>
                    <FormControl>
                      <Input data-testid="input-title" placeholder="e.g., 2022 Ford F-250 Super Duty — Lifted 4x4" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="year" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl><Input data-testid="input-year" type="number" placeholder="2022" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="make" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make</FormLabel>
                      <FormControl><Input data-testid="input-make" placeholder="Ford" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="model" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl><Input data-testid="input-model" placeholder="F-250" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="mileage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mileage / Hours</FormLabel>
                    <FormControl><Input data-testid="input-mileage" type="number" placeholder="34000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-description"
                        placeholder="Describe your vehicle in detail. Include mods, service history, reason for selling..."
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}

            {/* Step 3: Photos + Price */}
            {step === 3 && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="w-5 h-5 text-primary" />
                  <h2 className="font-bold text-lg">Photos & Price</h2>
                </div>

                {/* Photo upload stub */}
                <div>
                  <FormLabel>Photos</FormLabel>
                  <div className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer bg-secondary/30"
                    data-testid="input-photo-upload">
                    <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium mb-1">Drop photos here or click to upload</p>
                    <p className="text-xs text-muted-foreground">Up to 20 photos · JPG, PNG, HEIC</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Listings with photos get 4× more views.</p>
                </div>

                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-primary" />Asking Price *
                    </FormLabel>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                      <FormControl>
                        <Input
                          data-testid="input-price"
                          type="number"
                          placeholder="0"
                          className="pl-7"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Preview summary */}
                <div className="bg-secondary rounded-lg p-4 text-sm">
                  <p className="font-semibold mb-2 text-foreground">Listing Preview</p>
                  <p className="font-bold text-primary text-lg">${(form.watch("price") || 0).toLocaleString()}</p>
                  <p className="text-foreground font-medium">{form.watch("title") || "(no title)"}</p>
                  <p className="text-muted-foreground">{form.watch("condition")} · {form.watch("category")} · {form.watch("location")}</p>
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} data-testid="button-prev-step">
                ← Back
              </Button>
            ) : <div />}
            <Button
              type="submit"
              disabled={isPending}
              className="font-bold px-8"
              data-testid="button-next-step"
            >
              {isPending ? "Posting..." : step < 3 ? "Continue →" : "Post Listing"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
