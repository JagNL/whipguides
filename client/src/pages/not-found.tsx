import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

// Polar → cartesian helper
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// SVG arc string between two angles on a circle
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

const CX = 100, CY = 100;
const START_DEG = -135; // left side of arc
const END_DEG   =  135; // right side of arc (270° sweep = full semicircle + a bit)
const NEEDLE_DEG = END_DEG; // needle pegged to max = 135°

export default function NotFound() {
  const [, navigate] = useLocation();

  // Tick positions: 7 evenly spaced ticks from START to END
  const ticks = Array.from({ length: 7 }, (_, i) => {
    const deg = START_DEG + (i / 6) * (END_DEG - START_DEG);
    return { deg, major: i === 0 || i === 6 };
  });

  const needleEnd = polar(CX, CY, 70, NEEDLE_DEG);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background text-foreground select-none">

      {/* Speedometer */}
      <div className="w-52 h-52 mb-8">
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">

          {/* Outer bezel ring */}
          <circle cx={CX} cy={CY} r={88} fill="none" stroke="hsl(var(--border))" strokeWidth="2" />

          {/* Track (grey arc) */}
          <path
            d={arcPath(CX, CY, 72, START_DEG, END_DEG)}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Fill (orange arc — fully pegged at max) */}
          <path
            d={arcPath(CX, CY, 72, START_DEG, END_DEG)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="10"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.8))" }}
          />

          {/* Tick marks */}
          {ticks.map(({ deg, major }, i) => {
            const outer = polar(CX, CY, 84, deg);
            const inner = polar(CX, CY, major ? 74 : 78, deg);
            return (
              <line
                key={i}
                x1={outer.x} y1={outer.y}
                x2={inner.x} y2={inner.y}
                stroke={major ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
                strokeWidth={major ? 2.5 : 1.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Needle */}
          <line
            x1={CX} y1={CY}
            x2={needleEnd.x} y2={needleEnd.y}
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.6))" }}
          />

          {/* Center pivot */}
          <circle cx={CX} cy={CY} r={7} fill="hsl(var(--primary))" />
          <circle cx={CX} cy={CY} r={3} fill="white" />

          {/* RPM label */}
          <text
            x={CX} y={CY + 22}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="1"
          >RPM × 1000</text>

        </svg>
      </div>

      {/* "404" big text — separate from SVG for crisp rendering */}
      <div className="-mt-16 mb-6">
        <span
          className="text-5xl font-black text-primary"
          style={{
            fontFamily: "monospace",
            letterSpacing: "-2px",
            textShadow: "0 0 20px hsl(var(--primary) / 0.5)",
          }}
        >
          404
        </span>
      </div>

      {/* Copy */}
      <h1 className="text-3xl font-black mb-3 text-center">
        Redlined into nowhere.
      </h1>
      <p className="text-muted-foreground text-center max-w-sm mb-2 leading-relaxed">
        Your GPS lost signal, your fuel gauge hit empty,
        and this page doesn't exist. Three strikes.
      </p>
      <p className="text-muted-foreground/50 text-sm text-center max-w-xs mb-10">
        (Don't worry — it happens to the best of us. Even at the drag strip.)
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
      <p className="mt-14 text-xs text-muted-foreground/30 text-center font-mono">
        ERROR: VTEC_NOT_KICKED_IN_YO · PAGE_LAST_SEEN: never
      </p>
    </div>
  );
}
