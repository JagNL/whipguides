import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/StarRating";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { timeAgo, formatPrice } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import ListingCard from "@/components/ListingCard";
import {
  MapPin, Eye, Heart, Share2, Flag, ShieldCheck,
  MessageSquare, ChevronLeft, ChevronRight, Clock,
  Gauge, Calendar, Hash, CheckCircle2, Sparkles,
} from "lucide-react";

const CONDITION_STYLES: Record<string, string> = {
  "Like New": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Excellent": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Good": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Fair": "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export default function ListingDetailPage({ id }: { id: number }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Track this view for recommendations
  useEffect(() => {
    if (id) {
      apiRequest("POST", `/api/listings/${id}/view`).catch(() => {});
    }
  }, [id]);

  const { mutate: startConversation, isPending: startingConv } = useMutation({
    mutationFn: (sellerId: number) =>
      apiRequest("POST", "/api/conversations", { otherUserId: sellerId, listingId: id }).then(r => r.json()),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      navigate(`/messages`);
      // Give the messages page a moment then set active conv via URL state isn't available,
      // so we navigate to /messages with the conversation already created — it will appear in inbox
    },
    onError: () => {
      toast({ title: "Error", description: "Could not start conversation. Try again.", variant: "destructive" });
    },
  });

  const handleContactSeller = () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Please sign in to contact sellers." });
      return;
    }
    if (listing?.seller) startConversation(listing.seller.id);
  };

  const { data: listing, isLoading } = useQuery<any>({
    queryKey: ["/api/listings", id],
    queryFn: () => apiRequest("GET", `/api/listings/${id}`).then(r => r.json()),
  });

  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ["/api/users", listing?.seller?.id, "reviews"],
    queryFn: () => apiRequest("GET", `/api/users/${listing?.seller?.id}/reviews`).then(r => r.json()),
    enabled: !!listing?.seller?.id,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
        <Skeleton className="aspect-video rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!listing) return <div className="p-8 text-center text-muted-foreground">Listing not found.</div>;

  const images: string[] = listing.images || [];
  const seller = listing.seller;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/" className="hover:text-foreground transition-colors">Marketplace</Link>
        <span>/</span>
        <span className="text-primary">{listing.category}</span>
        <span>/</span>
        <span className="text-foreground line-clamp-1">{listing.title}</span>
      </div>

      <div className="grid md:grid-cols-[1fr_380px] gap-6">
        {/* Left: Images + Details */}
        <div className="space-y-5">
          {/* Image gallery */}
          <div className="relative bg-secondary rounded-xl overflow-hidden aspect-video">
            {images.length > 0 ? (
              <img
                src={images[imgIdx]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">No photos</div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center border border-border hover:border-primary transition-colors"
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setImgIdx(i => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center border border-border hover:border-primary transition-colors"
                  data-testid="button-next-image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? "bg-primary" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Thumbnails */}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIdx ? "border-primary" : "border-border"}`}
                  data-testid={`button-thumb-${i}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Walk-Around Video */}
          {(listing.videoHlsUrl || listing.video_hls_url) && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                <span>Walk-Around Video</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full font-normal">from seller</span>
              </h2>
              <VideoPlayer
                hlsUrl={listing.videoHlsUrl || listing.video_hls_url}
                thumbnailUrl={listing.videoThumbnailUrl || listing.video_thumbnail_url}
                controls
              />
            </div>
          )}

          {/* Description */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-lg mb-3">Description</h2>
            <p className="text-muted-foreground leading-relaxed text-sm whitespace-pre-line">{listing.description}</p>
          </div>

          {/* Specs grid */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="font-bold text-lg mb-4">Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                // Vehicle fields
                ...(listing.listingType !== 'general' ? [
                  { icon: Calendar, label: "Year", value: listing.year },
                  { icon: Hash, label: "Make", value: listing.make },
                  { icon: Hash, label: "Model", value: listing.model },
                ] : []),
                // Mileage for vehicles only
                ...(listing.listingType === 'vehicle' || !listing.listingType ? [
                  { icon: Gauge, label: listing.category?.includes("Jet Ski") || listing.category?.includes("Boat") ? "Hours" : "Mileage", value: listing.mileage ? listing.mileage.toLocaleString() + (listing.category?.includes("Jet Ski") || listing.category?.includes("Boat") ? " hrs" : " mi") : undefined },
                ] : []),
                // Parts fitment
                ...(listing.listingType === 'parts' ? [
                  { icon: Hash, label: "Fits", value: [listing.fitsYearMin && listing.fitsYearMax ? `${listing.fitsYearMin}–${listing.fitsYearMax}` : (listing.fitsYearMin || listing.fitsYearMax), listing.fitsMake, listing.fitsModel].filter(Boolean).join(" ") || undefined },
                  { icon: Hash, label: "Part #", value: listing.partNumber },
                ] : []),
                // Universal
                { icon: CheckCircle2, label: "Condition", value: listing.condition },
                { icon: MapPin, label: "Location", value: listing.location },
              ].filter((s: any) => s.value).map(({ icon: Icon, label, value }: any) => (
                <div key={label} className="bg-secondary rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </div>
                  <p className="font-semibold text-sm">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seller reviews */}
          {reviews.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="font-bold text-lg mb-4">Seller Reviews ({reviews.length})</h2>
              <div className="space-y-4">
                {reviews.slice(0, 3).map((review: any) => (
                  <div key={review.id} className="flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={review.reviewer?.avatar} />
                      <AvatarFallback>{review.reviewer?.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{review.reviewer?.displayName}</span>
                        <span className="text-xs text-muted-foreground">{review.createdAt}</span>
                      </div>
                      <StarRating rating={review.rating} size={12} showValue={false} />
                      <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Price + Seller + Actions */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="bg-card rounded-xl border border-border p-5 sticky top-20">
            <div className="flex items-start justify-between mb-1">
              <span className="text-display text-3xl font-extrabold">${listing.price.toLocaleString()}</span>
              <Badge variant="outline" className={CONDITION_STYLES[listing.condition] || ""}>
                {listing.condition}
              </Badge>
            </div>
            <h1 className="font-bold text-base mb-3 text-foreground leading-snug">{listing.title}</h1>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {listing.location}</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {listing.views} views</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(listing.createdAt)}</span>
            </div>

            {/* CTA buttons */}
            <div className="space-y-2 mb-4">
              <Button
                className="w-full font-bold gap-2"
                data-testid="button-contact-seller"
                onClick={handleContactSeller}
                disabled={startingConv || (!!user && listing?.seller?.id === user.id)}
              >
                <MessageSquare className="w-4 h-4" />
                {startingConv ? "Opening..." : user && listing?.seller?.id === user.id ? "Your Listing" : "Contact Seller"}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  data-testid="button-save-listing"
                  onClick={() => setSaved(s => !s)}
                >
                  <Heart className={`w-4 h-4 ${saved ? "fill-red-500 text-red-500" : ""}`} />
                  {saved ? "Saved" : "Save"}
                </Button>
                <Button variant="outline" size="icon" data-testid="button-share" className="h-9 w-9">
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" data-testid="button-report" className="h-9 w-9 text-muted-foreground">
                  <Flag className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Safety tip */}
            <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Safety Tips
              </p>
              Meet in a public place. Never wire money. Inspect before buying. Use WhipGuides Safe Pay for protection.
            </div>
          </div>

          {/* Seller card */}
          {seller && (
            <Link href={`/profile/${seller.id}`}>
              <div className="bg-card rounded-xl border border-border p-4 hover:border-primary/40 transition-colors cursor-pointer">
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={seller.avatar} />
                    <AvatarFallback>{seller.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm">{seller.displayName}</span>
                      {seller.verified && <ShieldCheck className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <StarRating rating={seller.rating || 0} size={12} />
                      <span className="text-xs text-muted-foreground">({seller.reviewCount} reviews)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3 inline mr-0.5" />{seller.responseTime}
                    </p>
                    <p className="text-xs text-muted-foreground">Member since {seller.memberSince}</p>
                  </div>
                </div>
                <p className="text-xs text-primary mt-3 font-semibold">View Profile →</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Similar Listings */}
      <SimilarListings listingId={id} />
    </div>
  );
}

function SimilarListings({ listingId }: { listingId: number }) {
  const { data: similar = [] } = useQuery<any[]>({
    queryKey: ["/api/listings", listingId, "similar"],
    queryFn: () => apiRequest("GET", `/api/listings/${listingId}/similar`).then(r => r.json()),
  });

  if (!similar.length) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-10">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="font-bold text-base">Similar Listings</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {similar.map(l => (
          <ListingCard key={l.id} listing={l} compact />
        ))}
      </div>
    </div>
  );
}
