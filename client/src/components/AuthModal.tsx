import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

// ─── Social button ────────────────────────────────────────────
function SocialButton({
  provider, label, icon: Icon, onClick, loading,
}: {
  provider: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2.5 font-medium h-10"
      onClick={onClick}
      disabled={loading}
      data-testid={`button-oauth-${provider}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </Button>
  );
}

// ─── Divider ──────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium">or</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────
export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { login, register, loginWithOAuth } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", username: "", email: "", password: "", confirmPassword: "" },
  });

  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
  };

  const handleOAuth = async (provider: "google" | "facebook" | "apple") => {
    try {
      setOauthLoading(provider);
      await loginWithOAuth(provider);
      // Page will redirect to provider — no need to close modal
    } catch (err: any) {
      toast({ title: `${provider} sign in failed`, description: err.message, variant: "destructive" });
      setOauthLoading(null);
    }
  };

  const onLoginSubmit = async (data: LoginData) => {
    try {
      await login(data.email, data.password);
      toast({ title: "Welcome back!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    }
  };

  const onRegisterSubmit = async (data: RegisterData) => {
    try {
      await register(data.email, data.password, data.username, data.displayName);
      toast({ title: "Welcome to WhipGuides!", description: "Your account is ready." });
      onClose();
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-6">
          {/* Logo + headline */}
          <div className="text-center mb-5">
            <h2 className="text-display text-xl font-extrabold tracking-tight">
              Whip<span className="text-primary">Guides</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Sign in to your account"
                : "Create your free account"}
            </p>
          </div>

          {/* Mode toggle pill */}
          <div className="flex bg-secondary rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                mode === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-signin"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                mode === "register"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-register"
            >
              Create Account
            </button>
          </div>

          {/* Social buttons */}
          <div className="space-y-2.5 mb-4">
            <SocialButton
              provider="google"
              label="Continue with Google"
              icon={SiGoogle}
              onClick={() => handleOAuth("google")}
              loading={oauthLoading === "google"}
            />
            <SocialButton
              provider="facebook"
              label="Continue with Facebook"
              icon={SiFacebook}
              onClick={() => handleOAuth("facebook")}
              loading={oauthLoading === "facebook"}
            />
            <SocialButton
              provider="apple"
              label="Continue with Apple"
              icon={SiApple}
              onClick={() => handleOAuth("apple")}
              loading={oauthLoading === "apple"}
            />
          </div>

          <OrDivider />

          {/* Email/password forms */}
          {mode === "login" ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-3 mt-3">
                <FormField control={loginForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input data-testid="input-login-email" placeholder="you@example.com" className="pl-8 h-9 text-sm" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={loginForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input data-testid="input-login-password" type="password" placeholder="••••••••" className="pl-8 h-9 text-sm" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button
                  type="submit"
                  className="w-full font-bold h-9"
                  disabled={loginForm.formState.isSubmitting}
                  data-testid="button-login-submit"
                >
                  {loginForm.formState.isSubmitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : "Sign In"}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField control={registerForm.control} name="displayName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Full Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input data-testid="input-register-name" placeholder="John Doe" className="pl-8 h-9 text-sm" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={registerForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input data-testid="input-register-username" placeholder="ridernation" className="pl-8 h-9 text-sm" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={registerForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input data-testid="input-register-email" placeholder="you@example.com" className="pl-8 h-9 text-sm" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-2.5">
                  <FormField control={registerForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input data-testid="input-register-password" type="password" placeholder="Min 8 chars" className="pl-8 h-9 text-sm" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={registerForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Confirm</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input data-testid="input-register-confirm" type="password" placeholder="Repeat" className="pl-8 h-9 text-sm" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button
                  type="submit"
                  className="w-full font-bold h-9"
                  disabled={registerForm.formState.isSubmitting}
                  data-testid="button-register-submit"
                >
                  {registerForm.formState.isSubmitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : "Create Account"}
                </Button>
              </form>
            </Form>
          )}

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
