import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mail, Lock, User, AtSign } from "lucide-react";

// ─── Schemas ─────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
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

// ─── Props ───────────────────────────────────────────────────
interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
}

// ─── Login Form ──────────────────────────────────────────────
function LoginForm({ onSwitch, onSuccess }: { onSwitch: () => void; onSuccess: () => void }) {
  const { login } = useAuth();
  const { toast } = useToast();

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginData) => {
    try {
      await login(data.email, data.password);
      toast({ title: "Welcome back!", description: "You're now signed in." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-login-email" placeholder="you@example.com" className="pl-9" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-login-password" type="password" placeholder="••••••••" className="pl-9" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button
          type="submit"
          className="w-full font-bold"
          disabled={form.formState.isSubmitting}
          data-testid="button-login-submit"
        >
          {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Sign In
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <button type="button" onClick={onSwitch} className="text-primary font-semibold hover:underline">
            Create one
          </button>
        </p>
      </form>
    </Form>
  );
}

// ─── Register Form ───────────────────────────────────────────
function RegisterForm({ onSwitch, onSuccess }: { onSwitch: () => void; onSuccess: () => void }) {
  const { register } = useAuth();
  const { toast } = useToast();

  const form = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", username: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      await register(data.email, data.password, data.username, data.displayName);
      toast({ title: "Account created!", description: "Welcome to WhipGuides." });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="displayName" render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input data-testid="input-register-name" placeholder="John Doe" className="pl-9" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="username" render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input data-testid="input-register-username" placeholder="ridernation" className="pl-9" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-register-email" placeholder="you@example.com" className="pl-9" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-register-password" type="password" placeholder="Min 8 characters" className="pl-9" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm Password</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input data-testid="input-register-confirm" type="password" placeholder="Repeat password" className="pl-9" {...field} />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button
          type="submit"
          className="w-full font-bold"
          disabled={form.formState.isSubmitting}
          data-testid="button-register-submit"
        >
          {form.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button type="button" onClick={onSwitch} className="text-primary font-semibold hover:underline">
            Sign in
          </button>
        </p>
      </form>
    </Form>
  );
}

// ─── Main Modal ──────────────────────────────────────────────
export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);

  // Reset to defaultMode when reopened
  const handleOpenChange = (o: boolean) => {
    if (!o) onClose();
    else setMode(defaultMode);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-extrabold">
            {mode === "login" ? "Sign In to WhipGuides" : "Join WhipGuides"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "The motorsports marketplace for real buyers and sellers."
              : "Create your free account and start buying, selling, and connecting."}
          </p>
        </DialogHeader>

        <div className="mt-2">
          {mode === "login" ? (
            <LoginForm
              onSwitch={() => setMode("register")}
              onSuccess={onClose}
            />
          ) : (
            <RegisterForm
              onSwitch={() => setMode("login")}
              onSuccess={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
