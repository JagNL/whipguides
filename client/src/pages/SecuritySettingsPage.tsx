import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShieldCheck, Key, Monitor, Info, Loader2, Lock, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MFASetup } from "@/components/MFASetup";

// ─── Schemas ──────────────────────────────────────────────────
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ChangePasswordData = z.infer<typeof changePasswordSchema>;

// ─── Section wrapper ──────────────────────────────────────────
function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

// ─── Password section ─────────────────────────────────────────
function PasswordSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (_data: ChangePasswordData) => {
    // API endpoint not yet implemented — show coming soon
    await new Promise(r => setTimeout(r, 400));
    toast({
      title: "Coming soon",
      description: "Password change will be available in a future update.",
    });
    setOpen(false);
    form.reset();
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Email address</p>
          <p className="text-sm font-medium mt-0.5">{user?.username ?? "—"}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          data-testid="button-change-password"
          className="shrink-0"
        >
          <Key className="w-4 h-4 mr-1.5" />
          Change Password
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one.
          </DialogDescription>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <FormField control={form.control} name="currentPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showCurrent ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="pl-8 pr-9 h-9 text-sm"
                        data-testid="input-current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showNew ? "text" : "password"}
                        placeholder="Min 8 characters"
                        autoComplete="new-password"
                        className="pl-8 pr-9 h-9 text-sm"
                        data-testid="input-new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Confirm New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                        className="pl-8 pr-9 h-9 text-sm"
                        data-testid="input-confirm-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setOpen(false); form.reset(); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={form.formState.isSubmitting}
                  data-testid="button-submit-change-password"
                >
                  {form.formState.isSubmitting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : "Update Password"
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Active Sessions section ──────────────────────────────────
function SessionsSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSignOutAll = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    toast({
      title: "Coming soon",
      description: "Sign out all devices will be available in a future update.",
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-sm font-medium">Other devices</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sign out of all other active sessions.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOutAll}
        disabled={loading}
        data-testid="button-signout-all"
        className="shrink-0"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Monitor className="w-4 h-4 mr-1.5" />}
        Sign Out All Devices
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function SecuritySettingsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Account Security</h1>
          <p className="text-sm text-muted-foreground">Manage your password, 2FA, and sessions</p>
        </div>
      </div>

      {/* Password section */}
      <Section
        icon={Key}
        title="Password"
        description="Keep your account secure with a strong password."
      >
        <PasswordSection />
      </Section>

      {/* Two-Factor Authentication */}
      <Section
        icon={ShieldCheck}
        title="Two-Factor Authentication"
        description="Add an extra layer of protection when signing in."
      >
        <MFASetup />
      </Section>

      {/* Active Sessions */}
      <Section
        icon={Monitor}
        title="Active Sessions"
        description="Control where you're currently signed in."
      >
        <SessionsSection />
      </Section>

      {/* Account Activity */}
      <Section
        icon={Info}
        title="Account Activity"
      >
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            WhipGuides uses industry-standard JWT authentication. Your session expires after 1 hour
            and auto-refreshes while you're active.
          </p>
        </div>
      </Section>
    </div>
  );
}
