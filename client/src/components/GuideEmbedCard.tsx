/**
 * GuideEmbedCard — rich inline preview of a guide inside a group post.
 * Used in PostCard and PostComposer preview.
 */
import { Link } from "wouter";
import { useCfUrl, cfImageUrl } from "@/hooks/use-cf-url";
import { BookOpen, Clock, Wrench, ChevronRight, Car } from "lucide-react";
import { guideUrl } from "@/lib/utils";

interface GuideEmbedCardProps {
  guide: {
    id: number;
    title: string;
    description: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYearStart: string;
    vehicleYearEnd: string;
    difficulty: string;
    timeEstimate: string;
    category?: string;
    tools?: string[];
    steps?: any[];
    coverImageId?: string;
    author?: { displayName?: string; username?: string };
  };
  /** If true, wraps in a Link to the guide page */
  clickable?: boolean;
}

const difficultyColors: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  intermediate: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  advanced: "bg-red-500/15 text-red-400 border-red-500/20",
};

export function GuideEmbedCard({ guide, clickable = true }: GuideEmbedCardProps) {
  const cfUrl = useCfUrl();
  const coverSrc = cfImageUrl(cfUrl, guide.coverImageId);

  const year = guide.vehicleYearStart === guide.vehicleYearEnd
    ? guide.vehicleYearStart
    : `${guide.vehicleYearStart}–${guide.vehicleYearEnd}`;

  const diffColor = difficultyColors[guide.difficulty] ?? "bg-muted text-muted-foreground border-border";

  const inner = (
    <div className="flex gap-3 items-stretch">
      {/* Cover thumbnail */}
      <div className="w-20 sm:w-24 shrink-0 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
        {coverSrc ? (
          <img src={coverSrc} alt={guide.title} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="w-6 h-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${diffColor}`}>
            {guide.difficulty}
          </span>
          {guide.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
              {guide.category}
            </span>
          )}
        </div>

        <p className="font-semibold text-sm leading-snug line-clamp-1 mb-0.5 group-hover:text-primary transition-colors">
          {guide.title}
        </p>

        <p className="text-xs text-primary/80 font-medium mb-1.5 truncate flex items-center gap-1">
          <Car className="w-3 h-3 shrink-0" />
          {year} {guide.vehicleMake} {guide.vehicleModel}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {guide.timeEstimate}h
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            {guide.tools?.length ?? 0} tools
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {guide.steps?.length ?? 0} steps
          </span>
          {clickable && (
            <span className="ml-auto flex items-center gap-0.5 text-primary font-medium">
              View <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const wrapper = (
    <div className={`group mt-3 border border-primary/25 bg-primary/5 rounded-xl p-3 ${clickable ? "hover:border-primary/50 hover:bg-primary/8 transition-colors cursor-pointer" : ""}`}>
      <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary/70">
        <BookOpen className="w-3 h-3" />
        Attached Guide
      </div>
      {inner}
    </div>
  );

  if (clickable) {
    return <Link href={guideUrl(guide.id, guide.title)}>{wrapper}</Link>;
  }
  return wrapper;
}
