/**
 * NotificationBell — real-time bell icon + dropdown notification center.
 * Shows unread count badge, lists recent notifications with type icons,
 * mark-all-read, individual dismiss, and navigation on click.
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bell, MessageSquare, Heart, BookOpen, Users, Star,
  Bookmark, CheckCheck, Trash2, Wrench, X,
} from "lucide-react";

// ── Notification type → icon + color ────────────────────────
function notifMeta(type: string): { icon: React.ElementType; color: string; bg: string } {
  switch (type) {
    case "message":         return { icon: MessageSquare, color: "text-blue-400",   bg: "bg-blue-500/15" };
    case "guide_like":      return { icon: Heart,          color: "text-red-400",    bg: "bg-red-500/15" };
    case "guide_comment":   return { icon: BookOpen,        color: "text-primary",    bg: "bg-primary/15" };
    case "post_like":       return { icon: Heart,           color: "text-red-400",    bg: "bg-red-500/15" };
    case "post_reply":      return { icon: MessageSquare,   color: "text-blue-400",   bg: "bg-blue-500/15" };
    case "group_join":      return { icon: Users,           color: "text-emerald-400",bg: "bg-emerald-500/15" };
    case "listing_save":    return { icon: Bookmark,        color: "text-amber-400",  bg: "bg-amber-500/15" };
    case "listing_inquiry": return { icon: MessageSquare,   color: "text-blue-400",   bg: "bg-blue-500/15" };
    case "review":          return { icon: Star,            color: "text-amber-400",  bg: "bg-amber-500/15" };
    default:                return { icon: Bell,            color: "text-muted-foreground", bg: "bg-secondary" };
  }
}

function linkFor(notif: any): string {
  switch (notif.linkType) {
    case "listing":  return `/listing/${notif.linkId}`;
    case "guide":    return `/guides/${notif.linkId}`;
    case "group":    return `/groups/${notif.linkId}`;
    case "message":  return `/messages`;
    case "profile":  return `/profile/${notif.linkId}`;
    default:         return "/";
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── Single notification row ──────────────────────────────────
function NotifRow({ notif, onRead, onDelete, onNavigate }: {
  notif: any;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  onNavigate: (path: string) => void;
}) {
  const { icon: Icon, color, bg } = notifMeta(notif.type);

  const handleClick = () => {
    if (!notif.read) onRead(notif.id);
    onNavigate(linkFor(notif));
  };

  return (
    <div
      className={`flex gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors cursor-pointer group relative ${
        !notif.read ? "bg-primary/5" : ""
      }`}
      onClick={handleClick}
      data-testid={`notif-${notif.id}`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
      )}

      {/* Type icon or actor avatar */}
      <div className="shrink-0 mt-0.5">
        {notif.actor?.avatar ? (
          <div className="relative w-9 h-9">
            <Avatar className="w-9 h-9">
              <AvatarImage src={notif.actor.avatar} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {notif.actor.displayName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${bg} flex items-center justify-center`}>
              <Icon className={`w-2.5 h-2.5 ${color}`} />
            </div>
          </div>
        ) : (
          <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!notif.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>
          {notif.title}
        </p>
        {notif.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{notif.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</p>
      </div>

      {/* Delete button — shown on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 hover:text-destructive mt-0.5"
        data-testid={`notif-delete-${notif.id}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main bell component ──────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Unread count — poll every 30s
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => apiRequest("GET", "/api/notifications/unread-count").then(r => r.json()),
    refetchInterval: 30_000,
  });
  const unreadCount = countData?.count ?? 0;

  // Full list — only fetch when open
  const { data: notifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    queryFn: () => apiRequest("GET", "/api/notifications?limit=30").then(r => r.json()),
    enabled: open,
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read").then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="button-notifications"
        className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-6 h-6 mb-2 animate-pulse" />
                <p className="text-xs">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="w-8 h-8 mb-3 opacity-25" />
                <p className="text-sm font-medium">You're all caught up</p>
                <p className="text-xs mt-1">Notifications will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(notif => (
                  <NotifRow
                    key={notif.id}
                    notif={notif}
                    onRead={id => readMutation.mutate(id)}
                    onDelete={id => deleteMutation.mutate(id)}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border text-center">
              <button
                onClick={() => { setOpen(false); navigate("/notifications"); }}
                className="text-xs text-primary hover:underline"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
