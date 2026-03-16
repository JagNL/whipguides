import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StarRating } from "@/components/StarRating";
import ListingCard from "@/components/ListingCard";
import { AvatarUploader } from "@/components/ImageUploader";
import { ShieldCheck, MapPin, Calendar, MessageSquare, Star, Clock, Pencil, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type Tab = "listings" | "reviews";

export default function ProfilePage({ id }: { id: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("listings");
  const [editOpen, setEditOpen] = useState(false);
  const { user: currentUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const isOwnProfile = currentUser?.id === id;
  const [, navigate] = useLocation();

  const { mutate: messageUser, isPending: messagingUser } = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/conversations", { otherUserId: id }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      navigate("/messages");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not start conversation.", variant: "destructive" });
    },
  });

  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/users", id],
    queryFn: () => apiRequest("GET", `/api/users/${id}`).then(r => r.json()),
  });

  const { data: allListings = [], isLoading: listingsLoading } = useQuery<any[]>({
    queryKey: ["/api/listings"],
    queryFn: () => apiRequest("GET", `/api/listings`).then(r => r.json()),
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: ["/api/users", id, "reviews"],
    queryFn: () => apiRequest("GET", `/api/users/${id}/reviews`).then(r => r.json()),
  });

  const userListings = allListings.filter(l => l.sellerId === id);

  // ─── Edit profile state ───────────────────────────────────
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvatarId, setEditAvatarId] = useState<string | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  const openEdit = () => {
    setEditDisplayName(user?.displayName || "");
    setEditBio(user?.bio || "");
    setEditLocation(user?.location || "");
    setEditAvatarId(null);
    setEditAvatarPreview(null);
    setEditOpen(true);
  };

  const { mutate: saveProfile, isPending: isSaving } = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/users/${id}`, {
        displayName: editDisplayName,
        bio: editBio,
        location: editLocation,
        ...(editAvatarId ? { avatar: editAvatarPreview || editAvatarId } : {}),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", id] });
      refreshUser();
      setEditOpen(false);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save profile. Try again.", variant: "destructive" });
    },
  });

  if (userLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <div className="p-8 text-center text-muted-foreground">User not found.</div>;

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter((r: any) => r.rating === star).length,
    pct: reviews.length ? (reviews.filter((r: any) => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-2xl">{user.displayName[0]}</AvatarFallback>
            </Avatar>
            {user.verified && (
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-display text-2xl font-extrabold">{user.displayName}</h1>
                  {user.verified && (
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-xs gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mb-2">@{user.username}</p>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {user.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{user.location}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Member since {user.memberSince}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{user.responseTime}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {isOwnProfile ? (
                  <Button variant="outline" className="gap-2 shrink-0" onClick={openEdit} data-testid="button-edit-profile">
                    <Pencil className="w-4 h-4" /> Edit Profile
                  </Button>
                ) : (
                  <Button
                    className="gap-2 shrink-0"
                    data-testid="button-message-user"
                    onClick={() => {
                      if (!currentUser) { toast({ title: "Sign in required", description: "Please sign in to send messages." }); return; }
                      messageUser();
                    }}
                    disabled={messagingUser}
                  >
                    <MessageSquare className="w-4 h-4" /> {messagingUser ? "Opening..." : "Message"}
                  </Button>
                )}
              </div>
            </div>

            {user.bio && (
              <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{user.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 pt-5 border-t border-border grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-display text-2xl font-extrabold text-primary">{userListings.length}</p>
            <p className="text-xs text-muted-foreground">Active Listings</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <p className="text-display text-2xl font-extrabold text-primary">{user.rating?.toFixed(1) || "—"}</p>
              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 mb-0.5" />
            </div>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </div>
          <div>
            <p className="text-display text-2xl font-extrabold text-primary">{user.reviewCount || 0}</p>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-border">
        {(["listings", "reviews"] as Tab[]).map(tab => (
          <button
            key={tab}
            data-testid={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab} {tab === "listings" ? `(${userListings.length})` : `(${reviews.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "listings" && (
        listingsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : userListings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-semibold">No active listings</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userListings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )
      )}

      {activeTab === "reviews" && (
        <div className="space-y-4">
          {/* Rating breakdown */}
          {reviews.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 mb-2">
              <div className="flex items-start gap-8 flex-wrap">
                <div className="text-center">
                  <p className="text-display text-5xl font-extrabold text-primary">{user.rating?.toFixed(1)}</p>
                  <StarRating rating={user.rating || 0} size={16} showValue={false} />
                  <p className="text-xs text-muted-foreground mt-1">{reviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5 min-w-[200px]">
                  {ratingBreakdown.map(({ star, count, pct }) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-right text-muted-foreground">{star}★</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {reviewsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-semibold">No reviews yet</p>
            </div>
          ) : (
            reviews.map((review: any) => (
              <div key={review.id} className="bg-card rounded-xl border border-border p-4" data-testid={`card-review-${review.id}`}>
                <div className="flex items-start gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={review.reviewer?.avatar} />
                    <AvatarFallback>{review.reviewer?.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{review.reviewer?.displayName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{review.type}</Badge>
                        <span className="text-xs text-muted-foreground">{review.createdAt}</span>
                      </div>
                    </div>
                    <StarRating rating={review.rating} size={13} showValue={false} />
                    <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Edit Profile Dialog ───────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <AvatarUploader
                currentUrl={user.avatar}
                size={88}
                onUpload={(imageId, previewUrl) => {
                  setEditAvatarId(imageId);
                  setEditAvatarPreview(previewUrl);
                }}
              />
              <p className="text-xs text-muted-foreground">Click to change photo</p>
            </div>

            {/* Display name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                data-testid="input-edit-displayname"
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" /> Location
              </label>
              <Input
                data-testid="input-edit-location"
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                placeholder="City, State"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                data-testid="input-edit-bio"
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                placeholder="Tell buyers about yourself..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => saveProfile()} disabled={isSaving} data-testid="button-save-profile">
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
