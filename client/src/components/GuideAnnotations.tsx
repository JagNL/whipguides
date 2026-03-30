/**
 * GuideAnnotations.tsx
 *
 * Two exports:
 *  - AnnotationEditor   — authoring: click image to place pins, fill details, drag, delete
 *  - AnnotatedImage     — viewing:   image with interactive pins, hover/tap tooltips
 *
 * Annotations are stored as { x, y } percentages so they are resolution-independent.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Wrench, AlertTriangle, Info, Ruler, Droplets, Settings2,
  X, Plus, GripVertical, Check, Trash2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
export type AnnotationType = "fastener" | "torque" | "warning" | "note" | "measurement" | "fluid";

export interface Annotation {
  id: string;
  imageUrl: string;
  x: number; // 0–100
  y: number; // 0–100
  type: AnnotationType;
  label: string;
  detail: string;
  size?: string;
  torqueSpec?: string;
  socketSize?: string;
  qty?: number;
}

// ─── Config per type ──────────────────────────────────────────
const TYPE_CONFIG: Record<AnnotationType, {
  icon: React.ElementType;
  color: string;       // Tailwind text color
  bg: string;          // Tailwind bg color
  border: string;      // Tailwind border color
  label: string;
  detailPlaceholder: string;
}> = {
  fastener:    { icon: Settings2,    color: "text-orange-400",  bg: "bg-orange-500",   border: "border-orange-400",  label: "Fastener",    detailPlaceholder: "e.g. M10×1.25 · 35 ft-lbs · 17mm socket" },
  torque:      { icon: Wrench,       color: "text-yellow-400",  bg: "bg-yellow-500",   border: "border-yellow-400",  label: "Torque Spec", detailPlaceholder: "e.g. 45 ft-lbs" },
  warning:     { icon: AlertTriangle,color: "text-red-400",     bg: "bg-red-500",      border: "border-red-400",     label: "Warning",     detailPlaceholder: "e.g. Do not overtighten — will crack housing" },
  note:        { icon: Info,         color: "text-blue-400",    bg: "bg-blue-500",     border: "border-blue-400",    label: "Note",        detailPlaceholder: "e.g. Apply threadlocker before installing" },
  measurement: { icon: Ruler,        color: "text-purple-400",  bg: "bg-purple-500",   border: "border-purple-400",  label: "Measurement", detailPlaceholder: "e.g. Gap should be 0.040\"" },
  fluid:       { icon: Droplets,     color: "text-cyan-400",    bg: "bg-cyan-500",     border: "border-cyan-400",    label: "Fluid",       detailPlaceholder: "e.g. Apply RTV silicone sealant, 1/8\" bead" },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Pin marker (shared by editor + viewer) ───────────────────
function Pin({
  annotation, index, active, editing, onClick,
  onDragEnd,
}: {
  annotation: Annotation;
  index: number;
  active?: boolean;
  editing?: boolean;
  onClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
}) {
  const cfg = TYPE_CONFIG[annotation.type];
  const Icon = cfg.icon;
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onDragEnd) return;
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    const container = containerRef.current?.closest("[data-annotation-container]") as HTMLElement;
    if (!container) return;

    const move = (me: MouseEvent) => {
      if (!dragging.current) return;
      const rect = container.getBoundingClientRect();
      const x = Math.min(100, Math.max(0, ((me.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((me.clientY - rect.top) / rect.height) * 100));
      if (containerRef.current) {
        containerRef.current.style.left = `${x}%`;
        containerRef.current.style.top = `${y}%`;
      }
    };
    const up = (me: MouseEvent) => {
      dragging.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const rect = container.getBoundingClientRect();
      const x = Math.min(100, Math.max(0, ((me.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((me.clientY - rect.top) / rect.height) * 100));
      onDragEnd(x, y);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [onDragEnd]);

  return (
    <div
      ref={containerRef}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
    >
      <button
        type="button"
        onClick={onClick}
        onMouseDown={onDragEnd ? handleMouseDown : undefined}
        className={`
          relative flex items-center justify-center w-7 h-7 rounded-full
          ${cfg.bg} border-2 border-white/80 shadow-lg
          transition-transform duration-150
          ${active ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-transparent" : "hover:scale-110"}
          ${onDragEnd ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
          ${editing ? "animate-bounce" : ""}
        `}
        data-testid={`annotation-pin-${annotation.id}`}
        title={annotation.label}
      >
        <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
        {/* Number badge */}
        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-background border border-white/50 text-[8px] font-bold text-foreground flex items-center justify-center leading-none">
          {index + 1}
        </span>
        {/* Pulse ring */}
        {!active && !editing && (
          <span className={`absolute inset-0 rounded-full ${cfg.bg} opacity-40 animate-ping`} style={{ animationDuration: "2.5s" }} />
        )}
      </button>
    </div>
  );
}

// ─── Tooltip shown when pin is active ─────────────────────────
function PinTooltip({ annotation, onClose }: { annotation: Annotation; onClose: () => void }) {
  const cfg = TYPE_CONFIG[annotation.type];
  const Icon = cfg.icon;
  return (
    <div className="absolute z-30 w-64 bg-popover border border-border rounded-xl shadow-2xl p-3 text-left"
      style={{ left: `calc(${annotation.x}% + 18px)`, top: `calc(${annotation.y}% - 16px)`, transform: annotation.x > 60 ? "translateX(-100%) translateX(-36px)" : undefined }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className={`flex items-center gap-1.5 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide">{cfg.label}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {annotation.label && (
        <p className="font-semibold text-sm text-foreground mb-1">{annotation.label}</p>
      )}
      {annotation.detail && (
        <p className="text-xs text-muted-foreground leading-relaxed">{annotation.detail}</p>
      )}
      {(annotation.size || annotation.torqueSpec || annotation.socketSize || annotation.qty) && (
        <div className="mt-2 pt-2 border-t border-border grid grid-cols-2 gap-1">
          {annotation.size && <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Size:</span> {annotation.size}</span>}
          {annotation.torqueSpec && <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Torque:</span> {annotation.torqueSpec}</span>}
          {annotation.socketSize && <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Socket:</span> {annotation.socketSize}</span>}
          {annotation.qty && <span className="text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">Qty:</span> {annotation.qty}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Annotation Form ───────────────────────────────────────────
function AnnotationForm({
  value, onChange, onSave, onCancel,
}: {
  value: Partial<Annotation>;
  onChange: (a: Partial<Annotation>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const cfg = value.type ? TYPE_CONFIG[value.type] : null;
  const showFastenerFields = value.type === "fastener" || value.type === "torque";

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(TYPE_CONFIG) as AnnotationType[]).map(t => {
            const c = TYPE_CONFIG[t];
            const Ic = c.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ ...value, type: t })}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  value.type === t
                    ? `${c.bg} border-transparent text-white`
                    : "border-border text-muted-foreground hover:border-primary/40 bg-secondary/40"
                }`}
              >
                <Ic className="w-3 h-3 shrink-0" /> {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label</label>
        <Input
          value={value.label || ""}
          onChange={e => onChange({ ...value, label: e.target.value })}
          placeholder={value.type === "fastener" ? "e.g. Intake manifold bolt" : "Short label"}
          className="bg-secondary text-sm h-8"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Details</label>
        <Textarea
          value={value.detail || ""}
          onChange={e => onChange({ ...value, detail: e.target.value })}
          placeholder={cfg?.detailPlaceholder || "Enter details..."}
          className="bg-secondary text-sm resize-none min-h-[60px]"
          rows={2}
        />
      </div>

      {showFastenerFields && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Size</label>
            <Input value={value.size || ""} onChange={e => onChange({ ...value, size: e.target.value })} placeholder='e.g. M10×1.25' className="bg-secondary text-xs h-7 px-2" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Torque</label>
            <Input value={value.torqueSpec || ""} onChange={e => onChange({ ...value, torqueSpec: e.target.value })} placeholder="e.g. 35 ft-lbs" className="bg-secondary text-xs h-7 px-2" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Socket</label>
            <Input value={value.socketSize || ""} onChange={e => onChange({ ...value, socketSize: e.target.value })} placeholder="e.g. 17mm" className="bg-secondary text-xs h-7 px-2" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Qty</label>
            <Input type="number" min={1} value={value.qty || ""} onChange={e => onChange({ ...value, qty: Number(e.target.value) })} placeholder="1" className="bg-secondary text-xs h-7 px-2" />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={!value.type || !value.label} className="flex-1 h-8 gap-1.5">
          <Check className="w-3.5 h-3.5" /> Save Pin
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-8">
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANNOTATION EDITOR  (used in CreateGuidePage)
// ═══════════════════════════════════════════════════════════════
export function AnnotationEditor({
  imageUrl,
  annotations,
  onChange,
}: {
  imageUrl: string;
  annotations: Annotation[];
  onChange: (annotations: Annotation[]) => void;
}) {
  const [editing, setEditing] = useState<Partial<Annotation> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = new pin
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (editing) return; // already editing
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPos({ x, y });
    setEditing({ type: "fastener", label: "", detail: "", imageUrl });
    setEditingId(null);
  }, [editing, imageUrl]);

  const handleSave = useCallback(() => {
    if (!editing || !editing.type || !editing.label) return;

    if (editingId) {
      // Update existing
      onChange(annotations.map(a => a.id === editingId ? { ...a, ...editing } as Annotation : a));
    } else {
      // New pin
      const pos = pendingPos || { x: 50, y: 50 };
      onChange([...annotations, {
        id: uid(),
        imageUrl,
        x: pos.x, y: pos.y,
        ...editing,
      } as Annotation]);
    }
    setEditing(null);
    setEditingId(null);
    setPendingPos(null);
  }, [editing, editingId, annotations, onChange, pendingPos, imageUrl]);

  const handleDelete = useCallback((id: string) => {
    onChange(annotations.filter(a => a.id !== id));
    if (activePin === id) setActivePin(null);
    if (editingId === id) { setEditing(null); setEditingId(null); }
  }, [annotations, onChange, activePin, editingId]);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    onChange(annotations.map(a => a.id === id ? { ...a, x, y } : a));
  }, [annotations, onChange]);

  const startEditPin = useCallback((ann: Annotation) => {
    setEditing({ ...ann });
    setEditingId(ann.id);
    setActivePin(null);
  }, []);

  const myAnnotations = annotations.filter(a => a.imageUrl === imageUrl);

  return (
    <div className="space-y-3">
      {/* Instruction bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-primary" />
          Click anywhere on the image to place a pin · Drag pins to reposition
        </p>
        <Badge variant="outline" className="text-xs">
          {myAnnotations.length} pin{myAnnotations.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        {/* Image canvas */}
        <div
          ref={imgRef}
          className={`relative flex-1 rounded-xl overflow-hidden border-2 transition-colors select-none ${
            editing && !editingId ? "border-primary border-dashed cursor-crosshair" : "border-border cursor-crosshair"
          }`}
          onClick={handleImageClick}
          data-annotation-container
        >
          <img src={imageUrl} alt="Annotate this step" className="w-full block" draggable={false} />

          {/* Pending placement indicator */}
          {pendingPos && !editingId && (
            <div
              className="absolute w-7 h-7 rounded-full border-2 border-dashed border-primary bg-primary/20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${pendingPos.x}%`, top: `${pendingPos.y}%` }}
            />
          )}

          {/* Existing pins */}
          {myAnnotations.map((ann, i) => (
            <Pin
              key={ann.id}
              annotation={ann}
              index={i}
              active={activePin === ann.id}
              editing={editingId === ann.id}
              onClick={() => setActivePin(activePin === ann.id ? null : ann.id)}
              onDragEnd={(x, y) => handleDragEnd(ann.id, x, y)}
            />
          ))}

          {/* Active pin tooltip */}
          {activePin && (() => {
            const ann = myAnnotations.find(a => a.id === activePin);
            return ann ? (
              <PinTooltip annotation={ann} onClose={() => setActivePin(null)} />
            ) : null;
          })()}
        </div>

        {/* Sidebar: form or pin list */}
        <div className="sm:w-64 shrink-0">
          {editing ? (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {editingId ? "Edit Pin" : "New Pin"}
              </p>
              <AnnotationForm
                value={editing}
                onChange={setEditing}
                onSave={handleSave}
                onCancel={() => { setEditing(null); setEditingId(null); setPendingPos(null); }}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              {myAnnotations.length === 0 ? (
                <div className="bg-secondary/40 rounded-xl border border-dashed border-border p-4 text-center">
                  <Plus className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Click the image to add your first pin</p>
                </div>
              ) : (
                myAnnotations.map((ann, i) => {
                  const cfg = TYPE_CONFIG[ann.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={ann.id} className={`flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${activePin === ann.id ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 bg-secondary/30"}`}
                      onClick={() => setActivePin(activePin === ann.id ? null : ann.id)}>
                      <div className={`w-5 h-5 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{ann.label || "Unlabeled"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{ann.detail}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={e => { e.stopPropagation(); startEditPin(ann); }}
                          className="p-0.5 text-muted-foreground hover:text-foreground">
                          <GripVertical className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={e => { e.stopPropagation(); handleDelete(ann.id); }}
                          className="p-0.5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANNOTATED IMAGE VIEWER  (used in GuideDetailPage)
// ═══════════════════════════════════════════════════════════════
export function AnnotatedImage({
  imageUrl,
  annotations,
  stepIndex,
}: {
  imageUrl: string;
  annotations: Annotation[];
  stepIndex: number;
}) {
  const [activePin, setActivePin] = useState<string | null>(null);
  const myAnnotations = annotations.filter(a => a.imageUrl === imageUrl);

  // Close tooltip on outside click
  useEffect(() => {
    if (!activePin) return;
    const handler = () => setActivePin(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [activePin]);

  if (!imageUrl) return null;

  return (
    <div className="relative rounded-xl overflow-hidden border border-border select-none" data-annotation-container>
      <img
        src={imageUrl}
        alt={`Step ${stepIndex + 1}`}
        className="w-full block"
      />

      {myAnnotations.map((ann, i) => (
        <Pin
          key={ann.id}
          annotation={ann}
          index={i}
          active={activePin === ann.id}
          onClick={e => {
            (e as any).stopPropagation?.();
            setActivePin(prev => prev === ann.id ? null : ann.id);
          }}
        />
      ))}

      {/* Tooltip */}
      {activePin && (() => {
        const ann = myAnnotations.find(a => a.id === activePin);
        return ann ? (
          <PinTooltip annotation={ann} onClose={() => setActivePin(null)} />
        ) : null;
      })()}

      {/* Pin count badge */}
      {myAnnotations.length > 0 && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Settings2 className="w-2.5 h-2.5" />
          {myAnnotations.length} annotation{myAnnotations.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TORQUE SPECS TABLE  (used at bottom of GuideDetailPage)
// ═══════════════════════════════════════════════════════════════
export function TorqueSpecsTable({ steps }: { steps: Array<{ title: string; annotations?: Annotation[] }> }) {
  const specs: Array<{ step: string; label: string; torque: string; socket?: string; size?: string; qty?: number }> = [];

  steps.forEach(step => {
    (step.annotations || []).forEach(ann => {
      if ((ann.type === "fastener" || ann.type === "torque") && ann.torqueSpec) {
        specs.push({
          step: step.title,
          label: ann.label,
          torque: ann.torqueSpec,
          socket: ann.socketSize,
          size: ann.size,
          qty: ann.qty,
        });
      }
    });
  });

  if (!specs.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-amber-500/10">
        <Wrench className="w-4 h-4 text-amber-400" />
        <h3 className="font-bold text-sm text-amber-400">Torque Specifications</h3>
        <Badge className="ml-auto bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">{specs.length} spec{specs.length !== 1 ? "s" : ""}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-semibold">Fastener / Location</th>
              <th className="text-left px-4 py-2.5 font-semibold">Size</th>
              <th className="text-left px-4 py-2.5 font-semibold">Socket</th>
              <th className="text-right px-4 py-2.5 font-semibold">Torque</th>
              <th className="text-right px-4 py-2.5 font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {specs.map((s, i) => (
              <tr key={i} className="hover:bg-secondary/40 transition-colors">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.step}</p>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.size || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.socket || "—"}</td>
                <td className="px-4 py-2.5 text-right font-bold text-amber-400">{s.torque}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{s.qty ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HARDWARE LIST  (fasteners grouped by size)
// ═══════════════════════════════════════════════════════════════
export function HardwareList({ steps }: { steps: Array<{ annotations?: Annotation[] }> }) {
  const map = new Map<string, { label: string; size: string; qty: number; torque?: string; socket?: string }>();

  steps.forEach(step => {
    (step.annotations || []).forEach(ann => {
      if (ann.type !== "fastener") return;
      const key = `${ann.size || ann.label}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty += ann.qty || 1;
      } else {
        map.set(key, {
          label: ann.label,
          size: ann.size || "—",
          qty: ann.qty || 1,
          torque: ann.torqueSpec,
          socket: ann.socketSize,
        });
      }
    });
  });

  const items = Array.from(map.values());
  if (!items.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-orange-500/10">
        <Settings2 className="w-4 h-4 text-orange-400" />
        <h3 className="font-bold text-sm text-orange-400">Hardware Needed</h3>
        <Badge className="ml-auto bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">{items.length} type{items.length !== 1 ? "s" : ""}</Badge>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
              <Settings2 className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.size}{item.socket ? ` · ${item.socket}` : ""}{item.torque ? ` · ${item.torque}` : ""}</p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">×{item.qty}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ANNOTATION EDITOR DIALOG  (wraps AnnotationEditor in a modal)
// ═══════════════════════════════════════════════════════════════
export function AnnotationEditorDialog({
  open, onClose,
  imageUrl, annotations, onChange,
}: {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  annotations: Annotation[];
  onChange: (a: Annotation[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Annotate Image
          </DialogTitle>
        </DialogHeader>
        <AnnotationEditor imageUrl={imageUrl} annotations={annotations} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
}
