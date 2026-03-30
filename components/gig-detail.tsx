"use client";

import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Clock,
  Users,
  Camera,
  CheckCircle2,
  ExternalLink,
  Zap,
  Coins,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAppDataContext } from "@/lib/context/app-data-context";
import type { Gig } from "@/lib/types";
import {
  gigTypeToDisplay,
  getGigBrandName,
} from "@/lib/types";
import { TierBadge } from "./tier-badge";
import Confetti from "react-confetti";

interface GigDetailProps {
  gig: Gig;
  onBack: () => void;
}

export function GigDetail({ gig, onBack }: GigDetailProps) {
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [ugcLink, setUgcLink] = useState("");
  const [ugcSubmitting, setUgcSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { user, userGigs, refetchPrivate } = useAppDataContext();
  const supabase = createClient();

  const userGig = userGigs.find((ug) => ug.gig_id === gig.id || ug.gig?.id === gig.id);
  const alreadyApplied = !!userGig;
  const canSubmitUgc = userGig?.status === "approved" && !userGig?.ugc_link;
  const ugcSubmitted = (userGig?.status === "completed" || userGig?.status === "paid") && userGig?.ugc_link;

  const displayType = gigTypeToDisplay(gig.type);
  const requiredTier = "guest";

  const handleApply = async () => {
    if (alreadyApplied) return;
    if (!user?.id || !gig?.id) {
      console.error("Apply Error: Missing user.id or gig.id", { user: user?.id, gigId: gig?.id });
      toast.error("Please sign in to apply.");
      return;
    }
    setApplying(true);
    const { data, error } = await supabase
      .from("user_gigs")
      .insert({
        user_id: user.id,
        gig_id: gig.id,
        status: "pending",
        progress_percent: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Apply Error:", error);
      toast.error(error.message);
      setApplying(false);
      return;
    }

    setApplied(true);
    setApplying(false);
    toast.success(
      displayType === "digital" ? "Task Accepted!" : "Application Sent!",
      {
        description:
          displayType === "digital"
            ? "Complete it before the deadline to get paid."
            : "You'll be notified when the brand responds.",
      }
    );
    await refetchPrivate();
  };

  const handleUgcSubmit = async () => {
    if (!ugcLink.trim() || !user?.id || !userGig) return;
    const gigId = userGig.gig_id || userGig.gig?.id;
    if (!gigId) return;
    setUgcSubmitting(true);

    const { error } = await supabase
      .from("user_gigs")
      .update({
        ugc_link: ugcLink.trim(),
        status: "completed",
        progress_percent: 100,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("gig_id", gigId);

    if (error) {
      toast.error(error.message);
      setUgcSubmitting(false);
      return;
    }

    toast.success("UGC Submitted!", {
      description: "Your link is under review. Rewards will sync soon.",
    });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
    setUgcLink("");
    await refetchPrivate();
    setUgcSubmitting(false);
  };

  return (
    <div className="pb-28 relative">
      {showConfetti && (
        <Confetti
          width={typeof window !== "undefined" ? window.innerWidth : 400}
          height={typeof window !== "undefined" ? window.innerHeight : 600}
          recycle={false}
          numberOfPieces={300}
        />
      )}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              displayType === "digital"
                ? "bg-brand-primary/15 text-brand-primary"
                : "bg-purple-500/15 text-purple-700 dark:text-purple-400"
            )}
          >
            {displayType === "digital" ? (
              <Camera className="h-3 w-3" />
            ) : (
              <MapPin className="h-3 w-3" />
            )}
            {displayType === "digital" ? "Digital Task" : "Physical Gig"}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-black uppercase leading-tight tracking-tight text-foreground">
          {gig.title}
        </h1>
        <p className="text-lg font-medium text-muted-foreground">
          {getGigBrandName(gig)}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border-2 border-brand-primary/30 bg-brand-primary/5 p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              You Earn
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {gig.reward_cash > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/35 bg-emerald-500/15 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Coins className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" strokeWidth={2.25} />
                  ${gig.reward_cash}
                </span>
              )}
              {gig.reward_credits > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/35 bg-amber-500/15 px-3 py-1.5 text-sm font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                  <Zap className="h-4 w-4" />
                  {gig.reward_credits} pts
                </span>
              )}
              {(gig.xp_reward ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-sm font-bold text-brand-primary">
                  <Sparkles className="h-4 w-4" />
                  {gig.xp_reward} XP
                </span>
              )}
              {!gig.reward_cash && !gig.reward_credits && (gig.xp_reward ?? 0) <= 0 && (
                <span className="text-sm font-medium text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <TierBadge tier={requiredTier} size="md" />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {gig.location && (
          <div className="rounded-xl border-2 border-border bg-card p-3 shadow-sm">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Location
            </div>
            <p className="text-sm font-bold text-foreground">{gig.location}</p>
          </div>
        )}
        {gig.date && (
          <div className="rounded-xl border-2 border-border bg-card p-3 shadow-sm">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Date
            </div>
            <p className="text-sm font-bold text-foreground">{gig.date}</p>
          </div>
        )}
        <div className="rounded-xl border-2 border-border bg-card p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Deadline
          </div>
          <p className="text-sm font-bold text-foreground">
            {gig.deadline ?? "Ongoing"}
          </p>
        </div>
        <div className="rounded-xl border-2 border-border bg-card p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Spots
          </div>
          <p className="text-sm font-bold text-foreground">
            {gig.spots_left}
            <span className="font-normal text-muted-foreground">
              /{gig.spots_total}
            </span>
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          What You Need To Do
        </h2>
        <p className="text-sm leading-relaxed text-foreground/80">
          {gig.description ?? "Complete this task to earn rewards."}
        </p>
      </div>

      {gig.tags && gig.tags.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {gig.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 w-full border-t-2 border-border bg-card/95 px-4 pb-[env(safe-area-inset-bottom)] pt-4 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-black/85">
        <div className="mx-auto max-w-lg">
          {!user ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border bg-muted/60 py-4 text-base font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md dark:border-white/20 dark:bg-white/5 dark:text-white/70">
              Sign in to apply
            </div>
          ) : canSubmitUgc ? (
            <div className="space-y-3">
              <input
                type="url"
                value={ugcLink}
                onChange={(e) => setUgcLink(e.target.value)}
                placeholder="Paste your TikTok/IG link here..."
                className="w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-[var(--theme-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 dark:border-white/10 dark:bg-black/50 dark:text-white"
              />
              <button
                onClick={handleUgcSubmit}
                disabled={!ugcLink.trim() || ugcSubmitting}
                className="w-full py-3.5 rounded-xl bg-[var(--theme-primary)] text-black font-black text-base tracking-wide hover:shadow-[0_0_20px_var(--theme-primary)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {ugcSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {ugcSubmitting ? "SUBMITTING..." : "CONFIRM & SUBMIT"}
              </button>
            </div>
          ) : ugcSubmitted ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-emerald-600/35 bg-emerald-500/10 py-4 text-base font-bold text-emerald-800 backdrop-blur-md dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              UGC Submitted Successfully! Pending final data sync.
            </div>
          ) : !applied && !alreadyApplied ? (
            <button
              onClick={handleApply}
              disabled={applying}
              className="btn-primary-glow flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border bg-brand-primary py-4 font-mono text-lg font-bold uppercase tracking-wider text-primary-foreground shadow-md transition-all hover:bg-brand-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Zap className="h-6 w-6" />
              {applying ? "Applying..." : displayType === "digital" ? "Accept Quest" : "Apply Now"}
            </button>
          ) : (
            <div className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border bg-muted/50 py-4 text-base font-bold uppercase tracking-wider text-foreground backdrop-blur-md dark:border-white/20 dark:bg-white/5 dark:text-white/90">
              <CheckCircle2 className="h-5 w-5 text-brand-primary" />
              {displayType === "digital" ? "Task Accepted" : "Application Sent"}
            </div>
          )}
        </div>
      </div>

      {displayType === "digital" && (
        <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            How to Submit
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
                1
              </span>
              <p className="text-sm text-foreground/80">
                Create content following the brief above
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
                2
              </span>
              <p className="text-sm text-foreground/80">
                Post to your account and copy the link
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
                3
              </span>
              <div className="flex items-center gap-1 text-sm text-foreground/80">
                Submit your link or screenshot here
                <ExternalLink className="h-3.5 w-3.5 text-brand-primary" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
