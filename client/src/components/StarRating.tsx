import { Star } from "lucide-react";

export function StarRating({ rating, size = 14, showValue = true }: { rating: number; size?: number; showValue?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          style={{ width: size, height: size }}
          className={s <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}
        />
      ))}
      {showValue && (
        <span className="text-sm font-semibold ml-0.5">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}
