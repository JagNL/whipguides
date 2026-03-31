// Sub-components for CreateGuidePage wizard steps
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AvatarUploader } from "@/components/ImageUploader";
import ImageUploader from "@/components/ImageUploader";
import { AnnotationEditorDialog } from "@/components/GuideAnnotations";
import type { Annotation } from "@/components/GuideAnnotations";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import {
  Plus, Trash2, CheckCircle2, ScanLine, Link2,
  Car, Waves, Target, Music2, Cpu, Trophy, Wrench,
  Youtube, Instagram,
} from "lucide-react";
import { GUIDE_VERTICALS, detectEmbedUrl } from "@/lib/guide-verticals";

export const VERTICAL_ICONS: Record<string, React.ElementType> = {
  Car, Waves, Target, Music2, Cpu, Trophy, Wrench,
};

export function EmbedBadge({ url }: { url: string }) {
  const { type, label } = detectEmbedUrl(url);
  if (!type) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
      type === "youtube" ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-purple-500/15 text-purple-400 border border-purple-500/20"
    }`}>
      {type === "youtube" ? <Youtube className="w-3 h-3" /> : <Instagram className="w-3 h-3" />}
      ✓ {label}
    </span>
  );
}

// ── Step 0: Vertical Picker ───────────────────────────────────
export function VerticalPicker({ vertical, onSelect }: {
  vertical: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">Choose the category that best fits your guide.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {GUIDE_VERTICALS.map(v => {
          const Icon = VERTICAL_ICONS[v.icon] ?? Wrench;
          const isSelected = vertical === v.key;
          return (
            <button
              key={v.key}
              type="button"
              data-testid={`vertical-card-${v.key}`}
              onClick={() => onSelect(v.key)}
              className={`relative group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all bg-gradient-to-br ${v.color} ${
                isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`p-2 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-background/50 text-foreground"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">{v.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{v.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: Subject Details ───────────────────────────────────
export function SubjectDetails({ verticalKey, subjectData, onChange }: {
  verticalKey: string;
  subjectData: Record<string, string>;
  onChange: (field: string, val: string) => void;
}) {
  const v = GUIDE_VERTICALS.find(x => x.key === verticalKey);
  if (!v) return null;
  const Icon = VERTICAL_ICONS[v.icon] ?? Wrench;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2 w-fit">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold text-foreground">{v.label}</span> Guide
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {v.subjects.map(subject => (
          <div key={subject.field} className="space-y-1.5">
            <Label htmlFor={`subject-${subject.field}`}>{subject.label}</Label>
            {subject.type === "select" ? (
              <Select value={subjectData[subject.field] ?? ""} onValueChange={val => onChange(subject.field, val)}>
                <SelectTrigger id={`subject-${subject.field}`} data-testid={`select-subject-${subject.field}`} className="bg-secondary">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="na">N/A</SelectItem>
                  {subject.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`subject-${subject.field}`}
                data-testid={`input-subject-${subject.field}`}
                placeholder={subject.placeholder}
                value={subjectData[subject.field] ?? ""}
                onChange={e => onChange(subject.field, e.target.value)}
                className="bg-secondary"
              />
            )}
          </div>
        ))}
      </div>
      {v.compliance === "firearms" && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3 text-sm">
          <p className="font-semibold text-amber-400 mb-0.5">Firearms compliance notice</p>
          <p className="text-xs text-amber-400/80">Guides must comply with all applicable federal and state laws. No illegal modifications.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Steps Editor sub-component ───────────────────────
export function StepEditor({ steps, onUpdate, onAdd, onRemove, onAnnotate }: {
  steps: any[];
  onUpdate: (idx: number, key: string, val: any) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onAnnotate: (info: { stepIdx: number; imageUrl: string }) => void;
}) {
  const cfUrl = useCfUrl();
  return (
    <div className="space-y-4">
      {steps.map((step: any, idx: number) => (
        <div key={idx} className="bg-card border border-border rounded-xl p-5 space-y-4" data-testid={`step-editor-${idx}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{idx + 1}</div>
              <span className="font-semibold text-sm">Step {idx + 1}</span>
            </div>
            {steps.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(idx)}
                className="text-destructive hover:text-destructive h-7 w-7 p-0" data-testid={`button-remove-step-${idx}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Step Title *</Label>
            <Input data-testid={`input-step-title-${idx}`} placeholder="e.g. Drain the old oil"
              value={step.title} onChange={e => onUpdate(idx, "title", e.target.value)} className="bg-secondary" />
          </div>
          <div className="space-y-1.5">
            <Label>Instructions</Label>
            <Textarea data-testid={`textarea-step-desc-${idx}`} placeholder="Describe exactly what to do in this step..."
              value={step.description} onChange={e => onUpdate(idx, "description", e.target.value)}
              className="min-h-[100px] resize-none bg-secondary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estimated Time</Label>
              <Input data-testid={`input-step-time-${idx}`} placeholder="e.g. 15 minutes"
                value={step.estimatedTime ?? ""} onChange={e => onUpdate(idx, "estimatedTime", e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Step-specific tools</Label>
              <Input data-testid={`input-step-tools-${idx}`} placeholder="Comma-separated"
                value={(step.tools ?? []).join(", ")}
                onChange={e => onUpdate(idx, "tools", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                className="bg-secondary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
              Step Video URL <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input data-testid={`input-step-embed-${idx}`} placeholder="https://youtube.com/watch?v=..."
              value={step.embedUrl ?? ""} onChange={e => onUpdate(idx, "embedUrl", e.target.value)} className="bg-secondary" />
            {step.embedUrl && <EmbedBadge url={step.embedUrl} />}
          </div>
          <div className="space-y-2">
            <Label>Step Photos &amp; Annotations</Label>
            <ImageUploader value={step.imageUrls ?? []} onChange={urls => onUpdate(idx, "imageUrls", urls)} maxImages={6}
              label="" hint="Upload photos, then annotate with pins." />
            {(step.imageUrls ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(step.imageUrls ?? []).map((url: string, imgIdx: number) => {
                  const resolved = cfImageUrl(cfUrl, url) || url;
                  const pins = (step.annotations ?? []).filter((a: any) => a.imageUrl === resolved).length;
                  return (
                    <button key={imgIdx} type="button" onClick={() => onAnnotate({ stepIdx: idx, imageUrl: resolved })}
                      className="relative group rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                      data-testid={`button-annotate-${idx}-${imgIdx}`}>
                      <img src={resolved} alt="" className="w-24 h-16 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <ScanLine className="w-4 h-4 text-white" />
                        <span className="text-white text-xs font-semibold">Annotate</span>
                      </div>
                      {pins > 0 && <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{pins}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={onAdd} className="gap-2 w-full" data-testid="button-add-step">
        <Plus className="w-4 h-4" /> Add Step
      </Button>
    </div>
  );
}
