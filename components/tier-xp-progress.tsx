"use client";

import { cn } from "@/lib/utils";
import type { UserTier } from "@/lib/types";
import { calculateNextTier } from "@/lib/tier-progress";
import { TierGlyph } from "@/components/tier-identity";

export type TierXpProgressVariant = "feed" | "wallet" | "shop" | "profile";

type TierXpProgressProps = {
  xp: number;
  tier: UserTier;
  variant?: TierXpProgressVariant;
  className?: string;
};

export function TierXpProgress({
  xp,
  tier,
  variant = "feed",
  className,
}: TierXpProgressProps) {
  const p = calculateNextTier(xp, tier);

  const barFill = p.plugPromotionPending
    ? "bg-amber-500 dark:bg-amber-400"
    : "bg-gradient-to-r from-brand-primary to-purple-500";

  const barHeight = variant === "wallet" || variant === "profile" ? "h-3" : "h-2.5";
  const barTrack =
    variant === "wallet"
      ? "rounded-full bg-secondary"
      : "rounded-full bg-border/40 dark:bg-white/10";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {variant === "shop" ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex shrink-0 rounded-md border border-border/60 bg-muted/30 p-0.5 dark:border-white/10 dark:bg-white/5">
                <TierGlyph tier={tier} size="sm" />
              </span>
              <span className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                XP track
              </span>
            </div>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
              {p.currentXp.toLocaleString()}
              {p.nextThresholdXp != null
                ? ` / ${p.nextThresholdXp.toLocaleString()}`
                : ""}{" "}
              XP
            </span>
          </>
        ) : variant === "wallet" ? (
          <>
            <span className="flex items-center gap-2 text-xs font-medium tracking-tight text-muted-foreground">
              <span className="flex rounded-md border border-border/60 bg-muted/30 p-0.5 dark:border-white/10 dark:bg-white/5">
                <TierGlyph tier={tier} size="sm" />
              </span>
              Level progress
            </span>
            <span className="text-xs font-semibold tabular-nums text-brand-primary">
              {p.currentXp.toLocaleString()}
              {p.nextThresholdXp != null
                ? ` / ${p.nextThresholdXp.toLocaleString()}`
                : ""}{" "}
              XP
            </span>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              {(variant === "feed" || variant === "profile") && (
                <span className="flex shrink-0 rounded-md border border-border/60 bg-muted/30 p-0.5 dark:border-white/10 dark:bg-white/5">
                  <TierGlyph tier={tier} size="md" />
                </span>
              )}
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Level Progress
              </span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {p.currentXp.toLocaleString()}
              {p.nextThresholdXp != null
                ? ` / ${p.nextThresholdXp.toLocaleString()}`
                : ""}{" "}
              XP
            </span>
          </>
        )}
      </div>

      <div className={cn("w-full overflow-hidden", barHeight, barTrack)}>
        <div
          className={cn("h-full rounded-full transition-all duration-700", barFill)}
          style={{ width: `${p.progressPercent}%` }}
        />
      </div>

      <p
        className={cn(
          "mt-2 text-muted-foreground",
          variant === "shop" ? "text-[10px]" : "text-[11px] sm:text-sm"
        )}
      >
        {p.plugPromotionPending ? (
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {p.caption}
          </span>
        ) : (
          <span className="text-muted-foreground">{p.caption}</span>
        )}
      </p>
    </div>
  );
}
