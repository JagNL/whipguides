import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Smartphone, Fingerprint, Copy, Check, Loader2,
  ShieldCheck, Plus, Trash2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface MFAFactor {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

interface MFAStatus {
  mfaEnabled: boolean;
  hasVerifiedFactor: boolean;
  factors: {
    totp: MFAFactor[];
    webauthn: MFAFactor[];
  };
}

type View =
  | "options"
  | "totp-qr"
  | "totp-verify"
  | "totp-success"
  | "passkey";

// ─── Helper: copy to clipboard ────────────────────────────────
function CopyableSecret({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 mt-2">
      <code className="text-xs font-mono text-foreground flex-1 break-all select-all">{secret}</code>
      <button
        type="button"
        onClick={copy}
        data-testid="button-copy-secret"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy secret"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Factor row ───────────────────────────────────────────────
function FactorRow({ factor, type, onRemove }: {
  factor: MFAFactor;
  type: "totp" | "webauthn";
  onRemove: (id: string) => void;
}) {
  const Icon = type === "totp" ? Smartphone : Fingerprint;
  const date = new Date(factor.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{factor.name}</p>
        <p className="text-xs text-muted-foreground">Added {date}</p>
      </div>
      <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
        Active
      </span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            data-testid={`button-remove-factor-${factor.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this factor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{factor.name}</strong> from your account.
              If it's your only 2FA method, your account will no longer require two-factor authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRemove(factor.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`button-confirm-remove-${factor.id}`}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
interface Props {
  onClose?: () => void;
}

export function MFASetup({ onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<View>("options");
  const [enrollData, setEnrollData] = useState<{
    id: string;
    totp?: { qr_code: string; secret: string; uri: string };
  } | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [showEnrollOptions, setShowEnrollOptions] = useState(false);

  // ── Query: MFA status ──────────────────────────────────────
  const { data: mfaStatus, isLoading } = useQuery<MFAStatus>({
    queryKey: ["mfa/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/mfa/status", undefined);
      return res.json();
    },
  });

  const isSuperAdmin = (user as any)?.siteRole === "super_admin";
  const hasFactors =
    (mfaStatus?.factors.totp.length ?? 0) > 0 ||
    (mfaStatus?.factors.webauthn.length ?? 0) > 0;

  // ── Mutation: enroll ───────────────────────────────────────
  const enrollMutation = useMutation({
    mutationFn: async (payload: { factorType: string; friendlyName?: string }) => {
      const res = await apiRequest("POST", "/api/auth/mfa/enroll", payload);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      setEnrollData(data);
      if (variables.factorType === "totp") {
        setView("totp-qr");
      } else {
        setView("passkey");
      }
    },
    onError: (err: any) => {
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Mutation: verify ───────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/mfa/verify", { factorId, code });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfa/status"] });
      setView("totp-success");
      setOtpValue("");
      setOtpError("");
      setShowEnrollOptions(false);
    },
    onError: (err: any) => {
      setOtpError(err.message || "Invalid code, try again");
      setOtpValue("");
    },
  });

  // ── Mutation: remove factor ────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: async (factorId: string) => {
      const res = await apiRequest("DELETE", `/api/auth/mfa/factors/${factorId}`, undefined);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfa/status"] });
      toast({ title: "Factor removed", description: "2FA method has been removed from your account." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    },
  });

  // ── OTP auto-submit ────────────────────────────────────────
  const handleOtpChange = (val: string) => {
    setOtpValue(val);
    setOtpError("");
    if (val.length === 6 && enrollData?.id) {
      verifyMutation.mutate({ factorId: enrollData.id, code: val });
    }
  };

  // ── Views ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // After success — shown briefly
  if (view === "totp-success") {
    return (
      <div className="text-center py-8 space-y-4" data-testid="mfa-totp-success">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Authenticator set up!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your account is now protected with two-factor authentication.
          </p>
        </div>
        <Button
          onClick={() => setView("options")}
          data-testid="button-mfa-success-done"
          className="mt-2"
        >
          Done
        </Button>
      </div>
    );
  }

  // TOTP QR Code step
  if (view === "totp-qr" && enrollData?.totp) {
    return (
      <div className="space-y-5" data-testid="mfa-totp-qr">
        <div>
          <h3 className="text-base font-semibold">Scan QR Code</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Scan this QR code with your authenticator app. Can't scan? Enter the code manually.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-xl inline-block">
            <img
              src={enrollData.totp.qr_code}
              alt="TOTP QR Code"
              className="w-48 h-48"
              data-testid="img-totp-qr"
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Manual entry code
          </p>
          <CopyableSecret secret={enrollData.totp.secret} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => { setView("options"); setEnrollData(null); }}
            data-testid="button-totp-qr-back"
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={() => setView("totp-verify")}
            data-testid="button-totp-qr-next"
            className="flex-1"
          >
            I've scanned it
          </Button>
        </div>
      </div>
    );
  }

  // TOTP Verify step
  if (view === "totp-verify") {
    return (
      <div className="space-y-5" data-testid="mfa-totp-verify">
        <div>
          <h3 className="text-base font-semibold">Enter verification code</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the 6-digit code shown in your authenticator app to confirm setup.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <InputOTP
            maxLength={6}
            value={otpValue}
            onChange={handleOtpChange}
            disabled={verifyMutation.isPending}
            data-testid="input-totp-verify"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          {otpError && (
            <p className="text-sm text-destructive" data-testid="mfa-totp-error">{otpError}</p>
          )}

          {verifyMutation.isPending && (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { setView("totp-qr"); setOtpValue(""); setOtpError(""); }}
            data-testid="button-totp-verify-back"
            className="flex-1"
            disabled={verifyMutation.isPending}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              if (otpValue.length === 6 && enrollData?.id) {
                verifyMutation.mutate({ factorId: enrollData.id, code: otpValue });
              }
            }}
            data-testid="button-totp-verify-submit"
            className="flex-1"
            disabled={otpValue.length !== 6 || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
          </Button>
        </div>
      </div>
    );
  }

  // Passkey view
  if (view === "passkey") {
    const supported = typeof navigator !== "undefined" && !!navigator.credentials;
    return (
      <div className="space-y-5" data-testid="mfa-passkey">
        <div>
          <h3 className="text-base font-semibold">Set up a Passkey</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Use Face ID, Touch ID, or a hardware security key to sign in.
          </p>
        </div>

        {!supported ? (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
            Your browser doesn't support passkeys. Use an authenticator app instead.
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-secondary border border-border space-y-3">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-8 h-8 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Coming Soon</p>
                <p className="text-xs text-muted-foreground">
                  Passkey enrollment requires additional backend support for WebAuthn challenge generation.
                  Use an authenticator app for now — it's equally secure.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={() => { setView("options"); setEnrollData(null); }}
          data-testid="button-passkey-back"
          className="w-full"
        >
          Back
        </Button>
      </div>
    );
  }

  // ── Management view (has factors) ─────────────────────────
  if (hasFactors && !showEnrollOptions) {
    const allFactors = [
      ...mfaStatus!.factors.totp.map(f => ({ factor: f, type: "totp" as const })),
      ...mfaStatus!.factors.webauthn.map(f => ({ factor: f, type: "webauthn" as const })),
    ];

    return (
      <div className="space-y-5" data-testid="mfa-management">
        {/* Protected banner */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm font-medium text-green-400">
            Your account is protected with 2-factor authentication
          </p>
        </div>

        {/* Super admin not enrolled warning (shouldn't appear if hasFactors, but just in case) */}
        {isSuperAdmin && !mfaStatus?.mfaEnabled && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-400">
              ⚠️ Super admin accounts should have 2FA enabled for security. Set it up now.
            </p>
          </div>
        )}

        {/* Factor list */}
        <div className="space-y-2">
          {allFactors.map(({ factor, type }) => (
            <FactorRow
              key={factor.id}
              factor={factor}
              type={type}
              onRemove={(id) => removeMutation.mutate(id)}
            />
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowEnrollOptions(true)}
          data-testid="button-add-another-method"
        >
          <Plus className="w-4 h-4" /> Add Another Method
        </Button>
      </div>
    );
  }

  // ── Enrollment options (no factors, or "Add Another") ─────
  return (
    <div className="space-y-5" data-testid="mfa-options">
      {/* Super admin warning banner */}
      {isSuperAdmin && !hasFactors && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-400">
            ⚠️ Super admin accounts should have 2FA enabled for security. Set it up now.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-base font-semibold">Choose a method</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add an extra layer of security to your account.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* TOTP Card */}
        <div
          className="relative p-4 rounded-xl border border-border bg-secondary hover:border-primary/40 transition-colors flex flex-col gap-3"
          data-testid="card-totp"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Authenticator App</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use Google Authenticator, Authy, 1Password, or any TOTP app
            </p>
          </div>
          <Button
            size="sm"
            className="w-full mt-1"
            data-testid="button-setup-totp"
            disabled={enrollMutation.isPending}
            onClick={() =>
              enrollMutation.mutate({ factorType: "totp", friendlyName: "Authenticator App" })
            }
          >
            {enrollMutation.isPending && enrollMutation.variables?.factorType === "totp"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : "Set Up"
            }
          </Button>
        </div>

        {/* Passkey Card */}
        <div
          className="relative p-4 rounded-xl border border-border bg-secondary hover:border-primary/40 transition-colors flex flex-col gap-3"
          data-testid="card-passkey"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
              Most Secure
            </span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Passkey</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use Face ID, Touch ID, or a hardware security key
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-1"
            data-testid="button-setup-passkey"
            disabled={enrollMutation.isPending}
            onClick={() => enrollMutation.mutate({ factorType: "webauthn" })}
          >
            {enrollMutation.isPending && enrollMutation.variables?.factorType === "webauthn"
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : "Set Up"
            }
          </Button>
        </div>
      </div>

      {showEnrollOptions && (
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => setShowEnrollOptions(false)}
          data-testid="button-cancel-add-method"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
