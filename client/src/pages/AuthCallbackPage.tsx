/**
 * OAuth callback page — Supabase redirects here after Google/Facebook/Apple login.
 * Exchanges the token, creates a WhipGuides profile if needed, then redirects home.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const { handleOAuthCallback } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    handleOAuthCallback().then(success => {
      if (success) {
        navigate("/");
      } else {
        setStatus("error");
        setTimeout(() => navigate("/"), 3000);
      }
    });
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="font-semibold text-destructive">Sign in failed</p>
        <p className="text-sm text-muted-foreground">Redirecting you back...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
}
