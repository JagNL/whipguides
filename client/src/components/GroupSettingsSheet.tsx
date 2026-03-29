/**
 * GroupSettingsSheet — slides in from right when owner/admin clicks ⚙
 * Tabs: General | Appearance | Rules | Questions | Members | Danger
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ImageUploader, { AvatarUploader } from "@/components/ImageUploader";
import { useCfUrl, resolveImageUrl } from "@/hooks/use-cf-url";
import {
  X, Settings, Image as ImageIcon, Shield, HelpCircle,
  Users, Trash2, UserPlus, Crown, ShieldCheck, UserMinus,
  Loader2, AlertTriangle, Check, Lock, Globe, Plus,
} from "lucide-react";
import { Link } from "wouter";

const TABS = [
  { id: "general",    label: "General",    icon: Settings },
  { id: "appearance", label: "Appearance", icon: ImageIcon },
  { id: "rules",      label: "Rules",      icon: Shield },
  { id: "questions",  label: "Questions",  icon: HelpCircle },
  { id: "members",    label: "Members",    icon: Users },
  { id: "invite",     label: "Invite",     icon: UserPlus },
  { id: "moderation", label: "Moderation", icon: ShieldCheck },
  { id: "advanced",   label: "Advanced",   icon: AlertTriangle },
] as const;

type Tab = typeof TABS[number]["id"];

const ROLE_COLORS: Record<string, string> = {
  owner: "text-orange-400 bg-orange-500/10",
  admin: "text-blue-400 bg-blue-500/10",
  moderator: "text-purple-400 bg-purple-500/10",
  member: "text-muted-foreground bg-secondary",
};

interface Props {
  group: any;
  isOwner: boolean;
  isSiteAdmin: boolean;
  onClose: () => void;
  onDeleteRequest: () => void;
}

export function GroupSettingsSheet({ group, isOwner, isSiteAdmin, onClose, onDeleteRequest }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const cfBase = useCfUrl();
  const [tab, setTab] = useState<Tab>("general");

  // ── General settings state ────────────────────────────────
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [isPrivate, setIsPrivate] = useState(group.private || false);

  // ── Appearance state ──────────────────────────────────────
  const [coverImageId, setCoverImageId] = useState(group.coverImage || "");
  const [avatarId, setAvatarId] = useState(group.avatar || "");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    group.avatar ? (group.avatar.startsWith("http") || group.avatar.startsWith("data:") ? group.avatar : null) : null
  );

  // ── Rules ─────────────────────────────────────────────────
  const { data: rules = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", group.id, "rules"],
    queryFn: () => apiRequest("GET", `/api/groups/${group.id}/rules`).then(r => r.json()),
  });
  const [editRules, setEditRules] = useState<any[] | null>(null);
  const activeRules = editRules ?? rules;

  // ── Questions ─────────────────────────────────────────────
  const { data: questions = [] } = useQuery<any[]>({
    queryKey: ["/api/groups", group.id, "questions"],
    queryFn: () => apiRequest("GET", `/api/groups/${group.id}/questions`).then(r => r.json()),
  });
  const [editQuestions, setEditQuestions] = useState<any[] | null>(null);
  const activeQuestions = editQuestions ?? questions;

  // ── Members ───────────────────────────────────────────────
  const { data: members = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", group.id, "members"],
    queryFn: () => apiRequest("GET", `/api/groups/${group.id}/members`).then(r => r.json()),
    enabled: tab === "members",
  });

  // ── Invite ────────────────────────────────────────────────
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviting, setInviting] = useState<number | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<number>>(new Set());

  const searchUsers = async (q: string) => {
    if (q.length < 2) { setInviteResults([]); return; }
    const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setInviteResults(data.users || []);
  };

  const inviteUser = async (userId: number) => {
    setInviting(userId);
    try {
      await apiRequest("POST", `/api/groups/${group.id}/invite`, { userId });
      setInvitedIds(prev => new Set([...prev, userId]));
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id, "members"] });
      toast({ title: "Added to group", description: "They are now a member." });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("already a member")) {
        // Treat as success — they are in the group, just not showing in the list yet
        setInvitedIds(prev => new Set([...prev, userId]));
        queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id, "members"] });
        toast({ title: "Already a member", description: "They are in this group. Switch to the Members tab to see them." });
      } else {
        toast({ title: "Could not invite", description: msg || "Try again", variant: "destructive" });
      }
    } finally {
      setInviting(null);
    }
  };

  // ── Save mutations ────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("PATCH", `/api/groups/${group.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id] });
      toast({ title: "Saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveRulesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/groups/${group.id}/rules`, { rules: activeRules });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id, "rules"] });
      setEditRules(null);
      toast({ title: "Rules saved" });
    },
  });

  const saveQuestionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/groups/${group.id}/questions`, { questions: activeQuestions });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id, "questions"] });
      setEditQuestions(null);
      toast({ title: "Questions saved" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/groups/${group.id}/members/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id, "members"] });
      toast({ title: "Role updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/groups/${group.id}/members/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id] });
      toast({ title: "Member removed" });
    },
  });

  const coverSrc = resolveImageUrl(cfBase, coverImageId);
  // Avatar: prefer the live cdnUrl from upload, fall back to resolving stored key
  const avatarSrc = avatarPreviewUrl || resolveImageUrl(cfBase, avatarId);

  // Split members into followed vs others
  const followedMembers = members.filter(m => m.isFollowed || m.id === user?.id || m.role === "owner");
  const otherMembers = members.filter(m => !m.isFollowed && m.id !== user?.id && m.role !== "owner");

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-background border-l border-border flex flex-col h-full shadow-2xl"
        style={{ animation: "slide-in-right 0.25s cubic-bezier(0.34,1.2,0.64,1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-base">Group Settings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{group.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                  tab === t.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── GENERAL ── */}
          {tab === "general" && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Group Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-border" maxLength={60} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary border-border resize-none min-h-[90px]" maxLength={500} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-green-400" />}
                    {isPrivate ? "Private Group" : "Public Group"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isPrivate ? "Only approved members can see posts" : "Anyone can join and see posts"}
                  </p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => saveMutation.mutate({ name: name.trim(), description: description.trim(), private: isPrivate })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {tab === "appearance" && (
            <div className="space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Cover Photo</Label>
                <div className="relative h-28 bg-secondary rounded-xl overflow-hidden border border-border mb-3">
                  {coverSrc ? (
                    <img src={coverSrc} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                </div>
                <ImageUploader
                  value={coverImageId ? [coverImageId] : []}
                  onChange={ids => setCoverImageId(ids[0] || "")}
                  maxImages={1}
                  label="Upload Cover Photo"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Group Avatar</Label>
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-16 h-16 rounded-xl border border-border overflow-hidden bg-secondary shrink-0">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🏁</div>
                    )}
                  </div>
                  <AvatarUploader
                    currentUrl={avatarSrc || undefined}
                    onUpload={(imageId, cdnUrl) => {
                      setAvatarId(cdnUrl || imageId); // store the full URL so Save sends the correct value
                      setAvatarPreviewUrl(cdnUrl || imageId);
                    }}
                  />
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => saveMutation.mutate({ coverImage: coverImageId || null, avatar: avatarId || null })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Appearance"}
              </Button>
            </div>
          )}

          {/* ── RULES ── */}
          {tab === "rules" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Set community standards. Members see these before posting.</p>
              {activeRules.map((rule: any, i: number) => (
                <div key={i} className="bg-secondary rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                    <Input
                      value={rule.title}
                      onChange={e => {
                        const next = [...activeRules];
                        next[i] = { ...next[i], title: e.target.value };
                        setEditRules(next);
                      }}
                      placeholder="Rule title"
                      className="flex-1 bg-background border-border text-sm h-8"
                    />
                    <button onClick={() => setEditRules(activeRules.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <Textarea
                    value={rule.body || ""}
                    onChange={e => {
                      const next = [...activeRules];
                      next[i] = { ...next[i], body: e.target.value };
                      setEditRules(next);
                    }}
                    placeholder="Optional description..."
                    className="bg-background border-border text-xs resize-none min-h-[52px]"
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setEditRules([...activeRules, { title: "", body: "" }])}>
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </Button>
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => saveRulesMutation.mutate()} disabled={saveRulesMutation.isPending}>
                {saveRulesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Rules"}
              </Button>
            </div>
          )}

          {/* ── QUESTIONS ── */}
          {tab === "questions" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Ask up to 5 questions when someone requests to join.</p>
              {activeQuestions.slice(0, 5).map((q: any, i: number) => (
                <div key={i} className="bg-secondary rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={q.question}
                      onChange={e => {
                        const next = [...activeQuestions];
                        next[i] = { ...next[i], question: e.target.value };
                        setEditQuestions(next);
                      }}
                      placeholder={`Question ${i + 1}`}
                      className="flex-1 bg-background border-border text-sm h-8"
                    />
                    <button onClick={() => setEditQuestions(activeQuestions.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                      checked={q.required || false}
                      onCheckedChange={v => {
                        const next = [...activeQuestions];
                        next[i] = { ...next[i], required: v };
                        setEditQuestions(next);
                      }}
                    />
                    Required to answer
                  </label>
                </div>
              ))}
              {activeQuestions.length < 5 && (
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setEditQuestions([...activeQuestions, { question: "", required: false }])}>
                  <Plus className="w-3.5 h-3.5" /> Add Question
                </Button>
              )}
              <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => saveQuestionsMutation.mutate()} disabled={saveQuestionsMutation.isPending}>
                {saveQuestionsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Questions"}
              </Button>
            </div>
          )}

          {/* ── MEMBERS ── */}
          {tab === "members" && (
            <div className="space-y-4">
              {membersLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
              ) : (
                <>
                  {followedMembers.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">People You Know</p>
                      <div className="space-y-1">
                        {followedMembers.map(m => <MemberRow key={m.id} member={m} groupId={group.id} isOwner={isOwner} isSiteAdmin={isSiteAdmin} userId={user?.id} onRole={roleMutation.mutate} onRemove={removeMutation.mutate} />)}
                      </div>
                    </div>
                  )}
                  {otherMembers.length > 0 && (
                    <div>
                      {followedMembers.length > 0 && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">All Members</p>
                      )}
                      <div className="space-y-1">
                        {otherMembers.map(m => <MemberRow key={m.id} member={m} groupId={group.id} isOwner={isOwner} isSiteAdmin={isSiteAdmin} userId={user?.id} onRole={roleMutation.mutate} onRemove={removeMutation.mutate} />)}
                      </div>
                    </div>
                  )}
                  {members.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No members yet.</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── INVITE ── */}
          {tab === "invite" && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Search users to invite</Label>
                <Input
                  value={inviteSearch}
                  onChange={e => { setInviteSearch(e.target.value); searchUsers(e.target.value); }}
                  placeholder="Search by name or username..."
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-1.5">
                {inviteResults.map((u: any) => {
                  const alreadyInvited = invitedIds.has(u.id);
                  const isMemberAlready = members.some((m: any) => m.id === u.id);
                  return (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">{(u.display_name || u.displayName || u.username)?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.display_name || u.displayName || u.username}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                      {isMemberAlready ? (
                        <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-background">Member</span>
                      ) : alreadyInvited ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 font-medium px-2 py-1 rounded-lg bg-green-400/10">
                          <Check className="w-3 h-3" /> Added
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1 h-7 text-xs"
                          onClick={() => inviteUser(u.id)}
                          disabled={inviting === u.id}
                        >
                          {inviting === u.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <UserPlus className="w-3 h-3" />}
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
                {inviteSearch.length >= 2 && inviteResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                )}
              </div>
              {/* Invite link */}
              <div className="rounded-xl bg-secondary p-4 space-y-2">
                <p className="text-xs font-semibold">Share invite link</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/#/groups/${group.id}`}
                    className="bg-background border-border text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/#/groups/${group.id}`);
                      toast({ title: "Link copied!" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── MODERATION ── */}
          {tab === "moderation" && (
            <ModerationTab group={group} isGroupMod={isOwner || isSiteAdmin} />
          )}

          {/* ── ADVANCED ── */}
          {tab === "advanced" && isOwner && (
            <AdvancedTab group={group} onSave={async (settings) => {
              await apiRequest("PATCH", `/api/groups/${group.id}/settings`, settings);
              queryClient.invalidateQueries({ queryKey: ["/api/groups", group.id] });
            }} />
          )}
        </div>

        {/* Footer — danger zone */}
        {(isOwner || isSiteAdmin) && (
          <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:bg-destructive/10 gap-2 justify-start"
              onClick={() => { onClose(); onDeleteRequest(); }}
            >
              <Trash2 className="w-4 h-4" /> Delete Group
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Member row sub-component ──────────────────────────────────

// ── Moderation Tab ────────────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  ban: "Banned member", delete_post: "Removed post", remove_member: "Removed member",
  promote: "Changed role", approve_join: "Approved join", deny_join: "Denied join",
};
function ModerationTab({ group, isGroupMod }: { group: any; isGroupMod: boolean }) {
  const { toast } = useToast();
  const [modTab, setModTab] = useState<"log" | "bans">("log");
  const { data: logs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/groups", group.id, "mod-log"],
    queryFn: () => apiRequest("GET", `/api/groups/${group.id}/mod-log`).then(r => r.json()),
    enabled: modTab === "log" && isGroupMod,
  });
  const { data: bans = [], isLoading: bansLoading, refetch: refetchBans } = useQuery<any[]>({
    queryKey: ["/api/groups", group.id, "bans"],
    queryFn: () => apiRequest("GET", `/api/groups/${group.id}/bans`).then(r => r.json()),
    enabled: modTab === "bans" && isGroupMod,
  });
  const unban = async (userId: number) => {
    await apiRequest("DELETE", `/api/groups/${group.id}/members/${userId}/ban`);
    refetchBans();
    toast({ title: "Member unbanned" });
  };
  if (!isGroupMod) return <p className="text-sm text-muted-foreground text-center py-8">Moderators only.</p>;
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-secondary rounded-xl">
        {(["log", "bans"] as const).map(t => (
          <button key={t} onClick={() => setModTab(t)}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${modTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
            {t === "log" ? "Mod Log" : "Banned Members"}</button>
        ))}
      </div>
      {modTab === "log" && (logsLoading ? <Skeleton className="h-20 rounded-xl" /> :
        logs.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No moderation actions yet.</p> :
        <div className="space-y-1.5">{logs.map((log: any, i: number) => (
          <div key={i} className="bg-secondary rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{ACTION_LABELS[log.action] || log.action}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
            </div>
            {log.note && <p className="text-xs text-muted-foreground">{log.note}</p>}
          </div>
        ))}</div>
      )}
      {modTab === "bans" && (bansLoading ? <Skeleton className="h-20 rounded-xl" /> :
        bans.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No banned members.</p> :
        <div className="space-y-1.5">{bans.map((ban: any) => (
          <div key={ban.user_id} className="bg-secondary rounded-xl p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">User #{ban.user_id}</p>
              {ban.reason && <p className="text-xs text-muted-foreground">{ban.reason}</p>}
              {!ban.expires_at && <p className="text-[10px] text-destructive">Permanent ban</p>}
            </div>
            <Button size="sm" variant="outline" className="shrink-0 text-xs h-7" onClick={() => unban(ban.user_id)}>Unban</Button>
          </div>
        ))}</div>
      )}
    </div>
  );
}

// ── Advanced Tab ──────────────────────────────────────────────
function AdvancedTab({ group, onSave }: { group: any; onSave: (s: any) => Promise<void> }) {
  const { toast } = useToast();
  const [slowMode, setSlowMode] = useState(group.slow_mode_seconds || 0);
  const [autoApprove, setAutoApprove] = useState(group.auto_approve_members || false);
  const [welcomeMsg, setWelcomeMsg] = useState(group.welcome_message || "");
  const [saving, setSaving] = useState(false);
  const SLOW_OPTIONS = [
    { label: "Off", value: 0 }, { label: "30s", value: 30 }, { label: "1 min", value: 60 },
    { label: "5 min", value: 300 }, { label: "15 min", value: 900 }, { label: "1 hr", value: 3600 },
  ];
  const save = async () => {
    setSaving(true);
    try { await onSave({ slow_mode_seconds: slowMode, auto_approve_members: autoApprove, welcome_message: welcomeMsg }); toast({ title: "Saved" }); }
    catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-secondary p-4">
        <Label className="text-xs font-semibold mb-1.5 block">Slow Mode</Label>
        <p className="text-xs text-muted-foreground mb-2">Limit how often members can post. Reduces spam.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SLOW_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setSlowMode(opt.value)}
              className={`text-xs py-1.5 px-2 rounded-lg border transition-colors ${slowMode === opt.value ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40 text-muted-foreground"}`}>
              {opt.label}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
        <div>
          <p className="text-sm font-medium">Auto-approve Members</p>
          <p className="text-xs text-muted-foreground">Skip manual review of join requests</p>
        </div>
        <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
      </div>
      <div>
        <Label className="text-xs font-semibold mb-1.5 block">Welcome Message</Label>
        <Textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)}
          placeholder="Sent to new members when they join..." maxLength={500}
          className="bg-secondary border-border resize-none min-h-[80px] text-sm" />
      </div>
      <Button className="w-full bg-primary hover:bg-primary/90" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Advanced Settings"}
      </Button>
    </div>
  );
}

function MemberRow({ member, groupId, isOwner, isSiteAdmin, userId, onRole, onRemove }: any) {
  const [showActions, setShowActions] = useState(false);
  const isMe = member.id === userId;
  const isOwnerRow = member.role === "owner";
  const canManage = (isOwner || isSiteAdmin) && !isOwnerRow && !isMe;

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-secondary transition-colors group">
      <Link href={`/profile/${member.id}`}>
        <Avatar className="w-8 h-8 shrink-0 cursor-pointer">
          <AvatarImage src={member.avatar} />
          <AvatarFallback className="text-xs bg-primary/20 text-primary">
            {(member.display_name || member.username)?.[0]}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{member.display_name || member.username}</p>
          {member.isFollowed && !isMe && (
            <span className="text-[10px] text-blue-400">Following</span>
          )}
          {isMe && <span className="text-[10px] text-muted-foreground">You</span>}
        </div>
        <p className="text-xs text-muted-foreground">@{member.username}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${ROLE_COLORS[member.role] || ROLE_COLORS.member}`}>
          {member.role}
        </span>
        {canManage && (
          <div className="relative">
            <button
              onClick={() => setShowActions(s => !s)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-background transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-6 z-50 bg-popover border border-border rounded-xl shadow-xl py-1 w-36 text-sm">
                {member.role !== "admin" && (
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2 text-xs"
                    onClick={() => { onRole({ userId: member.id, role: "admin" }); setShowActions(false); }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Make Admin
                  </button>
                )}
                {member.role !== "moderator" && (
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2 text-xs"
                    onClick={() => { onRole({ userId: member.id, role: "moderator" }); setShowActions(false); }}
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-400" /> Make Moderator
                  </button>
                )}
                {member.role !== "member" && (
                  <button
                    className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2 text-xs"
                    onClick={() => { onRole({ userId: member.id, role: "member" }); setShowActions(false); }}
                  >
                    <Users className="w-3.5 h-3.5" /> Set as Member
                  </button>
                )}
                <div className="h-px bg-border mx-2 my-1" />
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2 text-xs text-destructive"
                  onClick={() => { onRemove(member.id); setShowActions(false); }}
                >
                  <UserMinus className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
