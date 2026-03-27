/**
 * ReportButton — reusable flag button for listings, posts, and profiles.
 * Opens a modal with reason selection and optional description.
 */
import { useState } from "react";
import { Flag } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASONS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  listing: [
    { value: "scam", label: "Scam or fraud" },
    { value: "prohibited", label: "Prohibited item" },
    { value: "stolen", label: "Stolen goods" },
    { value: "misleading", label: "Misleading description" },
    { value: "spam", label: "Spam / duplicate" },
    { value: "wrong_category", label: "Wrong category" },
    { value: "other", label: "Other" },
  ],
  post: [
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Harassment or bullying" },
    { value: "hate_speech", label: "Hate speech" },
    { value: "misinformation", label: "Misinformation" },
    { value: "off_topic", label: "Off-topic" },
    { value: "other", label: "Other" },
  ],
  user: [
    { value: "harassment", label: "Harassment" },
    { value: "impersonation", label: "Impersonation" },
    { value: "scam", label: "Scam account" },
    { value: "fake_profile", label: "Fake profile" },
    { value: "other", label: "Other" },
  ],
};

interface ReportButtonProps {
  targetType: "listing" | "post" | "user";
  targetId: number;
  className?: string;
  iconOnly?: boolean;
}

export default function ReportButton({ targetType, targetId, className, iconOnly }: ReportButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reasons = REASONS_BY_TYPE[targetType] || REASONS_BY_TYPE.listing;

  const reportMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/reports", {
        targetType,
        targetId,
        reason: selectedReason,
        description: description.trim() || null,
      }).then(r => r.json()),
    onSuccess: () => {
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setSelectedReason("");
        setDescription("");
      }, 1800);
    },
    onError: () => {
      toast({ title: "Couldn't submit report", description: "Please try again", variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors ${className || ""}`}
        data-testid={`report-btn-${targetType}-${targetId}`}
        title="Report this content"
      >
        <Flag className="w-3.5 h-3.5" />
        {!iconOnly && <span>Report</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report {targetType}</DialogTitle>
            <DialogDescription>
              Help us keep WhipGuides safe. Your report is anonymous.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-8 text-center space-y-2">
              <div className="text-3xl">✓</div>
              <p className="font-medium">Report submitted</p>
              <p className="text-sm text-muted-foreground">Thanks for helping keep the community safe.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">What's the issue?</Label>
                <div className="space-y-1.5">
                  {reasons.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setSelectedReason(r.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedReason === r.value
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-muted/40 hover:bg-muted/70 border border-transparent"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1.5 block">Additional details <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="Describe the issue..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-white"
                  disabled={!selectedReason || reportMutation.isPending}
                  onClick={() => reportMutation.mutate()}
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
