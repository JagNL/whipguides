import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mail, Lock, User, AtSign } from "lucide-react";
import { SiGoogle, SiFacebook, SiApple } from "react-icons/si";

// ─── Schemas ─────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be 20 characters or less")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

// ─── Social button ────────────────────────────────────────────
function SocialButton({ provider, label, icon: Icon, onClick, loading }: {
  provider: string; label: string; icon: React.ElementType;
  onClick: () => void; loading: boolean;
}) {
  return (
    <Button type="button" variant="outline" className="w-full gap-2.5 font-medium h-10"
      onClick={onClick} disabled={loading} data-testid={`button-oauth-${provider}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </Button>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Login form — own component so useForm is isolated ────────
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginData) => {
    try {
      await login(data.email, data.password);
      toast({ title: "Welcome back!" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Email</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  data-testid="input-login-email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="pl-8 h-9 text-sm"
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Password</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  data-testid="input-login-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-8 h-9 text-sm"
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" className="w-full font-bold h-9"
          disabled={form.formState.isSubmitting} data-testid="button-login-submit">
          {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
        </Button>
      </form>
    </Form>
  );
}

// ─── Register form — own component so useForm is isolated ─────
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { register } = useAuth();
  const { toast } = useToast();

  const form = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", username: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      await register(data.email, data.password, data.username, data.displayName);
      toast({ title: "Welcome to WhipGuides!", description: "Your account is ready." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <FormField control={form.control} name="displayName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Full Name</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    data-testid="input-register-name"
                    placeholder="John Doe"
                    autoComplete="name"
                    className="pl-8 h-9 text-sm"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    data-testid="input-register-username"
                    placeholder="ridernation"
                    autoComplete="username"
                    className="pl-8 h-9 text-sm"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Email</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  data-testid="input-register-email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="pl-8 h-9 text-sm"
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-2.5">
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    data-testid="input-register-password"
                    type="password"
                    placeholder="Min 8 chars"
                    autoComplete="new-password"
                    className="pl-8 h-9 text-sm"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="confirmPassword" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Confirm</FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    data-testid="input-register-confirm"
                    type="password"
                    placeholder="Repeat"
                    autoComplete="new-password"
                    className="pl-8 h-9 text-sm"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <Button type="submit" className="w-full font-bold h-9"
          disabled={form.formState.isSubmitting} data-testid="button-register-submit">
          {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}

// ─── Main Modal ──────────────────────────────────────────────
interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { loginWithOAuth } = useAuth();
  const { toast } = useToast();

  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
    else setMode(defaultMode);
  };

  const handleOAuth = async (provider: "google" | "facebook" | "apple") => {
    try {
      setOauthLoading(provider);
      await loginWithOAuth(provider);
    } catch (err: any) {
      toast({ title: `${provider} sign in failed`, description: err.message, variant: "destructive" });
      setOauthLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <DialogTitle className="sr-only">
          {mode === "login" ? "Sign in to WhipGuides" : "Create your WhipGuides account"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {mode === "login" ? "Enter your credentials to sign in" : "Fill in the form to create a free account"}
        </DialogDescription>
        <div className="p-6">
          {/* Logo */}
          <div className="text-center mb-5">
            <h2 className="text-display text-xl font-extrabold tracking-tight">
              Whip<span className="text-primary">Guides</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" ? "Sign in to your account" : "Create your free account"}
            </p>
          </div>

          {/* Mode toggle pill */}
          <div className="flex bg-secondary rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              data-testid="tab-signin"
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              data-testid="tab-register"
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Social buttons */}
          <div className="space-y-2.5 mb-1">
            <SocialButton provider="google" label="Continue with Google" icon={SiGoogle}
              onClick={() => handleOAuth("google")} loading={oauthLoading === "google"} />
            <SocialButton provider="facebook" label="Continue with Facebook" icon={SiFacebook}
              onClick={() => handleOAuth("facebook")} loading={oauthLoading === "facebook"} />
            <SocialButton provider="apple" label="Continue with Apple" icon={SiApple}
              onClick={() => handleOAuth("apple")} loading={oauthLoading === "apple"} />
          </div>

          <OrDivider />

          {/* Only mount the active form — prevents field ID collisions */}
          {mode === "login"
            ? <LoginForm onSuccess={onClose} />
            : <RegisterForm onSuccess={onClose} />
          }

          <p className="text-center text-xs text-muted-foreground mt-4">
            By continuing, you agree to WhipGuides'{" "}
            <a href="#" className="underline hover:text-foreground">Terms</a> and{" "}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
