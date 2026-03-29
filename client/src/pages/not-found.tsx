import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search, Gauge } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-foreground">

      {/* Animated speedometer / gauge */}
      <div className="relative w-40 h-40 mb-8">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer ring */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
          {/* Arc background */}
          <path
            d="M 20 140 A 80 80 0 0 1 180 140"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Arc fill — needle stuck at 404 (pegged) */}
          <path
            d="M 20 140 A 80 80 0 0 1 180 140"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="251"
            strokeDashoffset="0"
            style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary)))" }}
          />
          {/* Needle — pinned to max */}
          <line
            x1="100" y1="100"
            x2="185" y2="105"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            style={{
              transformOrigin: "100px 100px",
              transform: "rotate(-5deg)",
            }}
          />
          <circle cx="100" cy="100" r="8" fill="hsl(var(--primary))" />
          {/* Tick marks */}
          {[0, 30, 60, 90, 120, 150, 180].map((deg, i) => {
            const angle = (deg - 90) * (Math.PI / 180);
            const r1 = 75, r2 = 65;
            return (
              <line
                key={i}
                x1={100 + r1 * Math.cos(angle)}
                y1={100 + r1 * Math.sin(angle)}
                x2={100 + r2 * Math.cos(angle)}
                y2={100 + r2 * Math.sin(angle)}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={i === 0 || i === 6 ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          {/* Center labels */}
          <text x="100" y="130" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="monospace">MPH</text>
        </svg>
        {/* 404 overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-primary" style={{ marginTop: "-12px", fontFamily: "monospace" }}>404</span>
        </div>
      </div>

      {/* Copy */}
      <h1 className="text-3xl font-black mb-2 text-center" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Redlined into nowhere.
      </h1>
      <p className="text-muted-foreground text-center max-w-sm mb-2 leading-relaxed">
        Your GPS lost signal, your fuel gauge hit empty, and this page doesn't exist.
        Three strikes.
      </p>
      <p className="text-muted-foreground/60 text-sm text-center max-w-xs mb-8">
        (Don't worry, it happens to the best of us — even at the drag strip.)
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={() => navigate("/")}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Home className="w-4 h-4" /> Back to Marketplace
        </Button>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="gap-2 border-border"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/search")}
          className="gap-2 text-muted-foreground"
        >
          <Search className="w-4 h-4" /> Search WhipGuides
        </Button>
      </div>

      {/* Easter egg */}
      <p className="mt-12 text-xs text-muted-foreground/40 text-center">
        Error code: VTEC_NOT_KICKED_IN_YO · Page last seen: never
      </p>
    </div>
  );
}
