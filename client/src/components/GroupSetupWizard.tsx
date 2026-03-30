/**
 * GroupSetupWizard — first-time setup wizard for new group owners.
 * 4 steps: Cover & Avatar → Rules → Invite Members → Go Live
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AvatarUploader } from "@/components/ImageUploader";
import ImageUploader from "@/components/ImageUploader";
import { useCfUrl, resolveImageUrl } from "@/hooks/use-cf-url";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight, ChevronLeft, CheckCircle2, Image, Shield,
  UserPlus, Rocket, Trash2, Plus, Users, Copy, X, Search,
  HelpCircle } from "lucide-react";

// ── Step config ───────────────────────────────────────────
const STEPS = [
  { id: "visuals",   label: "Visuals",   icon: Image },
  { id: "rules",     label: "Rules",     icon: Shield },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "invite",    label: "Invite",    icon: UserPlus },
  { id: "launch",    label: "Launch",    icon: Rocket },
];

const DEFAULT_RULES = [
  { title: "Be respectful", body: "Treat everyone with respect. No harassment, hate speech, or personal attacks." },
  { title: "Stay on topic", body: "Keep posts relevant to the group's focus. Off-topic posts may be removed." },
  { title: "No spam or self-promotion", body: "Don't flood the group with ads, referral links, or repeated posts." },
  { title: "Verify before you post", body: "Share accurate information. If you're not sure, say so." },
];

interface GroupSetupWizardProps {
  group: { id: number; name: string; category: string; description: string };
  open: boolean;
  onClose: () => void;
}

// ── Step 1: Visuals ──────────────────────────────────────
function VisualsStep({
  groupName, coverImageId, avatarId, avatarPreviewUrl,
  onCoverChange, onAvatarChange,
}: {
  groupName: string;
  coverImageId: string;
  avatarId: string;
  // Blob / CDN URL for instant preview — separate from the imageId saved to DB
  avatarPreviewUrl: string | null;
  onCoverChange: (id: string) => void;
  // Receives both the DB imageId AND the displayable preview URL
  onAvatarChange: (id: string, previewUrl: string) => void;
}) {
  const cfBase = useCfUrl();
  const coverSrc = resolveImageUrl(cfBase, coverImageId);
  // Prefer the local blob/CDN preview URL (set immediately on upload),
  // fall back to resolving the imageId through CF base (handles existing groups)
  const avatarSrc = avatarPreviewUrl || resolveImageUrl(cfBase, avatarId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-sm mb-1">Cover Photo</h3>
        <p className="text-xs text-muted-foreground mb-3">
          The banner image shown at the top of your group page. Best size: 1200×400px.
        </p>
        {/* Cover image preview */}
        <div className="relative h-32 bg-secondary rounded-xl overflow-hidden border border-border mb-3">
          {coverSrc ? (
            <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <Image className="w-10 h-10" />
            </div>
          )}
          {/* Avatar overlay preview */}
          <div className="absolute bottom-3 left-4 w-14 h-14 rounded-xl border-2 border-card overflow-hidden bg-secondary">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg opacity-30">🏁</div>
            )}
          </div>
          <div className="absolute bottom-3 left-20 text-sm font-bold text-white drop-shadow">
            {groupName}
          </div>
        </div>
        <ImageUploader
          value={coverImageId ? [coverImageId] : []}
          onChange={ids => onCoverChange(ids[0] || "")}
          maxImages={1}
          label="Upload Cover Photo"
        />
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-1">Group Avatar</h3>
        <p className="text-xs text-muted-foreground mb-3">
          A square icon for your group. Shows in search results and member lists.
        </p>
        <div className="flex items-center gap-4">
          {/* Static square preview — mirrors what shows in the cover overlay */}
          <div className="w-16 h-16 rounded-xl border border-border overflow-hidden bg-secondary shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🏁</div>
            )}
          </div>
          {/* AvatarUploader: pass currentUrl (displayable URL), and capture previewUrl from callback */}
          <AvatarUploader
            currentUrl={avatarSrc || null}
            onUpload={(imageId, previewUrl) => onAvatarChange(imageId, previewUrl)}
            size={64}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Rules ────────────────────────────────────────
function RulesStep({
  rules,
  onChange,
}: {
  rules: { title: string; body: string }[];
  onChange: (rules: { title: string; body: string }[]) => void;
}) {
  const updateRule = (i: number, field: "title" | "body", val: string) => {
    const next = [...rules];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  const removeRule = (i: number) => onChange(rules.filter((_, idx) => idx !== i));

  const addRule = () => onChange([...rules, { title: "", body: "" }]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-1">
        Rules help set expectations for your community. We've suggested some defaults — edit them to fit your group.
      </p>

      {rules.map((rule, i) => (
        <div key={i} className="bg-secondary rounded-xl p-3 space-y-2 group" data-testid={`rule-editor-${i}`}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </div>
            <Input
              value={rule.title}
              onChange={e => updateRule(i, "title", e.target.value)}
              placeholder="Rule title"
              className="flex-1 h-8 text-sm bg-card border-border"
              data-testid={`input-rule-title-${i}`}
            />
            <button
              onClick={() => removeRule(i)}
              className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              data-testid={`button-remove-rule-${i}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Textarea
            value={rule.body}
            onChange={e => updateRule(i, "body", e.target.value)}
            placeholder="Explanation (optional)"
            className="text-xs bg-card border-border resize-none min-h-[50px]"
            rows={2}
            data-testid={`textarea-rule-body-${i}`}
          />
        </div>
      ))}

      {rules.length < 10 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRule}
          className="w-full gap-2"
          data-testid="button-add-rule"
        >
          <Plus className="w-3.5 h-3.5" /> Add a Rule
        </Button>
      )}
    </div>
  );
}

// ── Step 3: Invite ───────────────────────────────────────
function InviteStep({
  groupId, groupName,
  invited, onInvite, onRemove,
}: {
  groupId: number;
  groupName: string;
  invited: any[];
  onInvite: (user: any) => void;
  onRemove: (userId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/search/users", query],
    queryFn: () =>
      apiRequest("GET", `/api/search?q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => d.users || []),
    enabled: query.trim().length >= 2,
  });

  const inviteMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("POST", `/api/groups/${groupId}/join`, { message: `You've been invited to join ${groupName}!` }).then(r => r.json()),
  });

  const shareLink = `${window.location.origin}/#/groups/${groupId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() =>
      toast({ title: "Link copied!", description: "Share it anywhere to invite members." })
    );
  };

  const filteredResults = searchResults.filter(
    (u: any) => !invited.find((inv: any) => inv.id === u.id)
  );

  return (
    <div className="space-y-4">
      {/* Share link */}
      <div className="bg-secondary rounded-xl p-4">
        <p className="text-sm font-semibold mb-1">Share your group link</p>
        <p className="text-xs text-muted-foreground mb-3">Anyone with this link can find and join your group.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground truncate font-mono">
            {shareLink}
          </div>
          <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 shrink-0">
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
      </div>

      {/* Search + invite users */}
      <div>
        <p className="text-sm font-semibold mb-2">Invite specific people</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name or username..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-8 bg-secondary"
            data-testid="input-invite-search"
          />
        </div>

        {/* Search results */}
        {filteredResults.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden mb-3">
            {filteredResults.slice(0, 5).map((u: any) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {(u.display_name || u.username)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => onInvite(u)}
                  data-testid={`button-invite-${u.id}`}
                >
                  <UserPlus className="w-3 h-3 mr-1" /> Invite
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Invited list */}
        {invited.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Invited ({invited.length})</p>
            <div className="flex flex-wrap gap-2">
              {invited.map((u: any) => (
                <div key={u.id} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-xs font-medium">
                  {u.display_name || u.username}
                  <button onClick={() => onRemove(u.id)} className="hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {query.length >= 2 && filteredResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">No users found for "{query}"</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can always invite more people later from your group page.
      </p>
    </div>
  );
}

// ── Step 3: Questions ────────────────────────────────────
function QuestionsStep({
  groupId, isPrivate,
  questions,
  onChange,
}: {
  groupId: number;
  isPrivate: boolean;
  questions: { question: string; required: boolean }[];
  onChange: (q: { question: string; required: boolean }[]) => void;
}) {
  const add = () => onChange([...questions, { question: "", required: true }]);
  const remove = (i: number) => onChange(questions.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, value: any) => {
    const next = [...questions];
    (next[i] as any)[field] = value;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold text-sm">Membership Questions</h3>
        <p className="text-xs text-muted-foreground">
          {isPrivate
            ? "Ask up to 5 questions that applicants must answer when requesting to join. Great for filtering bots and keeping your community quality high."
            : "Add optional questions for people joining your group. These help you understand your members better."}
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-6 text-center space-y-2">
          <HelpCircle className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No questions yet. Add one to screen applicants.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="bg-secondary rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Question {i + 1}</span>
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                placeholder="e.g. What's your main vehicle? How long have you been into 3D printing?"
                value={q.question}
                onChange={e => update(i, "question", e.target.value)}
                maxLength={200}
              />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={e => update(i, "required", e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground">Required</span>
              </label>
            </div>
          ))}
        </div>
      )}

      {questions.length < 5 && (
        <button
          onClick={add}
          className="w-full border border-dashed border-primary/40 hover:border-primary rounded-xl py-2.5 text-sm text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add question
        </button>
      )}

      <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Tips for good screening questions:</p>
        <ul className="list-disc list-inside space-y-0.5 ml-1">
          <li>Ask about their experience or interest level</li>
          <li>Ask what they hope to contribute to the group</li>
          <li>Ask them to agree to a specific rule ("Do you agree to...")</li>
        </ul>
      </div>
    </div>
  );
}

// ── Step 4: Launch ───────────────────────────────────────
function LaunchStep({ group, coverImageId, avatarId, avatarPreviewUrl, rulesCount, invitedCount }: {
  group: any; coverImageId: string; avatarId: string;
  avatarPreviewUrl: string | null;
  rulesCount: number; invitedCount: number;
}) {
  const cfBase = useCfUrl();
  const coverSrc = resolveImageUrl(cfBase, coverImageId);
  const avatarSrc = avatarPreviewUrl || resolveImageUrl(cfBase, avatarId);

  const checklist = [
    { label: "Group created", done: true },
    { label: "Cover photo added", done: !!coverImageId },
    { label: "Avatar uploaded", done: !!avatarId },
    { label: "Rules set", done: rulesCount > 0 },
    { label: "Members invited", done: invitedCount > 0 },
  ];

  const completedCount = checklist.filter(c => c.done).length;

  return (
    <div className="space-y-5">
      {/* Group preview card */}
      <div className="bg-secondary rounded-xl overflow-hidden">
        <div className="h-24 bg-card relative">
          {coverSrc ? (
            <img src={coverSrc} alt="Cover" className="w-full h-full object-cover opacity-70" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">🏁</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-secondary to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <div className="w-12 h-12 rounded-xl border-2 border-secondary overflow-hidden bg-card">
              {avatarSrc
                ? <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl opacity-30">🏁</div>
              }
            </div>
            <div>
              <p className="font-bold text-sm">{group.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> 0 members · {group.category}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup checklist */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Setup complete</p>
          <span className="text-xs text-muted-foreground">{completedCount}/{checklist.length}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 mb-3">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / checklist.length) * 100}%` }}
          />
        </div>
        <div className="space-y-1.5">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {item.done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
              }
              <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 text-center">
        <Rocket className="w-6 h-6 text-primary mx-auto mb-2" />
        <p className="text-sm font-semibold mb-1">You're ready to launch!</p>
        <p className="text-xs text-muted-foreground">
          Your group is live. You can update photos, rules, and settings anytime from your group page.
        </p>
      </div>
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────
export function GroupSetupWizard({ group, open, onClose }: GroupSetupWizardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  // Wizard state
  const [coverImageId, setCoverImageId] = useState("");
  const [avatarId, setAvatarId] = useState("");
  // Separate preview URL (blob / CDN URL) for instant display — imageId alone can't render
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [rules, setRules] = useState(DEFAULT_RULES.map(r => ({ ...r })));
  const [questions, setQuestions] = useState<{ question: string; required: boolean }[]>([]);
  const [invited, setInvited] = useState<any[]>([]);

  const setupMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/groups/${group.id}/setup`, {
        avatar: avatarId || undefined,
        coverImage: coverImageId || undefined,
        rules: rules.filter(r => r.title.trim()),
      }).then(async r => {
        const data = await r.json();
        // Save questions separately
        const validQuestions = questions.filter(q => q.question.trim());
        if (validQuestions.length > 0) {
          await apiRequest("PUT", `/api/groups/${group.id}/questions`, { questions: validQuestions });
        }
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: `${group.name} is live!`, description: "Your group is ready for members." });
      onClose();
      navigate(`/groups/${group.id}`);
    },
    onError: () => toast({ title: "Couldn't save setup", variant: "destructive" }),
  });

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else setupMutation.mutate();
  };

  const handleInvite = (user: any) => {
    if (!invited.find(u => u.id === user.id)) setInvited(prev => [...prev, user]);
  };

  const isLastStep = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={val => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <DialogTitle className="sr-only">Set up {group.name}</DialogTitle>
        <DialogDescription className="sr-only">A wizard to configure your group's visuals, rules, and settings.</DialogDescription>
        <div className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-display font-extrabold text-lg">Set up {group.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Just a few steps to make your group shine
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-0">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isDone = i < step;
                const isActive = i === step;
                return (
                  <div key={s.id} className="flex items-center flex-1">
                    <button
                      onClick={() => i < step && setStep(i)}
                      className={`flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${
                        isActive ? "text-primary" : isDone ? "text-primary/60 cursor-pointer" : "text-muted-foreground/40"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        isActive ? "bg-primary text-primary-foreground" :
                        isDone ? "bg-primary/20 text-primary" : "bg-secondary"
                      }`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-[10px] font-medium hidden sm:block">{s.label}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${i < step ? "bg-primary/40" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 0 && (
              <VisualsStep
                groupName={group.name}
                coverImageId={coverImageId}
                avatarId={avatarId}
                avatarPreviewUrl={avatarPreviewUrl}
                onCoverChange={setCoverImageId}
                onAvatarChange={(id, previewUrl) => {
                  setAvatarId(id);
                  setAvatarPreviewUrl(previewUrl);
                }}
              />
            )}
            {step === 1 && (
              <RulesStep rules={rules} onChange={setRules} />
            )}
            {step === 2 && (
              <QuestionsStep
                groupId={group.id}
                isPrivate={!!(group as any).private}
                questions={questions}
                onChange={setQuestions}
              />
            )}
            {step === 3 && (
              <InviteStep
                groupId={group.id}
                groupName={group.name}
                invited={invited}
                onInvite={handleInvite}
                onRemove={id => setInvited(prev => prev.filter(u => u.id !== id))}
              />
            )}
            {step === 4 && (
              <LaunchStep
                group={group}
                coverImageId={coverImageId}
                avatarId={avatarId}
                avatarPreviewUrl={avatarPreviewUrl}
                rulesCount={rules.filter(r => r.title.trim()).length}
                invitedCount={invited.length}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
              className="gap-1.5"
              data-testid="button-wizard-back"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? "Skip for now" : "Back"}
            </Button>

            <div className="flex items-center gap-3">
              {!isLastStep && (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip this step
                </button>
              )}
              <Button
                onClick={handleNext}
                disabled={setupMutation.isPending}
                className="gap-1.5 font-semibold"
                data-testid="button-wizard-next"
              >
                {setupMutation.isPending ? "Saving..." :
                  isLastStep ? <><Rocket className="w-4 h-4" /> Launch Group</> :
                  <>Next <ChevronRight className="w-4 h-4" /></>
                }
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
