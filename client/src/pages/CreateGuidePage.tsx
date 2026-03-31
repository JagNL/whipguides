import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AvatarUploader, CoverUploader } from "@/components/ImageUploader";
import { AnnotationEditorDialog } from "@/components/GuideAnnotations";
import type { Annotation } from "@/components/GuideAnnotations";
import {
  ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2,
  BookOpen, ListOrdered, Eye, Layers, Info, Link2, Wrench,
} from "lucide-react";
import type { GuidePart } from "@/../../server/storage";
import { GUIDE_VERTICALS, detectEmbedUrl } from "@/lib/guide-verticals";
import {
  VerticalPicker, SubjectDetails, StepEditor,
  EmbedBadge, VERTICAL_ICONS,
} from "@/components/CreateGuideSteps";
import { useCfUrl } from "@/hooks/use-cf-url";
import { guideUrl } from "@/lib/utils";

const STEPS_LABELS = [
  { label: "Category", icon: Layers },
  { label: "Subject", icon: Info },
  { label: "Details", icon: BookOpen },
  { label: "Steps", icon: ListOrdered },
  { label: "Publish", icon: Eye },
];

const DIFFICULTIES = [
  { value: "beginner", label: "Beginner — anyone can do this" },
  { value: "intermediate", label: "Intermediate — some experience needed" },
  { value: "advanced", label: "Advanced — professional skill level" },
];

type Step = {
  title: string; description: string; imageUrls: string[];
  annotations: any[]; tools: string[]; estimatedTime: string; embedUrl: string;
};

interface FormData {
  vertical: string;
  subjectData: Record<string, string>;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  timeEstimate: string;
  category: string;
  tools: string[];
  parts: GuidePart[];
  coverImageId: string;
  headerEmbedUrl: string;
  tags: string;
  steps: Step[];
  seriesId: number | null;
  newSeriesTitle: string;
  businessPageId: number | null;
}

const EMPTY_STEP: Step = {
  title: "", description: "", imageUrls: [], annotations: [], tools: [], estimatedTime: "", embedUrl: "",
};

export default function CreateGuidePage({ guideId }: { guideId?: number }) {
  const isEditMode = !!guideId;
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cfUrl = useCfUrl();

  const [activeStep, setActiveStep] = useState(isEditMode ? 2 : 0); // edit starts at Details
  const [form, setForm] = useState<FormData>({
    vertical: "", subjectData: {},
    title: "", description: "", difficulty: "beginner", timeEstimate: "",
    category: "", tools: [], parts: [], coverImageId: "",
    headerEmbedUrl: "", tags: "",
    steps: [{ ...EMPTY_STEP }],
    seriesId: null, newSeriesTitle: "", businessPageId: null,
  });
  const [formReady, setFormReady] = useState(!isEditMode); // false until existing guide loads
  const [newTool, setNewTool] = useState("");
  const [newPart, setNewPart] = useState({ name: "", link: "", price: "" });
  const [annotating, setAnnotating] = useState<{ stepIdx: number; imageUrl: string } | null>(null);
  const [createSeries, setCreateSeries] = useState(false);

  // ── Edit mode: fetch existing guide and pre-populate form ──
  const { data: existingGuide } = useQuery<any>({
    queryKey: ["/api/guides", guideId],
    queryFn: () => apiRequest("GET", `/api/guides/${guideId}`).then(r => r.json()),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (!existingGuide) return;
    const g = existingGuide as any;
    setForm({
      vertical: g.vertical || "automotive",
      subjectData: g.subjectData || {},
      title: g.title || "",
      description: g.description || "",
      difficulty: g.difficulty || "beginner",
      timeEstimate: String(g.timeEstimate || ""),
      category: g.category || "",
      tools: Array.isArray(g.tools) ? g.tools : [],
      parts: Array.isArray(g.parts) ? g.parts : [],
      coverImageId: g.coverImageId || "",
      headerEmbedUrl: g.headerEmbedUrl || "",
      tags: Array.isArray(g.tags) ? g.tags.join(", ") : (g.tags || ""),
      steps: Array.isArray(g.steps) && g.steps.length > 0
        ? g.steps.map((s: any) => ({
            title: s.title || "",
            description: s.description || "",
            imageUrls: Array.isArray(s.imageUrls) ? s.imageUrls : [],
            annotations: Array.isArray(s.annotations) ? s.annotations : [],
            tools: Array.isArray(s.tools) ? s.tools : [],
            estimatedTime: s.estimatedTime || "",
            embedUrl: s.embedUrl || "",
          }))
        : [{ ...EMPTY_STEP }],
      seriesId: g.seriesId || null,
      newSeriesTitle: "",
      businessPageId: g.businessPageId || null,
    });
    setFormReady(true);
  }, [existingGuide]);

  const selectedVertical = GUIDE_VERTICALS.find(v => v.key === form.vertical);

  const { data: seriesList } = useQuery<any[]>({
    queryKey: ["/api/guide-series", { authorId: "me" }],
    queryFn: () => apiRequest("GET", "/api/guide-series?authorId=me").then(r => r.json()),
    enabled: activeStep === 4 && isAuthenticated,
  });

  const { data: businessPages } = useQuery<any[]>({
    queryKey: ["/api/business/user/owned"],
    queryFn: () => apiRequest("GET", "/api/business/user/owned").then(r => r.json()),
    enabled: activeStep === 4 && isAuthenticated,
  });

  // ── ALL HOOKS MUST BE ABOVE EARLY RETURNS (Rules of Hooks) ──
  const submitMutation = useMutation({
    mutationFn: async () => {
      let seriesId = form.seriesId;
      if (createSeries && form.newSeriesTitle.trim()) {
        const s = await apiRequest("POST", "/api/guide-series", { title: form.newSeriesTitle.trim() }).then(r => r.json());
        seriesId = s.id;
      }
      const payload = {
        title: form.title, description: form.description,
        vertical: form.vertical, subjectData: form.subjectData,
        vehicleMake: form.subjectData.make ?? "",
        vehicleModel: form.subjectData.model ?? "",
        vehicleYearStart: form.subjectData.year_start ?? "",
        vehicleYearEnd: form.subjectData.year_end ?? form.subjectData.year_start ?? "",
        difficulty: form.difficulty, timeEstimate: form.timeEstimate,
        category: form.category || null, tools: form.tools, parts: form.parts,
        steps: form.steps.filter(s => s.title || s.description),
        coverImageId: form.coverImageId || null,
        headerEmbedUrl: form.headerEmbedUrl || null,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        seriesId, businessPageId: form.businessPageId,
      };
      // PATCH for edit, POST for new
      if (isEditMode) {
        return apiRequest("PATCH", `/api/guides/${guideId}`, payload).then(r => r.json());
      }
      return apiRequest("POST", "/api/guides", payload).then(r => r.json());
    },
    onSuccess: (guide) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guides"] });
      if (guide?.id) queryClient.setQueryData(["/api/guides", guide.id], guide);
      toast({
        title: isEditMode ? "Guide updated!" : "Guide published!",
        description: isEditMode ? "Your changes are live." : "Your guide is now live.",
      });
      if (!guide?.id) { navigate("/guides"); return; }
      navigate(guideUrl(guide.id, guide.title));
    },
    onError: (e: any) => toast({ title: isEditMode ? "Couldn't save changes" : "Couldn't publish guide", description: e.message, variant: "destructive" }),
  });

  const update = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));
  const updateSubject = (field: string, val: string) =>
    setForm(f => ({ ...f, subjectData: { ...f.subjectData, [field]: val } }));
  const addTool = () => {
    const t = newTool.trim();
    if (t && !form.tools.includes(t)) { update("tools", [...form.tools, t]); setNewTool(""); }
  };
  const removeTool = (i: number) => update("tools", form.tools.filter((_, idx) => idx !== i));
  const addPart = () => {
    if (!newPart.name.trim()) return;
    update("parts", [...form.parts, { name: newPart.name.trim(), link: newPart.link.trim() || undefined, price: newPart.price ? Number(newPart.price) : undefined }]);
    setNewPart({ name: "", link: "", price: "" });
  };
  const removePart = (i: number) => update("parts", form.parts.filter((_, idx) => idx !== i));
  const updateStep = (idx: number, key: string, val: any) => {
    const steps = [...form.steps]; steps[idx] = { ...steps[idx], [key]: val }; update("steps", steps);
  };

  const canGoNext = () => {
    if (activeStep === 0) return !!form.vertical;
    if (activeStep === 1) {
      if (!selectedVertical) return false;
      if (form.vertical === "automotive") return !!(form.subjectData.make && form.subjectData.model && form.subjectData.year_start);
      return Object.values(form.subjectData).some(v => v && v !== "na");
    }
    if (activeStep === 2) return !!(form.title && form.description && form.difficulty && form.timeEstimate);
    if (activeStep === 3) return form.steps.length > 0 && form.steps.some(s => s.title);
    return true;
  };

  const popularTools = selectedVertical?.tools ?? [];
  const categories = selectedVertical?.categories ?? ["Other"];

  const renderGuideDetails = () => (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" data-testid="input-guide-title" placeholder="e.g. How to change the oil on a 2020 F-150"
          value={form.title} onChange={e => update("title", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="desc">Description *</Label>
        <Textarea id="desc" data-testid="textarea-guide-description"
          placeholder="Briefly explain what this guide covers, who it's for, and any important notes..."
          value={form.description} onChange={e => update("description", e.target.value)}
          className="min-h-[120px] resize-none bg-secondary" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Difficulty *</Label>
          <Select value={form.difficulty} onValueChange={v => update("difficulty", v as any)}>
            <SelectTrigger data-testid="select-guide-difficulty" className="bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time">Time (hours) *</Label>
          <Input id="time" data-testid="input-time-estimate" type="number" placeholder="e.g. 1.5" min="0.25" step="0.25"
            value={form.timeEstimate} onChange={e => update("timeEstimate", e.target.value)} className="bg-secondary" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => update("category", v)}>
            <SelectTrigger data-testid="select-guide-category" className="bg-secondary"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Cover Image</Label>
        <CoverUploader
          currentUrl={form.coverImageId
            ? (form.coverImageId.startsWith('http') || form.coverImageId.startsWith('data:')
                ? form.coverImageId
                : cfUrl ? `${cfUrl}/${form.coverImageId}/public` : null)
            : null}
          aspectRatio={16 / 9}
          label="Upload cover image"
          onUpload={(id, previewUrl) => update("coverImageId", previewUrl || id)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="headerEmbed" className="flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
          YouTube or Instagram URL <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="headerEmbed" data-testid="input-header-embed-url"
          placeholder="https://youtube.com/watch?v=... or https://instagram.com/p/..."
          value={form.headerEmbedUrl} onChange={e => update("headerEmbedUrl", e.target.value)} className="bg-secondary" />
        <div className="flex items-center gap-2 min-h-[20px]">
          {form.headerEmbedUrl && <EmbedBadge url={form.headerEmbedUrl} />}
          {form.headerEmbedUrl && !detectEmbedUrl(form.headerEmbedUrl).type && (
            <span className="text-xs text-muted-foreground">Enter a valid YouTube or Instagram URL</span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tags">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
        <Input id="tags" data-testid="input-guide-tags" placeholder="e.g. oil change, maintenance, DIY"
          value={form.tags} onChange={e => update("tags", e.target.value)} className="bg-secondary" />
      </div>
      <div className="space-y-2">
        <Label>Tools Required</Label>
        <div className="flex gap-2">
          <Input data-testid="input-add-tool" placeholder="Add a tool..." value={newTool}
            onChange={e => setNewTool(e.target.value)} onKeyDown={e => e.key === "Enter" && addTool()} className="bg-secondary" />
          <Button type="button" variant="secondary" onClick={addTool} size="sm" data-testid="button-add-tool"><Plus className="w-4 h-4" /></Button>
        </div>
        {popularTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {popularTools.filter(t => !form.tools.includes(t)).map(t => (
              <button key={t} type="button" onClick={() => update("tools", [...form.tools, t])}
                className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border hover:border-primary/40 hover:text-foreground transition-colors">
                + {t}
              </button>
            ))}
          </div>
        )}
        {form.tools.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {form.tools.map((tool, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {tool}
                <button type="button" onClick={() => removeTool(i)} className="hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label>Parts Required</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input data-testid="input-part-name" placeholder="Part name" value={newPart.name}
            onChange={e => setNewPart(p => ({ ...p, name: e.target.value }))} className="bg-secondary" />
          <Input data-testid="input-part-link" placeholder="Buy link (optional)" value={newPart.link}
            onChange={e => setNewPart(p => ({ ...p, link: e.target.value }))} className="bg-secondary" />
          <div className="flex gap-2">
            <Input data-testid="input-part-price" placeholder="Price (optional)" type="number" value={newPart.price}
              onChange={e => setNewPart(p => ({ ...p, price: e.target.value }))} className="bg-secondary" />
            <Button type="button" variant="secondary" onClick={addPart} size="sm" data-testid="button-add-part"><Plus className="w-4 h-4" /></Button>
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
                  <button type="button" onClick={() => removePart(i)} className="hover:text-destructive transition-colors ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const renderReview = () => {
    const Icon = selectedVertical ? (VERTICAL_ICONS[selectedVertical.icon] ?? Wrench) : BookOpen;
    return (
      <div className="space-y-5">
        <div className="bg-secondary rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Guide Summary</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Category:</span>
              <p className="font-medium flex items-center gap-1.5 mt-0.5"><Icon className="w-3.5 h-3.5 text-primary" />{selectedVertical?.label ?? "—"}</p></div>
            <div><span className="text-muted-foreground">Difficulty:</span><p className="font-medium capitalize mt-0.5">{form.difficulty}</p></div>
            <div><span className="text-muted-foreground">Time:</span><p className="font-medium mt-0.5">{form.timeEstimate} hours</p></div>
            <div><span className="text-muted-foreground">Category:</span><p className="font-medium mt-0.5">{form.category || "—"}</p></div>
          </div>
          {Object.keys(form.subjectData).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {Object.entries(form.subjectData).filter(([, v]) => v && v !== "na").map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">{v}</span>
              ))}
            </div>
          )}
          <div><span className="text-muted-foreground text-sm">Title:</span><p className="font-semibold">{form.title}</p></div>
          <div><span className="text-muted-foreground text-sm">Description:</span><p className="text-sm line-clamp-3">{form.description}</p></div>
        </div>
        <div className="bg-secondary rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{form.steps.filter(s => s.title).length} Steps</h3>
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add / Edit Steps
            </button>
          </div>
          <ul className="space-y-1.5">
            {form.steps.filter(s => s.title).map((step, i) => (
              <li key={i}
                className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={() => setActiveStep(3)}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Step {i + 1}: {step.title}</span>
              </li>
            ))}
          </ul>
          {form.steps.filter(s => s.title).length === 0 && (
            <button
              type="button"
              onClick={() => setActiveStep(3)}
              className="w-full text-sm text-primary hover:text-primary/80 py-2 border border-dashed border-primary/30 rounded-lg transition-colors"
            >
              + Add steps
            </button>
          )}
        </div>
        <div className="bg-secondary rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">Add to a Series <span className="text-muted-foreground font-normal">(optional)</span></h3>
          {!createSeries ? (
            <Select value={form.seriesId ? String(form.seriesId) : "none"}
              onValueChange={v => {
                if (v === "create_new") { setCreateSeries(true); update("seriesId", null); }
                else update("seriesId", v === "none" ? null : Number(v));
              }}>
              <SelectTrigger data-testid="select-series" className="bg-card"><SelectValue placeholder="No series" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No series</SelectItem>
                <SelectItem value="create_new">+ Create new series...</SelectItem>
                {seriesList?.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.title} ({s.guideCount ?? 0} guides)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-2">
              <Input data-testid="input-new-series-title" placeholder="Series title..." value={form.newSeriesTitle}
                onChange={e => update("newSeriesTitle", e.target.value)} className="bg-card" autoFocus />
              <Button type="button" variant="outline" size="sm" onClick={() => { setCreateSeries(false); update("newSeriesTitle", ""); }}>Cancel</Button>
            </div>
          )}
        </div>
        {businessPages && businessPages.length > 0 && (
          <div className="bg-secondary rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Publish under a business page <span className="text-muted-foreground font-normal">(optional)</span></h3>
            <Select value={form.businessPageId ? String(form.businessPageId) : "none"}
              onValueChange={v => update("businessPageId", v === "none" ? null : Number(v))}>
              <SelectTrigger data-testid="select-business-page" className="bg-card"><SelectValue placeholder="Personal profile" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Personal profile</SelectItem>
                {businessPages.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-xs text-muted-foreground">By publishing, your guide will be visible to the entire WhipGuides community.</p>
      </div>
    );
  };

  const stepContent = [
    () => <VerticalPicker vertical={form.vertical} onSelect={key => { update("vertical", key); update("subjectData", {}); setActiveStep(1); }} />,
    () => <SubjectDetails verticalKey={form.vertical} subjectData={form.subjectData} onChange={updateSubject} />,
    renderGuideDetails,
    () => (
      <>
        <StepEditor steps={form.steps} onUpdate={updateStep}
          onAdd={() => update("steps", [...form.steps, { ...EMPTY_STEP }])}
          onRemove={i => update("steps", form.steps.filter((_, idx) => idx !== i))}
          onAnnotate={setAnnotating} />
        {annotating && (
          <AnnotationEditorDialog open onClose={() => setAnnotating(null)}
            imageUrl={annotating.imageUrl}
            annotations={(form.steps[annotating.stepIdx].annotations ?? []) as Annotation[]}
            onChange={anns => updateStep(annotating.stepIdx, "annotations", anns)} />
        )}
      </>
    ),
    renderReview,
  ];

  const stepTitle = ["What are you making a guide about?", "Subject Details", "Guide Details", "Steps", "Review & Publish"];

  // ── Early returns AFTER all hooks ───────────────────────────
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

  if (isEditMode && !formReady) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
        <div className="h-64 bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/guides")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-guides">
          <ChevronLeft className="w-4 h-4" /> Guides
        </button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-display font-extrabold text-xl">{isEditMode ? "Edit Guide" : "Write a Guide"}</h1>
      </div>

      {/* Breadcrumb steps — completed steps are clickable to jump back */}
      <div className="flex flex-wrap items-center mb-8 gap-y-2">
        {STEPS_LABELS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < activeStep;
          const isActive = idx === activeStep;
          return (
            <div key={idx} className="flex items-center shrink-0">
              <button
                type="button"
                disabled={!isDone && !isActive}
                onClick={() => isDone && setActiveStep(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "text-primary hover:bg-primary/10 cursor-pointer"
                      : "text-muted-foreground cursor-default"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {step.label}
              </button>
              {idx < STEPS_LABELS.length - 1 && (
                <ChevronRight className={`w-3.5 h-3.5 mx-1 shrink-0 ${idx < activeStep ? "text-primary" : "text-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h2 className="font-extrabold text-base mb-5 flex items-center gap-2">
          {(() => { const Icon = STEPS_LABELS[activeStep].icon; return <Icon className="w-4 h-4 text-primary" />; })()}
          {stepTitle[activeStep]}
        </h2>
        {stepContent[activeStep]()}
      </div>

      {activeStep > 0 && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => setActiveStep(s => s - 1)} className="gap-1.5" data-testid="button-prev-step">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {activeStep < STEPS_LABELS.length - 1 ? (
            <Button type="button" onClick={() => setActiveStep(s => s + 1)} disabled={!canGoNext()} className="gap-1.5" data-testid="button-next-step">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="button" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} className="gap-2 font-semibold" data-testid="button-publish-guide">
              {submitMutation.isPending
                ? (isEditMode ? "Saving..." : "Publishing...")
                : (isEditMode ? "Save Changes" : "Publish Guide")}
            </Button>
          )}
        </div>
      )}

      {activeStep === 0 && (
        <Button type="button" variant="ghost" onClick={() => navigate("/guides")} className="gap-1.5 text-muted-foreground" data-testid="button-cancel-create">
          <ChevronLeft className="w-4 h-4" /> Cancel
        </Button>
      )}
    </div>
  );
}
