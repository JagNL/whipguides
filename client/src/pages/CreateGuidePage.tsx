import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ImageUploader, { AvatarUploader } from "@/components/ImageUploader";
import { AnnotationEditorDialog } from "@/components/GuideAnnotations";
import type { Annotation } from "@/components/GuideAnnotations";
import { useCfUrl } from "@/hooks/use-cf-url";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2,
  Car, BookOpen, ListOrdered, Eye, ScanLine,
} from "lucide-react";
import type { GuideStep, GuidePart } from "@/../../server/storage";

const STEPS_LABELS = [
  { label: "Vehicle Info", icon: Car },
  { label: "Guide Details", icon: BookOpen },
  { label: "Steps", icon: ListOrdered },
  { label: "Review & Publish", icon: Eye },
];

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner — anyone can do this" },
  { value: "intermediate", label: "Intermediate — some experience needed" },
  { value: "advanced", label: "Advanced — professional skill level" },
];

const CATEGORIES = [
  "Engine", "Transmission", "Brakes", "Suspension", "Electrical",
  "Interior", "Exterior", "Maintenance", "Performance", "Diagnostics",
  "Jet Ski", "ATV / UTV", "Other",
];

const POPULAR_TOOLS = [
  "Socket set", "Torque wrench", "Oil drain pan", "Jack stands",
  "Floor jack", "Multimeter", "Breaker bar", "Pliers", "Screwdrivers",
  "Allen key set", "Trim removal tool", "Funnel",
];

interface FormData {
  // Step 1
  vehicleMake: string;
  vehicleModel: string;
  vehicleYearStart: string;
  vehicleYearEnd: string;
  // Step 2
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  timeEstimate: string;
  category: string;
  tools: string[];
  parts: GuidePart[];
  coverImageId: string;
  // Step 3
  steps: GuideStep[];
}

const EMPTY_STEP: GuideStep = { title: "", description: "", imageUrls: [], annotations: [], tools: [], estimatedTime: "" };

export default function CreateGuidePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    vehicleMake: "", vehicleModel: "", vehicleYearStart: "", vehicleYearEnd: "",
    title: "", description: "", difficulty: "beginner", timeEstimate: "",
    category: "", tools: [], parts: [], coverImageId: "",
    steps: [{ ...EMPTY_STEP }],
  });
  const cfUrl = useCfUrl();
  const [newTool, setNewTool] = useState("");
  const [newPart, setNewPart] = useState({ name: "", link: "", price: "" });
  // Annotation editor state: { stepIdx, imageUrl }
  const [annotating, setAnnotating] = useState<{ stepIdx: number; imageUrl: string } | null>(null);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="font-medium mb-2">Sign in to write a guide</p>
        <Button variant="ghost" onClick={() => navigate("/guides")} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Back to Guides
        </Button>
      </div>
    );
  }

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/guides", {
        title: form.title,
        description: form.description,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        vehicleYearStart: form.vehicleYearStart,
        vehicleYearEnd: form.vehicleYearEnd,
        difficulty: form.difficulty,
        timeEstimate: form.timeEstimate,
        category: form.category || null,
        tools: form.tools,
        parts: form.parts,
        steps: form.steps.filter(s => s.title || s.description),
        coverImageId: form.coverImageId || null,
        tags: [],
      }).then(r => r.json()),
    onSuccess: (guide) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guides"] });
      toast({ title: "Guide published!", description: "Your guide is now live." });
      navigate(`/guides/${guide.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const update = (key: keyof FormData, val: any) => setForm(f => ({ ...f, [key]: val }));

  const addTool = () => {
    const t = newTool.trim();
    if (t && !form.tools.includes(t)) {
      update("tools", [...form.tools, t]);
      setNewTool("");
    }
  };

  const removeTool = (i: number) => update("tools", form.tools.filter((_, idx) => idx !== i));

  const addPart = () => {
    if (!newPart.name.trim()) return;
    const part: GuidePart = {
      name: newPart.name.trim(),
      link: newPart.link.trim() || undefined,
      price: newPart.price ? Number(newPart.price) : undefined,
    };
    update("parts", [...form.parts, part]);
    setNewPart({ name: "", link: "", price: "" });
  };

  const removePart = (i: number) => update("parts", form.parts.filter((_, idx) => idx !== i));

  const updateStep = (idx: number, key: keyof GuideStep, val: any) => {
    const steps = [...form.steps];
    steps[idx] = { ...steps[idx], [key]: val };
    update("steps", steps);
  };

  const addStep = () => update("steps", [...form.steps, { ...EMPTY_STEP }]);
  const removeStep = (i: number) => update("steps", form.steps.filter((_, idx) => idx !== i));

  const canGoNext = () => {
    if (activeStep === 0) return form.vehicleMake && form.vehicleModel && form.vehicleYearStart && form.vehicleYearEnd;
    if (activeStep === 1) return form.title && form.description && form.difficulty && form.timeEstimate;
    if (activeStep === 2) return form.steps.length > 0 && form.steps.some(s => s.title || s.description);
    return true;
  };

  // ── Step renderers ──────────────────────────────────────────

  const renderVehicleInfo = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="make">Make *</Label>
          <Input
            id="make"
            data-testid="input-vehicle-make"
            placeholder="e.g. Ford, Yamaha, Sea-Doo"
            value={form.vehicleMake}
            onChange={e => update("vehicleMake", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Model *</Label>
          <Input
            id="model"
            data-testid="input-vehicle-model"
            placeholder="e.g. F-150, YZ450F, GTX 300"
            value={form.vehicleModel}
            onChange={e => update("vehicleModel", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yearStart">Year Start *</Label>
          <Input
            id="yearStart"
            data-testid="input-year-start"
            placeholder="e.g. 2018"
            value={form.vehicleYearStart}
            onChange={e => update("vehicleYearStart", e.target.value)}
            maxLength={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="yearEnd">Year End *</Label>
          <Input
            id="yearEnd"
            data-testid="input-year-end"
            placeholder="Same as start, or e.g. 2022"
            value={form.vehicleYearEnd}
            onChange={e => update("vehicleYearEnd", e.target.value)}
            maxLength={4}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter the same year for both start and end if this guide applies to a single model year.
      </p>
    </div>
  );

  const renderGuideDetails = () => (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          data-testid="input-guide-title"
          placeholder="e.g. How to change the oil on a 2020 F-150"
          value={form.title}
          onChange={e => update("title", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="desc">Description *</Label>
        <Textarea
          id="desc"
          data-testid="textarea-guide-description"
          placeholder="Briefly explain what this guide covers, who it's for, and any important notes..."
          value={form.description}
          onChange={e => update("description", e.target.value)}
          className="min-h-[120px] resize-none bg-secondary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Difficulty *</Label>
          <Select value={form.difficulty} onValueChange={v => update("difficulty", v as any)}>
            <SelectTrigger data-testid="select-guide-difficulty" className="bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="time">Time Estimate (hours) *</Label>
          <Input
            id="time"
            data-testid="input-time-estimate"
            type="number"
            placeholder="e.g. 1.5"
            min="0.25"
            step="0.25"
            value={form.timeEstimate}
            onChange={e => update("timeEstimate", e.target.value)}
            className="bg-secondary"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => update("category", v)}>
            <SelectTrigger data-testid="select-guide-category" className="bg-secondary">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cover image */}
      <div className="space-y-1.5">
        <Label>Cover Image</Label>
        <div className="flex items-start gap-3">
          {form.coverImageId && cfUrl && (
            <img
              src={`${cfUrl}/${form.coverImageId}/public`}
              alt="Cover"
              className="w-20 h-20 object-cover rounded-lg border border-border"
            />
          )}
          <AvatarUploader
            currentImageId={form.coverImageId}
            onUpload={(imageId) => update("coverImageId", imageId)}
            label={form.coverImageId ? "Change Cover" : "Upload Cover Image"}
          />
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <Label>Tools Required</Label>
        <div className="flex gap-2">
          <Input
            data-testid="input-add-tool"
            placeholder="Add a tool..."
            value={newTool}
            onChange={e => setNewTool(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTool()}
            className="bg-secondary"
          />
          <Button type="button" variant="secondary" onClick={addTool} size="sm" data-testid="button-add-tool">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {/* Quick-add chips */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {POPULAR_TOOLS.filter(t => !form.tools.includes(t)).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => update("tools", [...form.tools, t])}
              className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border hover:border-primary/40 hover:text-foreground transition-colors"
            >
              + {t}
            </button>
          ))}
        </div>
        {form.tools.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.tools.map((tool, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {tool}
                <button type="button" onClick={() => removeTool(i)} className="hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Parts */}
      <div className="space-y-2">
        <Label>Parts Required</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            data-testid="input-part-name"
            placeholder="Part name"
            value={newPart.name}
            onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))}
            className="bg-secondary"
          />
          <Input
            data-testid="input-part-link"
            placeholder="Buy link (optional)"
            value={newPart.link}
            onChange={e => setNewPart(p => ({ ...p, link: e.target.value }))}
            className="bg-secondary"
          />
          <div className="flex gap-2">
            <Input
              data-testid="input-part-price"
              placeholder="Price (optional)"
              type="number"
              value={newPart.price}
              onChange={e => setNewPart(p => ({ ...p, price: e.target.value }))}
              className="bg-secondary"
            />
            <Button type="button" variant="secondary" onClick={addPart} size="sm" data-testid="button-add-part">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {form.parts.length > 0 && (
          <ul className="space-y-1.5 mt-2">
            {form.parts.map((part, i) => (
              <li key={i} className="flex items-center justify-between gap-2 bg-secondary rounded-lg px-3 py-2 text-sm">
                <span className="font-medium">{part.name}</span>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  {part.price && <span>${part.price}</span>}
                  {part.link && <a href={part.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[120px]">Link</a>}
                  <button type="button" onClick={() => removePart(i)} className="hover:text-destructive transition-colors ml-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const renderStepsEditor = () => (
    <div className="space-y-4">
      {form.steps.map((step, idx) => (
        <div key={idx} className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`step-editor-${idx}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </div>
              <span className="font-semibold text-sm">Step {idx + 1}</span>
            </div>
            {form.steps.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeStep(idx)}
                className="text-destructive hover:text-destructive h-7 w-7 p-0"
                data-testid={`button-remove-step-${idx}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Step Title *</Label>
            <Input
              data-testid={`input-step-title-${idx}`}
              placeholder="e.g. Drain the old oil"
              value={step.title}
              onChange={e => updateStep(idx, "title", e.target.value)}
              className="bg-secondary"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Instructions *</Label>
            <Textarea
              data-testid={`textarea-step-desc-${idx}`}
              placeholder="Describe exactly what to do in this step..."
              value={step.description}
              onChange={e => updateStep(idx, "description", e.target.value)}
              className="min-h-[100px] resize-none bg-secondary"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Estimated Time for This Step</Label>
            <Input
              data-testid={`input-step-time-${idx}`}
              placeholder="e.g. 15 minutes"
              value={step.estimatedTime ?? ""}
              onChange={e => updateStep(idx, "estimatedTime", e.target.value)}
              className="bg-secondary max-w-[180px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Step-specific tools (optional)</Label>
            <Input
              data-testid={`input-step-tools-${idx}`}
              placeholder="Comma-separated, e.g. wrench, funnel"
              value={(step.tools ?? []).join(", ")}
              onChange={e => updateStep(idx, "tools", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              className="bg-secondary"
            />
          </div>

          {/* Step photos + annotation */}
          <div className="space-y-2">
            <Label>Step Photos &amp; Annotations</Label>
            <ImageUploader
              value={step.imageUrls ?? []}
              onChange={urls => updateStep(idx, "imageUrls", urls)}
              maxImages={6}
              label=""
              hint="Upload photos, then annotate with pins showing bolt locations, torque specs, etc."
            />
            {(step.imageUrls ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(step.imageUrls ?? []).map((url, imgIdx) => {
                  const resolvedUrl = url.startsWith("http") || url.startsWith("data:") ? url : `${cfUrl}/${url}/public`;
                  const pinCount = (step.annotations ?? []).filter(a => a.imageUrl === resolvedUrl).length;
                  return (
                    <button
                      key={imgIdx}
                      type="button"
                      onClick={() => setAnnotating({ stepIdx: idx, imageUrl: resolvedUrl })}
                      className="relative group rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                      data-testid={`button-annotate-${idx}-${imgIdx}`}
                    >
                      <img src={resolvedUrl} alt="" className="w-24 h-16 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <ScanLine className="w-4 h-4 text-white" />
                        <span className="text-white text-xs font-semibold">Annotate</span>
                      </div>
                      {pinCount > 0 && (
                        <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {pinCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Annotation editor dialog */}
      {annotating && (() => {
        const step = form.steps[annotating.stepIdx];
        return (
          <AnnotationEditorDialog
            open
            onClose={() => setAnnotating(null)}
            imageUrl={annotating.imageUrl}
            annotations={(step.annotations ?? []) as Annotation[]}
            onChange={anns => updateStep(annotating.stepIdx, "annotations", anns)}
          />
        );
      })()}

      <Button
        type="button"
        variant="outline"
        onClick={addStep}
        className="gap-2 w-full"
        data-testid="button-add-step"
      >
        <Plus className="w-4 h-4" />
        Add Step
      </Button>
    </div>
  );

  const renderReview = () => {
    const year = form.vehicleYearStart === form.vehicleYearEnd
      ? form.vehicleYearStart
      : `${form.vehicleYearStart}–${form.vehicleYearEnd}`;

    return (
      <div className="space-y-5">
        <div className="bg-secondary rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Guide Summary</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Vehicle:</span>
              <p className="font-medium">{year} {form.vehicleMake} {form.vehicleModel}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Difficulty:</span>
              <p className="font-medium capitalize">{form.difficulty}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Time:</span>
              <p className="font-medium">{form.timeEstimate} hours</p>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>
              <p className="font-medium">{form.category || "—"}</p>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">Title:</span>
            <p className="font-semibold">{form.title}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">Description:</span>
            <p className="text-sm line-clamp-3">{form.description}</p>
          </div>
        </div>

        <div className="bg-secondary rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-3">{form.steps.filter(s => s.title).length} Steps</h3>
          <ul className="space-y-1.5">
            {form.steps.filter(s => s.title).map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Step {i + 1}: {step.title}</span>
              </li>
            ))}
          </ul>
        </div>

        {form.tools.length > 0 && (
          <div className="bg-secondary rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-2">{form.tools.length} Tools</h3>
            <div className="flex flex-wrap gap-1.5">
              {form.tools.map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-card border border-border">{t}</span>
              ))}
            </div>
          </div>
        )}

        {form.parts.length > 0 && (
          <div className="bg-secondary rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-2">{form.parts.length} Parts</h3>
            <ul className="space-y-1 text-sm">
              {form.parts.map((p, i) => (
                <li key={i}>{p.name}{p.price ? ` — $${p.price}` : ""}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          By publishing, your guide will be visible to the entire WhipGuides community.
        </p>
      </div>
    );
  };

  const stepContent = [renderVehicleInfo, renderGuideDetails, renderStepsEditor, renderReview];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/guides")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-guides"
        >
          <ChevronLeft className="w-4 h-4" />
          Guides
        </button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-display font-extrabold text-xl">Write a Guide</h1>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center mb-8 gap-y-2">
        {STEPS_LABELS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < activeStep;
          const isActive = idx === activeStep;
          return (
            <div key={idx} className="flex items-center shrink-0">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                {step.label}
              </div>
              {idx < STEPS_LABELS.length - 1 && (
                <ChevronRight className={`w-3.5 h-3.5 mx-1 shrink-0 ${idx < activeStep ? "text-primary" : "text-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-extrabold text-base mb-5 flex items-center gap-2">
          {(() => { const Icon = STEPS_LABELS[activeStep].icon; return <Icon className="w-4 h-4 text-primary" />; })()}
          {STEPS_LABELS[activeStep].label}
        </h2>
        {stepContent[activeStep]()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => activeStep > 0 ? setActiveStep(s => s - 1) : navigate("/guides")}
          className="gap-1.5"
          data-testid="button-prev-step"
        >
          <ChevronLeft className="w-4 h-4" />
          {activeStep === 0 ? "Cancel" : "Back"}
        </Button>

        {activeStep < STEPS_LABELS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setActiveStep(s => s + 1)}
            disabled={!canGoNext()}
            className="gap-1.5"
            data-testid="button-next-step"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !canGoNext()}
            className="gap-2 font-semibold"
            data-testid="button-publish-guide"
          >
            {submitMutation.isPending ? "Publishing..." : "Publish Guide"}
          </Button>
        )}
      </div>
    </div>
  );
}
