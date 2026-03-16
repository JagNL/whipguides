import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";
import {
  MessageSquare, Send, ArrowLeft, ShieldCheck, Link as LinkIcon,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Supabase Realtime client (public anon key — read-only subscription) ──
// We use import.meta.env so the key is baked in at build time from VITE_ vars.
// Falls back gracefully if not set (preview mode).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const realtimeClient = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

// ─── Types ────────────────────────────────────────────────────
interface Conversation {
  id: number;
  participant1Id: number;
  participant2Id: number;
  listingId: number | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount1: number;
  unreadCount2: number;
  otherUser?: any;
  listing?: any;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  readAt: string | null;
  createdAt: string;
  sender?: any;
}

// ─── Helpers ─────────────────────────────────────────────────
function unreadForMe(conv: Conversation, userId: number) {
  return conv.participant1Id === userId ? conv.unreadCount1 : conv.unreadCount2;
}

// ─── Main MessagesPage ────────────────────────────────────────
export default function MessagesPage({ threadUserId }: { threadUserId?: number }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Auto-open thread when coming from /messages/:userId ──
  const { mutate: startConversation } = useMutation({
    mutationFn: (otherUserId: number) =>
      apiRequest("POST", "/api/conversations", { otherUserId }).then(r => r.json()),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setActiveConvId(conv.id);
    },
  });

  useEffect(() => {
    if (threadUserId && user && threadUserId !== user.id) {
      startConversation(threadUserId);
    }
  }, [threadUserId, user?.id]);

  // ── Fetch inbox ──
  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    queryFn: () => apiRequest("GET", "/api/conversations").then(r => r.json()),
    enabled: isAuthenticated,
    refetchInterval: 30000, // poll every 30s as fallback
  });

  // ── Fetch messages for active thread ──
  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConvId, "messages"],
    queryFn: () => apiRequest("GET", `/api/conversations/${activeConvId}/messages`).then(r => r.json()),
    enabled: !!activeConvId,
  });

  // ── Supabase Realtime subscription ───────────────────────
  useEffect(() => {
    if (!activeConvId || !realtimeClient) return;
    const channel = realtimeClient
      .channel(`messages:conv:${activeConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConvId}`,
        },
        () => {
          // Refetch messages and conversations on new message
          queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConvId, "messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        }
      )
      .subscribe();
    return () => { realtimeClient.removeChannel(channel); };
  }, [activeConvId]);

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──
  const { mutate: sendMessage, isPending: sending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/conversations/${activeConvId}/messages`, { content: draft }).then(r => r.json()),
    onSuccess: (newMsg) => {
      setDraft("");
      // Optimistically append
      queryClient.setQueryData<Message[]>(
        ["/api/conversations", activeConvId, "messages"],
        old => [...(old || []), newMsg]
      );
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const handleSend = () => {
    if (!draft.trim() || !activeConvId || sending) return;
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  // ── Unauthenticated ──
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-display text-2xl font-extrabold mb-2">Your Messages</h2>
        <p className="text-muted-foreground mb-6">Sign in to view and send messages.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <MessageSquare className="w-6 h-6 text-primary" />
        <h1 className="text-display text-2xl font-extrabold">Messages</h1>
        {conversations.some(c => unreadForMe(c, user!.id) > 0) && (
          <Badge className="bg-primary text-primary-foreground text-xs">
            {conversations.reduce((sum, c) => sum + unreadForMe(c, user!.id), 0)} unread
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-0 rounded-xl border border-border overflow-hidden bg-card min-h-[520px]">

        {/* ── Inbox sidebar ── */}
        <div className={cn(
          "border-r border-border flex flex-col",
          activeConvId ? "hidden md:flex" : "flex"
        )}>
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversations</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1">Message a seller from any listing to get started.</p>
              </div>
            ) : (
              conversations.map(conv => {
                const unread = unreadForMe(conv, user!.id);
                const isActive = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    data-testid={`conv-item-${conv.id}`}
                    onClick={() => setActiveConvId(conv.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/50 hover:bg-secondary/50 transition-colors",
                      isActive && "bg-primary/8 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={conv.otherUser?.avatar} />
                        <AvatarFallback>{conv.otherUser?.displayName?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={cn("text-sm font-semibold truncate", unread > 0 && "text-foreground")}>
                          {conv.otherUser?.displayName || "Unknown"}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      </div>
                      {conv.listing && (
                        <p className="text-[10px] text-primary truncate mb-0.5">
                          re: {conv.listing.title}
                        </p>
                      )}
                      <p className={cn(
                        "text-xs truncate",
                        unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {conv.lastMessage || "Start a conversation..."}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Thread panel ── */}
        {activeConvId && activeConv ? (
          <div className="flex flex-col h-[520px]">
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <button
                className="md:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setActiveConvId(null)}
                data-testid="button-back-inbox"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar className="w-8 h-8">
                <AvatarImage src={activeConv.otherUser?.avatar} />
                <AvatarFallback>{activeConv.otherUser?.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => navigate(`/profile/${activeConv.otherUser?.id}`)}
                    className="font-semibold text-sm hover:text-primary transition-colors"
                    data-testid="link-other-user-profile"
                  >
                    {activeConv.otherUser?.displayName}
                  </button>
                  {activeConv.otherUser?.verified && (
                    <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </div>
                {activeConv.listing && (
                  <button
                    onClick={() => navigate(`/listing/${activeConv.listing.id}`)}
                    className="text-[11px] text-primary/80 hover:text-primary flex items-center gap-1 truncate max-w-[200px]"
                    data-testid="link-listing-context"
                  >
                    <LinkIcon className="w-3 h-3 shrink-0" />
                    {activeConv.listing.title}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="messages-thread">
              {msgsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.senderId === user!.id;
                  return (
                    <div
                      key={msg.id}
                      data-testid={`msg-${msg.id}`}
                      className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}
                    >
                      {!isMe && (
                        <Avatar className="w-6 h-6 shrink-0 mb-0.5">
                          <AvatarImage src={msg.sender?.avatar} />
                          <AvatarFallback className="text-[10px]">{msg.sender?.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-foreground rounded-bl-sm"
                      )}>
                        <p>{msg.content}</p>
                        <p className={cn(
                          "text-[10px] mt-1",
                          isMe ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                        )}>
                          {timeAgo(msg.createdAt)}
                          {isMe && msg.readAt && " · Read"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-2">
              <Input
                data-testid="input-message-compose"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send)"
                className="flex-1 bg-secondary border-border"
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                data-testid="button-send-message"
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          // No active thread selected (desktop empty state)
          <div className="hidden md:flex flex-col items-center justify-center text-muted-foreground h-[520px]">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-semibold">Select a conversation</p>
            <p className="text-sm mt-1">or contact a seller from any listing</p>
          </div>
        )}
      </div>
    </div>
  );
}
