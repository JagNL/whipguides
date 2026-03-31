import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CalendarDays, MapPin, Users, Globe, Plus, Loader2, ChevronDown, ChevronUp,
  Car, Cpu, Music2, Wrench, Target, Package, Waves, Trophy,
} from "lucide-react";
import { format, isPast } from "date-fns";

const VERTICALS = ["All", "Automotive", "Tech & AI", "Music", "Firearms", "Maker", "Outdoors", "General"];

const EVENT_TYPES = ["meetup", "track_day", "show", "swap_meet", "workshop", "online", "other"];

const VERTICAL_GRADIENTS: Record<string, string> = {
  automotive: "from-blue-600/30 to-blue-900/30",
  tech: "from-cyan-600/30 to-cyan-900/30",
  music: "from-purple-600/30 to-purple-900/30",
  firearms: "from-orange-600/30 to-orange-900/30",
  maker: "from-green-600/30 to-green-900/30",
  outdoors: "from-emerald-600/30 to-emerald-900/30",
  general: "from-slate-600/30 to-slate-900/30",
};

// ── RSVP buttons ─────────────────────────────────────────────
function RsvpButtons({ eventId, myRsvp, rsvpCount }: { eventId: number; myRsvp?: string; rsvpCount: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (status: string) => apiRequest("POST", `/api/community/events/${eventId}/rsvp`, { status }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/community/events"] }),
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  if (!user) return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Users className="w-3.5 h-3.5" /> {rsvpCount} going
    </div>
  );
  const statuses = [{ key: "going", label: "Going" }, { key: "maybe", label: "Maybe" }, { key: "not_going", label: "Can't go" }];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {statuses.map(s => (
        <button key={s.key} onClick={() => mut.mutate(s.key)}
          disabled={mut.isPending}
          data-testid={`rsvp-${eventId}-${s.key}`}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            myRsvp === s.key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
          }`}>
          {s.label}
        </button>
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rsvpCount} going</span>
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ event, cfBase }: { event: any; cfBase: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: attendees } = useQuery<any[]>({
    queryKey: ["/api/community/events", event.id, "attendees"],
    queryFn: () => apiRequest("GET", `/api/community/events/${event.id}/attendees`).then(r => r.json()),
    enabled: expanded,
  });
  const imgSrc = event.cover_image ? cfImageUrl(cfBase, event.cover_image) : null;
  const gradient = VERTICAL_GRADIENTS[event.vertical?.toLowerCase()] || VERTICAL_GRADIENTS.general;
  const dateStr = event.event_date ? format(new Date(event.event_date), "EEE, MMM d · h:mm a") : "";
  const location = event.is_online ? "Online" : [event.city, event.state].filter(Boolean).join(", ") || event.location_name || "";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors"
      data-testid={`event-card-${event.id}`}>
      <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        {imgSrc ? <img src={imgSrc} alt={event.title} className="w-full h-full object-cover" /> :
          <CalendarDays className="w-10 h-10 text-muted-foreground opacity-40" />}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-sm line-clamp-2">{event.title}</h3>
          {event.group_id && <Badge variant="outline" className="text-[10px] shrink-0">Group</Badge>}
        </div>
        <div className="space-y-1 text-xs text-muted-foreground mb-3">
          {dateStr && <div className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 shrink-0" />{dateStr}</div>}
          {location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{location}</div>}
          {event.organizer && (
            <div className="flex items-center gap-1.5">
              <Avatar className="w-4 h-4"><AvatarImage src={event.organizer.avatar} /><AvatarFallback>{event.organizer.displayName?.[0]}</AvatarFallback></Avatar>
              <span>{event.organizer.displayName || event.organizer.username}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <RsvpButtons eventId={event.id} myRsvp={event.my_rsvp} rsvpCount={event.rsvp_count || 0} />
          <button onClick={() => setExpanded(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            {event.description && <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>}
            {attendees && attendees.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Attendees ({attendees.length})</p>
                <div className="flex items-center gap-1.5">
                  {attendees.slice(0, 5).map((a: any) => (
                    <Avatar key={a.id} className="w-7 h-7 border-2 border-card">
                      <AvatarImage src={a.avatar} />
                      <AvatarFallback className="text-[10px]">{a.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                  ))}
                  {attendees.length > 5 && <span className="text-xs text-muted-foreground">+{attendees.length - 5} more</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Event Dialog ───────────────────────────────────────
function CreateEventDialog({ open, onClose, prefillGroupId, prefillVertical }: {
  open: boolean; onClose: () => void; prefillGroupId?: number; prefillVertical?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vertical, setVertical] = useState(prefillVertical || "automotive");
  const [eventType, setEventType] = useState("meetup");
  const [eventDate, setEventDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [groupId, setGroupId] = useState(prefillGroupId ? String(prefillGroupId) : "");

  const { data: myGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/groups/mine"],
    queryFn: () => apiRequest("GET", "/api/groups/mine").then(r => r.json()),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/community/events", {
      title, description, vertical, event_type: eventType,
      event_date: eventDate || undefined,
      location_name: locationName, address, city, state, zip,
      is_online: isOnline, online_url: isOnline ? onlineUrl : undefined,
      capacity: capacity ? Number(capacity) : undefined,
      group_id: groupId ? Number(groupId) : undefined,
      is_private: isPrivate,
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community/events"] });
      toast({ title: "Event created!" });
      onClose();
    },
    onError: () => toast({ title: "Error creating event", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event name" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vertical</label>
              <Select value={vertical} onValueChange={setVertical}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["automotive","tech","music","firearms","maker","outdoors","powersports","general"].map(v => (
                    <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Event Type</label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date & Time</label>
            <Input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Online Event</label>
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
          </div>
          {isOnline ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Online URL</label>
              <Input value={onlineUrl} onChange={e => setOnlineUrl(e.target.value)} placeholder="https://zoom.us/..." />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Venue Name</label>
                <Input value={locationName} onChange={e => setLocationName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Address</label>
                <Input value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1.5">
                  <label className="text-sm font-medium">City</label>
                  <Input value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">State</label>
                  <Input value={state} onChange={e => setState(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Zip</label>
                  <Input value={zip} onChange={e => setZip(e.target.value)} />
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Capacity (optional)</label>
              <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Unlimited" />
            </div>
            {myGroups.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Group (optional)</label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {myGroups.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Private Event</label>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending} data-testid="btn-create-event">
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main EventsPage ───────────────────────────────────────────
export default function EventsPage() {
  useSEO({ title: "Events", description: "Discover automotive meets, track days, gun shows, maker fairs, and more events near you on WhipGuides." });
  const [activeVertical, setActiveVertical] = useState("All");
  const [showPast, setShowPast] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const cfBase = useCfUrl();

  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/community/events", activeVertical, showPast],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeVertical !== "All") params.set("vertical", activeVertical.toLowerCase().replace(" & ", "_").replace(" ", "_"));
      if (showPast) params.set("past", "true");
      return apiRequest("GET", `/api/community/events?${params}`).then(r => r.json());
    },
  });

  const filtered = (events as any[]).filter((e: any) => {
    const past = e.event_date ? isPast(new Date(e.event_date)) : false;
    return showPast ? past : !past;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-display text-3xl font-extrabold">Events</h1>
          <p className="text-muted-foreground text-sm mt-1">Meetups, track days, shows, and more</p>
        </div>
        {user && (
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5" data-testid="btn-create-event-open">
            <Plus className="w-4 h-4" /> Create Event
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {VERTICALS.map(v => (
          <button key={v} onClick={() => setActiveVertical(v)}
            data-testid={`filter-vertical-${v.toLowerCase()}`}
            className={`shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors ${
              activeVertical === v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}>{v}</button>
        ))}
      </div>

      {/* Past/Upcoming toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setShowPast(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!showPast ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground"}`}>
          Upcoming
        </button>
        <button onClick={() => setShowPast(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${showPast ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground"}`}>
          Past
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-semibold">{showPast ? "No past events" : "No upcoming events"}</p>
          {user && !showPast && <p className="text-sm mt-1">Be the first to create one!</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event: any) => <EventCard key={event.id} event={event} cfBase={cfBase} />)}
        </div>
      )}

      <CreateEventDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
