import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Plus, Sun, Moon, Menu, X,
  Gauge, Users, LogOut, User, MessageSquare,
  ShieldCheck, ChevronDown, Shield, BookOpen, Megaphone, Rss, Tag, Building2,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/AuthModal";
import { useToast } from "@/hooks/use-toast";

// ─── Logo ────────────────────────────────────────────────────
function WhipGuidesLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none"
      aria-label="WhipGuides" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" stroke="hsl(25 95% 53%)" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="hsl(25 95% 53%)" />
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

const navLinks = [
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/", label: "Marketplace", icon: Gauge },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/business", label: "Businesses", icon: Building2 },
  { href: "/guides", label: "Guides", icon: BookOpen },
  { href: "/advertise", label: "Advertise", icon: Megaphone },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  const openLogin = () => { setAuthMode("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthMode("register"); setAuthOpen(true); };

  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast({ title: "Signed out", description: "See you next time." });
  };

  // Guard for protected routes
  const handleProtectedClick = (e: React.MouseEvent, href: string) => {
    if (!isAuthenticated) {
      e.preventDefault();
      openLogin();
    } else {
      navigate(href);
    }
  };

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

          {/* Search */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search everything..."
              className="pl-9 bg-secondary border-border h-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  window.location.href = `${window.location.pathname}#/search?q=${encodeURIComponent(searchQuery.trim())}`;
                  setSearchQuery("");
                }
              }}
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
            {/* Theme toggle */}
            <Button
              size="icon" variant="ghost"
              data-testid="button-theme-toggle"
              onClick={() => setDark(d => !d)}
              aria-label="Toggle theme"
              className="text-muted-foreground h-9 w-9"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Messages (auth-gated) */}
            {isAuthenticated && (
              <Link href="/messages">
                <Button size="icon" variant="ghost"
                  className="text-muted-foreground h-9 w-9 hidden sm:flex"
                  data-testid="button-messages">
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </Link>
            )}

            {/* Notifications */}
            {isAuthenticated && (
              <div className="hidden sm:flex">
                <NotificationBell />
              </div>
            )}

            {/* List Item button */}
            <Button
              size="sm"
              className="gap-1.5 font-semibold"
              data-testid="button-sell"
              onClick={e => handleProtectedClick(e as any, "/sell")}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">List Item</span>
            </Button>

            {/* Auth: logged out */}
            {!isLoading && !isAuthenticated && (
              <Button size="sm" onClick={openLogin} data-testid="button-login" className="hidden sm:flex font-semibold">
                Sign In
              </Button>
            )}

            {/* Auth: logged in — user menu */}
            {!isLoading && isAuthenticated && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="button-profile-menu"
                    className="flex items-center gap-1.5 rounded-full hover:ring-2 hover:ring-primary/40 transition-all outline-none"
                  >
                    <Avatar className="w-8 h-8 border-2 border-border">
                      <AvatarImage src={user.avatar ?? undefined} />
                      <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">
                        {user.displayName?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="font-semibold text-sm">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    {user.verified && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3" /> Verified Seller
                      </p>
                    )}
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${user.id}`} className="flex items-center gap-2 cursor-pointer">
                      <User className="w-4 h-4" /> My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="flex items-center gap-2 cursor-pointer">
                      <MessageSquare className="w-4 h-4" /> Messages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/sell" className="flex items-center gap-2 cursor-pointer">
                      <Plus className="w-4 h-4" /> List an Item
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/my-listings" className="flex items-center gap-2 cursor-pointer">
                      <Tag className="w-4 h-4" /> My Listings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/business/new" className="flex items-center gap-2 cursor-pointer">
                      <Building2 className="w-4 h-4" /> My Business Page
                    </Link>
                  </DropdownMenuItem>
                  {/* Admin link — shown if user has admin role */}
                  {((user as any)?.siteRole === 'site_admin' || (user as any)?.siteRole === 'super_admin') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer text-primary">
                          <Shield className="w-4 h-4" /> Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                    data-testid="button-logout"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile menu toggle */}
            <Button
              size="icon" variant="ghost"
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
              <Input placeholder="Search everything..." className="pl-9 bg-secondary"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    window.location.href = `${window.location.pathname}#/search?q=${encodeURIComponent(searchQuery.trim())}`; setSearchQuery(""); setMobileMenuOpen(false);
                  }
                }}
              />
            </div>
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2"
                  data-testid={`mobile-nav-${label.toLowerCase()}`}>
                  <Icon className="w-4 h-4" /> {label}
                </Button>
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link href={`/profile/${user?.id}`} onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <User className="w-4 h-4" /> My Profile
                  </Button>
                </Link>
                <Link href="/messages" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <MessageSquare className="w-4 h-4" /> Messages
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full justify-start gap-2 text-destructive"
                  onClick={handleLogout}>
                  <LogOut className="w-4 h-4" /> Sign Out
                </Button>
              </>
            ) : (
              <Button className="w-full mt-1 font-semibold" onClick={() => { openLogin(); setMobileMenuOpen(false); }}>
                Sign In
              </Button>
            )}
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

          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />
    </div>
  );
}
