import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Lock, Loader2, LogOut } from "lucide-react";
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

interface Props {
  open: boolean;
  onVerified: (newSession?: any) => void;
  onCancel: () => void;
}

// ─── MFAChallenge ─────────────────────────────────────────────
export function MFAChallenge({ open, onVerified, onCancel }: Props) {
  const [otpValue, setOtpValue] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  // ── Query: MFA status ──────────────────────────────────────
  const { data: mfaStatus, isLoading } = useQuery<MFAStatus>({
    queryKey: ["mfa/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/mfa/status", undefined);
      return res.json();
    },
    enabled: open,
  });

  // Auto-select first TOTP factor
  useEffect(() => {
    if (mfaStatus?.factors.totp.length && !selectedFactorId) {
      setSelectedFactorId(mfaStatus.factors.totp[0].id);
    }
  }, [mfaStatus, selectedFactorId]);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setOtpValue("");
      setError("");
      setShake(false);
      setShowMethodPicker(false);
    }
  }, [open]);

  // ── Mutation: challenge + verify ───────────────────────────
  const verifyMutation = useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      // Step 1: get a challenge
      const challengeRes = await apiRequest("POST", "/api/auth/mfa/challenge", { factorId });
      const challengeData = await challengeRes.json();
      if (challengeData.error) throw new Error(challengeData.error);
      const challengeId = challengeData.id ?? challengeData.challengeId;

      // Step 2: verify
      const verifyRes = await apiRequest("POST", "/api/auth/mfa/verify", {
        factorId,
        challengeId,
        code,
      });
      const verifyData = await verifyRes.json();
      if (verifyData.error) throw new Error(verifyData.error);
      return verifyData;
    },
    onSuccess: (data) => {
      onVerified(data.session);
    },
    onError: (err: any) => {
      setError(err.message || "Incorrect code. Try again.");
      setOtpValue("");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    },
  });

  const handleOtpChange = (val: string) => {
    setOtpValue(val);
    setError("");
    if (val.length === 6 && selectedFactorId) {
      verifyMutation.mutate({ factorId: selectedFactorId, code: val });
    }
  };

  const totpFactors = mfaStatus?.factors.totp ?? [];
  const webauthnFactors = mfaStatus?.factors.webauthn ?? [];
  const allFactors = [...totpFactors, ...webauthnFactors];
  const hasMultipleMethods = allFactors.length > 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="sm:max-w-sm p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        data-testid="mfa-challenge-dialog"
      >
        <DialogTitle className="sr-only">Two-Factor Authentication</DialogTitle>
        <DialogDescription className="sr-only">
          Enter the 6-digit code from your authenticator app to continue
        </DialogDescription>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Two-Factor Authentication</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* OTP Input */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className={cn(
                    "transition-transform",
                    shake && "animate-[shake_0.5s_ease-in-out]"
                  )}
                  style={shake ? {
                    animation: "shake 0.5s ease-in-out",
                  } : undefined}
                >
                  <style>{`
                    @keyframes shake {
                      0%, 100% { transform: translateX(0); }
                      15% { transform: translateX(-6px); }
                      30% { transform: translateX(6px); }
                      45% { transform: translateX(-5px); }
                      60% { transform: translateX(5px); }
                      75% { transform: translateX(-3px); }
                      90% { transform: translateX(3px); }
                    }
                  `}</style>
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={handleOtpChange}
                    disabled={verifyMutation.isPending}
                    autoFocus
                    data-testid="input-mfa-challenge-otp"
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
                </div>

                {verifyMutation.isPending && (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                )}

                {error && (
                  <p
                    className="text-sm text-destructive text-center"
                    data-testid="mfa-challenge-error"
                  >
                    {error}
                  </p>
                )}
              </div>

              {/* Method picker */}
              {hasMultipleMethods && (
                <div className="text-center">
                  {showMethodPicker ? (
                    <div className="space-y-2 mt-1">
                      <p className="text-xs text-muted-foreground font-medium">Choose a method:</p>
                      {allFactors.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          data-testid={`button-select-factor-${f.id}`}
                          className={cn(
                            "w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                            selectedFactorId === f.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40"
                          )}
                          onClick={() => {
                            setSelectedFactorId(f.id);
                            setShowMethodPicker(false);
                            setOtpValue("");
                            setError("");
                          }}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                      data-testid="button-use-different-method"
                      onClick={() => setShowMethodPicker(true)}
                    >
                      Use a different method
                    </button>
                  )}
                </div>
              )}

              {/* Sign out link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5 mx-auto"
                  data-testid="button-mfa-signout"
                  onClick={onCancel}
                >
                  <LogOut className="w-3 h-3" />
                  Sign out instead
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
