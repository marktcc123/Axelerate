"use client";

import React from "react";
import { useState } from "react";
import {
  Video,
  Link2,
  CheckSquare,
  Square,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  AlertCircle,
  Sparkles,
  DollarSign,
  Coins,
  Eye,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { getGigBrandName, formatGigPay } from "@/lib/types";
import {
  mockUGCSubmissions,
  REJECTION_REASONS,
} from "@/lib/data";
import type { UGCSubmission, ContentStatus } from "@/lib/data";

type View = "my-submissions" | "new-submission";

const statusConfig: Record<
  ContentStatus,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  pending: { label: "Under Review", icon: Clock, color: "text-purple-400", bg: "bg-purple-500/10" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

function SubmissionCard({ submission }: { submission: UGCSubmission }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[submission.status];
  const StatusIcon = config.icon;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-brand-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", config.bg, config.color)}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {submission.platform === "tiktok" ? "TikTok" : "Instagram"}
            </span>
          </div>
          <h4 className="mb-0.5 text-sm font-bold text-foreground">{submission.gigTitle}</h4>
          <p className="text-xs text-muted-foreground">{submission.brand} -- {submission.submittedAt}</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {submission.status === "approved" && (
            <span className={cn(
              "text-sm font-black",
              submission.rewardType === "cashback" ? "text-emerald-400" : "text-brand-primary"
            )}>
              {submission.rewardType === "cashback" ? `+$${submission.rewardAmount}` : `+${submission.rewardAmount} pts`}
            </span>
          )}
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-90")} />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 animate-slide-up border-t border-border pt-3">
          {/* Content link */}
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-secondary/50 p-2.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-mono text-foreground">{submission.contentUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-brand-primary" />
          </div>

          {/* Checklist status */}
          <div className="mb-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              {submission.checklist.faceShown ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={submission.checklist.faceShown ? "text-foreground" : "text-destructive"}>
                Face / Application shown
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {submission.checklist.productVisible ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={submission.checklist.productVisible ? "text-foreground" : "text-destructive"}>
                {"Product visible for 3+ seconds"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {submission.checklist.audioMention ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className={submission.checklist.audioMention ? "text-foreground" : "text-destructive"}>
                {"Audio mentions \"Axelerate\""}
              </span>
            </div>
          </div>

          {/* Rejection reason */}
          {submission.status === "rejected" && submission.rejectionReason && (
            <div className="rounded-xl bg-destructive/5 p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-bold text-destructive">
                  Reason: {REJECTION_REASONS[submission.rejectionReason]}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                You can re-submit with updated content that meets the requirements.
              </p>
            </div>
          )}

          {/* Reward info for approved */}
          {submission.status === "approved" && (
            <div className="rounded-xl bg-brand-primary/5 p-3">
              <div className="flex items-center gap-2">
                {submission.rewardType === "cashback" ? (
                  <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Coins className="h-3.5 w-3.5 text-brand-primary" />
                )}
                <span className="text-xs font-bold text-foreground">
                  {submission.rewardType === "cashback"
                    ? `Cashback: $${submission.rewardAmount} (Top 20% Creator)`
                    : `Points Earned: ${submission.rewardAmount} pts`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function NewSubmissionForm({ onBack }: { onBack: () => void }) {
  const [platform, setPlatform] = useState<"tiktok" | "instagram">("tiktok");
  const [contentUrl, setContentUrl] = useState("");
  const [selectedUserGigId, setSelectedUserGigId] = useState("");
  const [checklist, setChecklist] = useState({ faceShown: false, productVisible: false, audioMention: false });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, userGigs, refetchPrivate } = useAppDataContext();
  const supabase = createClient();
  const eligibleGigs = userGigs.filter((ug) => ug.status === "approved" && ug.gig);
  const allChecked = checklist.faceShown && checklist.productVisible && checklist.audioMention;
  const canSubmit = contentUrl.trim() && selectedUserGigId && allChecked && user?.id;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;
    const selectedUg = eligibleGigs.find((ug) => ug.id === selectedUserGigId);
    const gigId = selectedUg?.gig_id || selectedUg?.gig?.id;
    if (!gigId) {
      toast.error("Invalid gig selection");
      return;
    }
    setIsSubmitting(true);

    const { error } = await supabase
      .from("user_gigs")
      .update({
        ugc_link: contentUrl.trim(),
        status: "completed",
        progress_percent: 100,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("gig_id", gigId);

    if (error) {
      toast.error(error.message);
      console.error("UGC Submit Error:", error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setSubmitted(true);
    refetchPrivate();
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="animate-count-up mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
          <Send className="h-8 w-8 text-brand-primary" />
        </div>
        <h3 className="mb-2 text-xl font-black uppercase tracking-tight text-foreground">
          Submitted!
        </h3>
        <p className="mb-6 max-w-[260px] text-sm text-muted-foreground">
          Your content is under review. Standard rewards are points. Top 20% creators get cashback.
        </p>
        <button
          onClick={onBack}
          className="rounded-2xl bg-secondary px-6 py-3 text-sm font-bold text-foreground transition-all active:scale-[0.98]"
        >
          Back to Submissions
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        Back
      </button>

      <h2 className="mb-1 text-xl font-black uppercase tracking-tight text-foreground">
        Submit Content
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Post your UGC on TikTok or Instagram, then submit the link here for review.
      </p>

      {/* Platform selector */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Platform
        </label>
        <div className="flex gap-2">
          {(["tiktok", "instagram"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                "flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all",
                platform === p
                  ? "bg-brand-primary text-white"
                  : "border border-border bg-card text-secondary-foreground"
              )}
            >
              {p === "tiktok" ? "TikTok" : "Instagram"}
            </button>
          ))}
        </div>
      </div>

      {/* Gig selector */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Which Gig?
        </label>
        {eligibleGigs.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            No approved gigs. Get approved for a gig first from My Gigs.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {eligibleGigs.map((ug) => (
              <button
                key={ug.id}
                onClick={() => setSelectedUserGigId(ug.id)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                  selectedUserGigId === ug.id
                    ? "border-brand-primary/50 bg-brand-primary/5"
                    : "border-border bg-card hover:border-brand-primary/20"
                )}
              >
                <div>
                  <p className="text-xs font-bold text-foreground">{ug.gig?.title ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ug.gig ? getGigBrandName(ug.gig) : "—"} · {ug.gig ? formatGigPay(ug.gig) : "—"}
                  </p>
                </div>
                {selectedUserGigId === ug.id && <CheckCircle2 className="h-4 w-4 text-brand-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content URL */}
      <div className="mb-4">
        <label htmlFor="content-url" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Content Link
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 focus-within:border-brand-primary/50">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            id="content-url"
            type="url"
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
            placeholder={platform === "tiktok" ? "https://tiktok.com/@you/video/..." : "https://instagram.com/reel/..."}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="mb-6">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Content Checklist (All Required)
        </label>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-col gap-3">
            {([
              { key: "faceShown" as const, label: "Face / Application shown (Strictly required)" },
              { key: "productVisible" as const, label: "Product clearly visible for 3+ seconds" },
              { key: "audioMention" as const, label: "Audio mentions \"Axelerate\"" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="flex items-center gap-3 text-left"
              >
                {checklist[key] ? (
                  <CheckSquare className="h-5 w-5 shrink-0 text-brand-primary" />
                ) : (
                  <Square className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className={cn("text-xs", checklist[key] ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rewards explainer */}
      <div className="mb-6 rounded-xl bg-secondary/50 p-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" />
          <div className="text-[10px] leading-relaxed text-muted-foreground">
            <p className="mb-0.5 font-bold text-foreground">Reward Tiers</p>
            <p>Standard: Points (redeemable for blind boxes/products). Top 20%: Cashback (full refund of your Starter Kit cost).</p>
          </div>
        </div>
      </div>

      {/* Submit CTA */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting || eligibleGigs.length === 0}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
          canSubmit
            ? "bg-brand-primary text-white active:scale-[0.98]"
            : "bg-secondary text-muted-foreground"
        )}
      >
        {isSubmitting ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit for Review
          </>
        )}
      </button>
    </div>
  );
}

export function UGCSubmissions() {
  const [view, setView] = useState<View>("my-submissions");
  const [submissions] = useState<UGCSubmission[]>(mockUGCSubmissions);

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const totalEarned = submissions
    .filter((s) => s.status === "approved")
    .reduce((sum, s) => sum + s.rewardAmount, 0);

  if (view === "new-submission") {
    return <NewSubmissionForm onBack={() => setView("my-submissions")} />;
  }

  return (
    <div className="pb-4">
      <header className="mb-6 px-1">
        <div className="mb-1 flex items-center gap-2">
          <Video className="h-5 w-5 text-brand-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">
            UGC Rebate Engine
          </span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground">
          My Content
        </h1>
        <p className="text-sm text-muted-foreground">
          Submit content, earn points or cashback
        </p>
      </header>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xl font-black text-foreground">{submissions.length}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xl font-black text-purple-400">{pendingCount}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
        </div>
        <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-3 text-center">
          <p className="text-xl font-black text-brand-primary">{approvedCount}</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Approved</p>
        </div>
      </div>

      {/* Earnings banner */}
      {totalEarned > 0 && (
        <div className="mb-6 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Content Earnings</p>
              <p className="text-2xl font-black text-brand-primary">${totalEarned}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10">
              <Sparkles className="h-5 w-5 text-brand-primary" />
            </div>
          </div>
        </div>
      )}

      {/* New submission CTA */}
      <button
        onClick={() => setView("new-submission")}
        className="btn-primary-glow mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98]"
      >
        <Video className="h-4 w-4" />
        Submit New Content
      </button>

      {/* Submissions list */}
      <h3 className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Submission History
      </h3>
      <div className="flex flex-col gap-3">
        {submissions.map((sub, i) => (
          <div key={sub.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <SubmissionCard submission={sub} />
          </div>
        ))}
      </div>
    </div>
  );
}
