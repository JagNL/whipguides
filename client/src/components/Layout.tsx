import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Bell, Sun, Moon, Menu, X,
  Gauge, Users, ChevronDown
} from "lucide-react";

// WhipGuides SVG Logo
function WhipGuidesLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-label="WhipGuides"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Wheel/tire outer ring */}
      <circle cx="20" cy="20" r="18" stroke="hsl(25 95% 53%)" strokeWidth="2.5" />
      {/* Hub */}
      <circle cx="20" cy="20" r="5" fill="hsl(25 95% 53%)" />
      {/* Spokes */}
      <line x1="20" y1="2" x2="20" y2="15" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="25" x2="20" y2="38" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="20" x2="15" y2="20" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="25" y1="20" x2="38" y2="20" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="5.4" y1="5.4" x2="14.6" y2="14.6" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="25.4" y1="25.4" x2="34.6" y2="34.6" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="34.6" y1="5.4" x2="25.4" y2="14.6" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
      <line x1="14.6" y1="25.4" x2="5.4" y2="34.6" stroke="hsl(25 95% 53%)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const categories = ["All", "Cars", "Trucks", "ATVs", "Jet Skis", "Motorcycles", "Boats", "Snowmobiles"];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, navigate] = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  const navLinks = [
    { href: "/", label: "Marketplace", icon: Gauge },
    { href: "/groups", label: "Groups", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-2">
            <WhipGuidesLogo size={32} />
            <span className="text-display text-lg font-extrabold tracking-tight hidden sm:block">
              Whip<span className="text-primary">Guides</span>
            </span>
          </Link>

          {/* Search bar */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search listings, groups..."
              className="pl-9 bg-secondary border-border h-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={location === href ? "text-primary bg-primary/10" : "text-muted-foreground"}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-theme-toggle"
              onClick={() => setDark(d => !d)}
              aria-label="Toggle theme"
              className="text-muted-foreground h-9 w-9"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground h-9 w-9 hidden sm:flex relative"
              data-testid="button-notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </Button>

            <Link href="/sell">
              <Button size="sm" className="gap-1.5 font-semibold" data-testid="button-sell">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">List Item</span>
              </Button>
            </Link>

            {/* Profile avatar */}
            <Link href="/profile/1">
              <button data-testid="button-profile" className="w-8 h-8 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-colors">
                <img src="https://i.pravatar.cc/150?img=11" alt="Profile" className="w-full h-full object-cover" />
              </button>
            </Link>

            {/* Mobile menu toggle */}
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(o => !o)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-2">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 bg-secondary" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2" data-testid={`mobile-nav-${label.toLowerCase()}`}>
                  <Icon className="w-4 h-4" /> {label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="min-h-[calc(100vh-4rem)]">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <WhipGuidesLogo size={24} />
            <span className="font-bold text-sm">WhipGuides</span>
            <span className="text-muted-foreground text-xs">© 2026</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Safety</a>
            <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              Created with Perplexity Computer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
