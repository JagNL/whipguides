import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Youtube,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const CATEGORIES = [
  "Dealership",
  "Auto Repair",
  "Parts Supplier",
  "Motorsports Shop",
  "Custom Shop",
  "Towing",
  "Detailing",
  "Rental",
  "Firearms Dealer",
  "Marine",
  "General",
];

const STEPS = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Contact" },
  { id: 3, label: "Social" },
];

interface FormData {
  name: string;
  tagline: string;
  description: string;
  category: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  instagram: string;
  facebook: string;
  youtube: string;
}

const initialForm: FormData = {
  name: "", tagline: "", description: "", category: "",
  website: "", phone: "", email: "", address: "", city: "", state: "", zip: "",
  instagram: "", facebook: "", youtube: "",
};

export function CreateBusinessPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/business", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Business page created!", description: "You can now manage and post updates." });
      navigate(`/business/${data.slug}`);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-white/60">Sign in to create a business page.</div>
      </div>
    );
  }

  const canNext1 = form.name.trim().length >= 2 && form.category;
  const canNext2 = true; // contact is optional

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Create Business Page</h1>
        <p className="text-white/50 text-sm">Share your business with the WhipGuides community.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              step > s.id ? "bg-orange-500 text-white" :
              step === s.id ? "bg-orange-500 text-white" :
              "bg-white/10 text-white/40"
            }`}>
              {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
            </div>
            <span className={`text-sm ${step === s.id ? "text-white font-medium" : "text-white/40"}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/15 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Basics */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <Label className="text-white/70 mb-1.5 block">Business Name *</Label>
            <Input
              data-testid="input-business-name"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Smith's Auto Repair"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              maxLength={100}
            />
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 block">Category *</Label>
            <Select value={form.category} onValueChange={v => set("category", v)}>
              <SelectTrigger data-testid="select-category" className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Choose a category..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10">
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="text-white hover:bg-white/5">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 block">Tagline</Label>
            <Input
              data-testid="input-tagline"
              value={form.tagline}
              onChange={e => set("tagline", e.target.value)}
              placeholder="The area's most trusted transmission shop"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              maxLength={150}
            />
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 block">About Your Business</Label>
            <Textarea
              data-testid="textarea-description"
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Tell the community about your business, what you specialize in, your history, etc."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[110px] resize-none"
              maxLength={1000}
            />
            <div className="text-right text-xs text-white/30 mt-1">{form.description.length}/1000</div>
          </div>
        </div>
      )}

      {/* Step 2 — Contact */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white/70 mb-1.5 block flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Phone</Label>
              <Input
                data-testid="input-phone"
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <div>
              <Label className="text-white/70 mb-1.5 block flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Email</Label>
              <Input
                data-testid="input-email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="info@yourbusiness.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 block flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />Website</Label>
            <Input
              data-testid="input-website"
              value={form.website}
              onChange={e => set("website", e.target.value)}
              placeholder="https://www.yourbusiness.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 block flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Address</Label>
            <Input
              data-testid="input-address"
              value={form.address}
              onChange={e => set("address", e.target.value)}
              placeholder="1234 Main Street"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mb-2"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                data-testid="input-city"
                value={form.city}
                onChange={e => set("city", e.target.value)}
                placeholder="City"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 col-span-1"
              />
              <Input
                data-testid="input-state"
                value={form.state}
                onChange={e => set("state", e.target.value)}
                placeholder="State"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                maxLength={2}
              />
              <Input
                data-testid="input-zip"
                value={form.zip}
                onChange={e => set("zip", e.target.value)}
                placeholder="ZIP"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                maxLength={10}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Social */}
      {step === 3 && (
        <div className="space-y-5">
          <p className="text-white/50 text-sm">Link your social profiles so followers can find you everywhere.</p>

          <div>
            <Label className="text-white/70 mb-1.5 flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-400" />Instagram
            </Label>
            <Input
              data-testid="input-instagram"
              value={form.instagram}
              onChange={e => set("instagram", e.target.value)}
              placeholder="@yourbusiness"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 flex items-center gap-2">
              <Facebook className="w-4 h-4 text-blue-400" />Facebook
            </Label>
            <Input
              data-testid="input-facebook"
              value={form.facebook}
              onChange={e => set("facebook", e.target.value)}
              placeholder="facebook.com/yourbusiness"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div>
            <Label className="text-white/70 mb-1.5 flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-400" />YouTube
            </Label>
            <Input
              data-testid="input-youtube"
              value={form.youtube}
              onChange={e => set("youtube", e.target.value)}
              placeholder="@yourchannel"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Summary preview */}
          <div className="mt-4 p-4 rounded-xl bg-white/4 border border-white/8 space-y-1 text-sm">
            <div className="font-semibold text-white">{form.name || "—"}</div>
            <div className="text-white/50">{form.category} {form.city && form.state ? `· ${form.city}, ${form.state}` : ""}</div>
            {form.tagline && <div className="text-white/60 text-xs italic">{form.tagline}</div>}
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between mt-8">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="text-white/60">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => navigate("/business")} className="text-white/60">
            Cancel
          </Button>
        )}

        {step < 3 ? (
          <Button
            data-testid="btn-next"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && !canNext1}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            data-testid="btn-create-business"
            onClick={() => createMutation.mutate(form)}
            disabled={createMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
            ) : (
              <><Building2 className="w-4 h-4 mr-2" />Create Page</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
