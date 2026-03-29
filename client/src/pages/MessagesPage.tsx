import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";
import {
  MessageSquare, Send, ArrowLeft, ShieldCheck, ExternalLink,
  Star, MapPin, Clock, Car, Tag, ChevronRight, DollarSign,
  CheckCircle2, XCircle, AlertCircle, User,
} from "lucide-react";
import { timeAgo, formatPrice, cn } from "@/lib/utils";
import { useCfUrl } from "@/hooks/use-cf-url";

// ─── Supabase Realtime ─────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const realtimeClient = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

// ─── Types ────────────────────────────────────────────────
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

function unreadForMe(conv: Conversation, userId: number) {
  return conv.participant1Id === userId ? conv.unreadCount1 : conv.unreadCount2;
}

// ─── Listing status chip ─────────────────────────────────
function ListingStatusChip({ status }: { status?: string }) {
  if (!status || status === "active") return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> Available
    </span>
  );
  if (status === "sold") return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-400">
      <XCircle className="w-3 h-3" /> Sold
    </span>
  );
  if (status === "pending") return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400">
      <AlertCircle className="w-3 h-3" /> Pending
    </span>
  );
  return null;
}

// ─── Listing context card (pinned at top of thread) ───────
function ListingContextCard({ listing, onView }: { listing: any; onView: () => void }) {
  const cfUrl = useCfUrl();
  const imgSrc = listing.images?.[0]
    ? (listing.images[0].startsWith("http")
        ? listing.images[0]
        : cfUrl ? `${cfUrl}/${listing.images[0]}/public` : null)
    : null;

  return (
    <button
      onClick={onView}
      className="w-full text-left flex items-center gap-3 bg-secondary/60 hover:bg-secondary transition-colors px-4 py-3 border-b border-border group"
      data-testid="button-listing-context"
    >
      {/* Listing thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary shrink-0 border border-border">
        {imgSrc
          ? <img src={imgSrc} alt={listing.title} className="w-full h-full object-cover" />
          : <Car className="w-6 h-6 text-muted-foreground/30 m-auto mt-4" />
        }
      </div>

      {/* Listing info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Listing</p>
        <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </p>
        <div className="flex items-center gap-2.5 mt-0.5">
          <span className="text-sm font-bold text-primary">{formatPrice(listing.price)}</span>
          {listing.condition && (
            <span className="text-xs text-muted-foreground">· {listing.condition}</span>
          )}
          <ListingStatusChip status={listing.status} />
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

// ─── Seller profile mini-card ─────────────────────────────
function SellerCard({ user: otherUser, isSeller, onView }: { user: any; isSeller: boolean; onView: () => void }) {
  if (!otherUser) return null;
  return (
    <button
      onClick={onView}
      className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors group border-b border-border/60"
      data-testid="button-seller-profile"
    >
      <Avatar className="w-9 h-9 shrink-0">
        <AvatarImage src={otherUser.avatar} />
        <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
          {otherUser.displayName?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold group-hover:text-primary transition-colors">
            {otherUser.displayName}
          </span>
          {otherUser.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
          <span className="text-xs text-muted-foreground ml-auto">{isSeller ? "Seller" : "Buyer"}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {otherUser.rating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {Number(otherUser.rating).toFixed(1)}
              {otherUser.reviewCount > 0 && <span className="ml-0.5">({otherUser.reviewCount})</span>}
            </span>
          )}
          {otherUser.location && (
            <span className="flex items-center gap-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> {otherUser.location}
            </span>
          )}
          {otherUser.responseTime && (
            <span className="flex items-center gap-0.5 truncate">
              <Clock className="w-3 h-3 shrink-0" /> {otherUser.responseTime}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

// ─── Quick-reply suggestions ──────────────────────────────
function QuickReplies({ listing, onSelect }: { listing?: any; onSelect: (text: string) => void }) {
  const replies = listing ? [
    `Is this still available?`,
    `Is ${listing.price ? formatPrice(Math.round(listing.price * 0.9)) : "the price"} your best price?`,
    `Can I schedule a time to see it?`,
    `Do you have more photos?`,
    `What's the history on this?`,
  ] : [
    `How's it going?`,
    `Thanks for reaching out!`,
    `Let me know if you have questions.`,
  ];

  return (
    <div className="flex gap-2 flex-wrap px-4 py-2 border-t border-border/50">
      {replies.slice(0, 3).map((r, i) => (
        <button
          key={i}
          onClick={() => onSelect(r)}
          className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-primary/15 hover:text-primary border border-border hover:border-primary/30 transition-colors whitespace-nowrap"
          data-testid={`quick-reply-${i}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ─── Inbox conversation row ───────────────────────────────
function ConvRow({ conv, isActive, userId, onClick }: {
  conv: Conversation; isActive: boolean; userId: number; onClick: () => void;
}) {
  const unread = unreadForMe(conv, userId);
  const isListing = !!conv.listingId;

  return (
    <button
      data-testid={`conv-item-${conv.id}`}
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/50 hover:bg-secondary/50 transition-colors",
        isActive && "bg-primary/8 border-l-2 border-l-primary"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="w-10 h-10">
          <AvatarImage src={conv.otherUser?.avatar} />
          <AvatarFallback className="text-sm font-bold bg-primary/20 text-primary">
            {conv.otherUser?.displayName?.[0] || "?"}
          </AvatarFallback>
        </Avatar>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread}
          </span>
        )}
        {/* Listing indicator dot */}
        {isListing && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card flex items-center justify-center">
            <Car className="w-2.5 h-2.5 text-primary" />
          </div>
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
          <div className="flex items-center gap-1 mb-0.5">
            <Tag className="w-2.5 h-2.5 text-primary/70 shrink-0" />
            <p className="text-[10px] text-primary/80 truncate font-medium">{conv.listing.title}</p>
            {conv.listing.price && (
              <span className="text-[10px] text-muted-foreground shrink-0">· {formatPrice(conv.listing.price)}</span>
            )}
          </div>
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
}

// ─── Main MessagesPage ────────────────────────────────────
export default function MessagesPage({ threadUserId }: { threadUserId?: number }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "listings" | "direct">("all");
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
    refetchInterval: 30000,
  });

  // ── Fetch messages for active thread ──
  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", activeConvId, "messages"],
    queryFn: () => apiRequest("GET", `/api/conversations/${activeConvId}/messages`).then(r => r.json()),
    enabled: !!activeConvId,
  });

  // ── Realtime ──
  useEffect(() => {
    if (!activeConvId || !realtimeClient) return;
    const channel = realtimeClient
      .channel(`messages:conv:${activeConvId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${activeConvId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConvId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      })
      .subscribe();
    return () => { realtimeClient.removeChannel(channel); };
  }, [activeConvId]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ──
  const { mutate: sendMessage, isPending: sending } = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/conversations/${activeConvId}/messages`, { content: draft }).then(r => r.json()),
    onSuccess: (newMsg) => {
      setDraft("");
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

  // ── Filter inbox ──
  const filteredConvs = conversations.filter(c => {
    if (inboxFilter === "listings") return !!c.listingId;
    if (inboxFilter === "direct") return !c.listingId;
    return true;
  });

  const listingConvCount = conversations.filter(c => !!c.listingId).length;
  const directConvCount = conversations.filter(c => !c.listingId).length;
  const totalUnread = conversations.reduce((sum, c) => sum + unreadForMe(c, user?.id ?? 0), 0);

  // Determine if the other user is the seller or buyer
  const otherUser = activeConv?.otherUser;
  const isListingConv = !!activeConv?.listingId;
  // If the listing seller is the other user, they're the seller
  const otherIsSeller = isListingConv && activeConv?.listing?.sellerId === otherUser?.id;

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <MessageSquare className="w-6 h-6 text-primary" />
        <h1 className="text-display text-2xl font-extrabold">Messages</h1>
        {totalUnread > 0 && (
          <Badge className="bg-primary text-primary-foreground text-xs">{totalUnread} unread</Badge>
        )}
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-0 rounded-xl border border-border overflow-hidden bg-card min-h-[600px]">

        {/* ── Inbox sidebar ── */}
        <div className={cn("border-r border-border flex flex-col", activeConvId ? "hidden md:flex" : "flex")}>
          {/* Filter tabs */}
          <div className="px-3 py-2.5 border-b border-border flex gap-1">
            {[
              { key: "all", label: "All", count: conversations.length },
              { key: "listings", label: "Listings", count: listingConvCount },
              { key: "direct", label: "Direct", count: directConvCount },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setInboxFilter(tab.key as any)}
                className={cn(
                  "flex-1 py-1 text-xs font-semibold rounded-md transition-colors",
                  inboxFilter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                data-testid={`inbox-filter-${tab.key}`}
              >
                {tab.label}
                {tab.count > 0 && <span className="ml-1 opacity-70">({tab.count})</span>}
              </button>
            ))}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1">
                  {inboxFilter === "listings"
                    ? "Contact a seller from any listing."
                    : inboxFilter === "direct"
                    ? "Visit someone's profile to message them."
                    : "Message a seller from any listing to get started."}
                </p>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <ConvRow
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeConvId}
                  userId={user!.id}
                  onClick={() => setActiveConvId(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Thread panel ── */}
        {activeConvId && activeConv ? (
          <div className="flex flex-col h-[600px]">
            {/* Thread header — person info */}
            <div className="border-b border-border">
              {/* Back + name row */}
              <div className="px-4 py-2.5 flex items-center gap-3">
                <button
                  className="md:hidden text-muted-foreground hover:text-foreground"
                  onClick={() => setActiveConvId(null)}
                  data-testid="button-back-inbox"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={otherUser?.avatar} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                    {otherUser?.displayName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigate(`/profile/${otherUser?.id}`)}
                      className="font-semibold text-sm hover:text-primary transition-colors"
                    >
                      {otherUser?.displayName}
                    </button>
                    {otherUser?.verified && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    {isListingConv && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 gap-1">
                        <Car className="w-2.5 h-2.5" /> Listing Inquiry
                      </Badge>
                    )}
                  </div>
                  {!isListingConv && otherUser?.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {otherUser.location}
                    </p>
                  )}
                </div>
                {/* View profile button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/profile/${otherUser?.id}`)}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  data-testid="button-view-profile"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
              </div>

              {/* Seller mini-card (listing convs only) */}
              {isListingConv && otherUser && (
                <SellerCard
                  user={otherUser}
                  isSeller={otherIsSeller}
                  onView={() => navigate(`/profile/${otherUser.id}`)}
                />
              )}

              {/* Listing context card */}
              {activeConv.listing && (
                <ListingContextCard
                  listing={activeConv.listing}
                  onView={() => navigate(`/listing/${activeConv.listing.id}`)}
                />
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="messages-thread">
              {msgsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center px-6">
                  {isListingConv ? (
                    <>
                      <Car className="w-10 h-10 mb-3 opacity-20" />
                      <p className="font-semibold mb-1">Start the conversation</p>
                      <p className="text-sm text-muted-foreground">
                        Ask about the listing — condition, history, availability, or make an offer.
                      </p>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </>
                  )}
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.senderId === user!.id;
                  return (
                    <div
                      key={msg.id}
                      data-testid={`msg-${msg.id}`}
                      className={cn("flex items-end gap-2", isMe ? "flex-row-reverse" : "flex-row")}
                      style={{ animationDelay: `${Math.min(i * 18, 120)}ms` }}
                    >
                      {!isMe && (
                        <Avatar className="w-6 h-6 shrink-0 mb-0.5">
                          <AvatarImage src={msg.sender?.avatar} />
                          <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                            {msg.sender?.displayName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isMe
                          ? "msg-me bg-primary text-primary-foreground rounded-br-sm"
                          : "msg-other bg-secondary text-foreground rounded-bl-sm"
                      )}>
                        <p>{msg.content}</p>
                        <p className={cn(
                          "text-[10px] mt-1",
                          isMe ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                        )}>
                          {timeAgo(msg.createdAt)}
                          {isMe && msg.readAt && <span className="read-receipt"> · Read</span>}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick replies */}
            {messages.length === 0 && (
              <QuickReplies
                listing={activeConv.listing}
                onSelect={text => setDraft(text)}
              />
            )}

            {/* Compose */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-2 bg-background/80 backdrop-blur-sm">
              <Input
                data-testid="input-message-compose"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isListingConv
                    ? "Ask about the item, make an offer..."
                    : "iMessage..."
                }
                className="flex-1 bg-secondary border-border compose-input rounded-full px-4"
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={(e) => {
                  const btn = e.currentTarget;
                  btn.classList.remove("send-btn-pulse");
                  void btn.offsetWidth; // reflow to restart animation
                  btn.classList.add("send-btn-pulse");
                  handleSend();
                }}
                disabled={!draft.trim() || sending}
                data-testid="button-send-message"
                className={cn(
                  "shrink-0 rounded-full transition-all duration-150",
                  draft.trim() && !sending
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/30"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {sending
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center text-muted-foreground h-[600px]">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-semibold">Select a conversation</p>
            <p className="text-sm mt-1">or contact a seller from any listing</p>
          </div>
        )}
      </div>
    </div>
  );
}
