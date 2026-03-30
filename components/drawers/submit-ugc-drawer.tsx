"use client";

import { useState } from "react";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  Video,
  DollarSign,
  Zap,
  Sparkles,
  Loader2,
  Link2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGigBrandName } from "@/lib/types";
import type { UserGig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { submitUgcLink } from "@/app/actions/user";
import { toast } from "sonner";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram_reel", label: "Instagram Reel" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "other", label: "Other" },
] as const;

const DEFAULT_GUIDELINES =
  "• Must tag the brand.\n• Ensure good lighting.\n• Post must remain public for at least 30 days.";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

interface SubmitUgcDrawerProps {
  userGig: UserGig;
  onSuccess?: () => void;
}

export function SubmitUgcDrawer({ userGig, onSuccess }: SubmitUgcDrawerProps) {
  const { refetchPrivate } = useAppDataContext();
  const [platform, setPlatform] = useState<string>("");
  const [ugcLink, setUgcLink] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmGuidelines, setConfirmGuidelines] = useState(false);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gig = userGig.gig;
  const brandName = gig ? getGigBrandName(gig) : "—";
  const title = gig?.title ?? "—";
  const description = gig?.description?.trim() || DEFAULT_GUIDELINES;
  const rewardCash = gig?.reward_cash ?? 0;
  const rewardCredits = gig?.reward_credits ?? 0;
  const xpReward = gig?.xp_reward ?? 0;

  const canSubmit =
    platform &&
    ugcLink.trim() &&
    isValidUrl(ugcLink.trim()) &&
    confirmGuidelines &&
    confirmPublic &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const result = await submitUgcLink(
        userGig.id,
        platform,
        ugcLink.trim(),
        notes.trim()
      );
      if (result.success) {
        toast.success("Content submitted successfully! Pending admin review.");
        await refetchPrivate?.();
        onSuccess?.();
      } else {
        toast.error(result.error ?? "Failed to submit");
      }
    } catch (e) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRejected = userGig.status === "rejected";

  return (
    <div className="min-w-0 space-y-6 pb-4">
      {isRejected && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Your previous submission was rejected. Please review the guidelines and submit a new link.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="rounded-2xl border border-[var(--theme-primary)]/30 bg-[var(--theme-primary)]/5 p-4 shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.08)]">
        <h3 className="mb-1 text-lg font-black uppercase tracking-tight text-foreground dark:text-white">
          {title}
        </h3>
        <p className="mb-3 text-xs font-medium text-muted-foreground">{brandName}</p>
        <div className="flex flex-wrap items-center gap-2">
          {rewardCash > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--theme-primary)]/50 bg-[var(--theme-primary)]/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--theme-primary)] shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.2)]">
              <DollarSign className="h-3 w-3" />
              $ {rewardCash} Bounty
            </span>
          )}
          {rewardCredits > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400">
              <Zap className="h-3 w-3" />
              {rewardCredits} pts
            </span>
          )}
          {xpReward > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-400">
              <Sparkles className="h-3 w-3" />
              {xpReward} XP
            </span>
          )}
        </div>
      </div>

      {/* Guidelines */}
      <div className="rounded-xl border-2 border-border bg-muted/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--theme-primary)]">
          <FileText className="h-3.5 w-3.5" />
          Task Requirements
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 dark:text-zinc-300">
          {description}
        </pre>
      </div>

      {/* Core Form */}
      <div className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Platform
          </Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger
              className={cn(
                "border-2 border-border bg-input text-foreground transition-all dark:border-white/20 dark:bg-white/5",
                "focus:border-[var(--theme-primary)]/50 focus:ring-2 focus:ring-[var(--theme-primary)]/30",
                "hover:border-[var(--theme-primary)]/30"
              )}
            >
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent className="border-2 border-border bg-popover dark:border-white/10 dark:bg-zinc-900">
              {PLATFORMS.map((p) => (
                <SelectItem
                  key={p.value}
                  value={p.value}
                  className="text-foreground focus:bg-[var(--theme-primary)]/20 focus:text-[var(--theme-primary)]"
                >
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Link2 className="h-3 w-3" />
            UGC Link <span className="text-red-400">*</span>
          </Label>
          <Input
            type="url"
            placeholder="https://..."
            value={ugcLink}
            onChange={(e) => setUgcLink(e.target.value)}
            className={cn(
              "border-2 border-border bg-input placeholder:text-muted-foreground dark:border-white/20 dark:bg-white/5",
              "focus:border-[var(--theme-primary)]/50 focus:ring-2 focus:ring-[var(--theme-primary)]/30",
              ugcLink && !isValidUrl(ugcLink) && "border-red-500/50"
            )}
          />
          {ugcLink && !isValidUrl(ugcLink) && (
            <p className="mt-1 text-[10px] text-red-400">Please enter a valid URL</p>
          )}
        </div>

        <div>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Creator Notes <span className="text-muted-foreground/80">(Optional)</span>
          </Label>
          <Textarea
            placeholder="Any additional context for the brand..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={cn(
              "resize-none border-2 border-border bg-input placeholder:text-muted-foreground dark:border-white/20 dark:bg-white/5",
              "focus:border-[var(--theme-primary)]/50 focus:ring-2 focus:ring-[var(--theme-primary)]/30"
            )}
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-3 rounded-xl border-2 border-border bg-muted/30 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={confirmGuidelines}
              onCheckedChange={(v) => setConfirmGuidelines(!!v)}
              className="mt-0.5 border-2 border-border data-[state=checked]:bg-[var(--theme-primary)] data-[state=checked]:border-[var(--theme-primary)] dark:border-white/30"
            />
            <span className="text-sm text-foreground dark:text-zinc-300">
              I confirm the video follows all brand guidelines and required hashtags.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={confirmPublic}
              onCheckedChange={(v) => setConfirmPublic(!!v)}
              className="mt-0.5 border-2 border-border data-[state=checked]:bg-[var(--theme-primary)] data-[state=checked]:border-[var(--theme-primary)] dark:border-white/30"
            />
            <span className="text-sm text-foreground dark:text-zinc-300">
              I confirm my account and this video are currently PUBLIC.
            </span>
          </label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black uppercase tracking-wider",
            "border-2 border-border bg-[var(--theme-primary)] text-black shadow-md",
            "shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.4)]",
            "transition-all hover:bg-[var(--theme-primary)]/90 hover:shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.5)]",
            "active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              Submit Content
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
