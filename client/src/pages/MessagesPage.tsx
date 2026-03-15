import { useAuth } from "@/hooks/use-auth";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";

// Placeholder — Phase 3 will wire real Supabase Realtime threads
export default function MessagesPage({ threadUserId }: { threadUserId?: number }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-display text-2xl font-extrabold mb-2">Your Messages</h2>
        <p className="text-muted-foreground mb-6">Sign in to view and send messages to sellers and buyers.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-6 h-6 text-primary" />
        <h1 className="text-display text-2xl font-extrabold">Messages</h1>
      </div>

      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-lg mb-1">No messages yet</p>
        <p className="text-muted-foreground text-sm mb-4">
          When you contact a seller or receive an inquiry, threads will appear here.
        </p>
        <Button onClick={() => navigate("/")}>Browse Listings</Button>
      </div>
    </div>
  );
}
