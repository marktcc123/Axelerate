"use client";

import type { LucideIcon } from "lucide-react";
import {
  Circle,
  Shield,
  Briefcase,
  Crown,
  Gem,
} from "lucide-react";
import type { UserTier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Distinct icon per tier — progression: minimal → member → pro → royalty → apex.
 * Reuse across badges, XP bars, celebrations, and profile.
 */
export const TIER_GLYPH_ICONS: Record<UserTier, LucideIcon> = {
  guest: Circle,
  student: Shield,
  staff: Briefcase,
  city_manager: Crown,
  partner: Gem,
};

const GLYPH_SIZES = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-8 w-8",
} as const;

export function TierGlyph({
  tier,
  size = "md",
  className,
}: {
  tier: UserTier;
  size?: keyof typeof GLYPH_SIZES;
  className?: string;
}) {
  const Icon = TIER_GLYPH_ICONS[tier];
  const stroke =
    tier === "guest" ? 2.5 : tier === "student" ? 2.35 : tier === "staff" ? 2.2 : 2;

  return (
    <Icon
      className={cn(GLYPH_SIZES[size], tierGlyphVisualClass(tier), className)}
      aria-hidden
      strokeWidth={stroke}
    />
  );
}

/** Icon-only classes (color, glow) — pairs with TierBadge shells. */
export function tierGlyphVisualClass(tier: UserTier): string {
  switch (tier) {
    case "guest":
      return "text-muted-foreground";
    case "student":
      return cn(
        "text-brand-primary",
        "drop-shadow-[0_0.5px_0_rgba(255,255,255,0.5)]",
        "dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.75)]",
      );
    case "staff":
      return "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]";
    case "city_manager":
      return "text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)] dark:text-amber-100";
    case "partner":
      return "text-white motion-safe:animate-[tier-partner-glow_3s_ease-in-out_infinite]";
    default:
      return "text-muted-foreground";
  }
}

/** Capsule container — complexity ramps with tier. */
export function tierBadgeShellClass(tier: UserTier): string {
  switch (tier) {
    case "guest":
      return cn(
        "border border-border/90 bg-muted/35 text-muted-foreground",
        "dark:border-white/15 dark:bg-zinc-900/60 dark:text-zinc-300",
      );
    case "student":
      return cn(
        "border border-brand-primary/50 text-brand-primary",
        /* Solid panel so label + icon stay readable on busy avatars / photos */
        "bg-white/95 backdrop-blur-sm",
        "shadow-[0_2px_12px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.85)]",
        "dark:border-brand-primary/55 dark:bg-zinc-950/95 dark:backdrop-blur-sm",
        "dark:shadow-[0_2px_14px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
      );
    case "staff":
      return cn(
        "border border-white/18 bg-zinc-800/95 text-white",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(0,0,0,0.4)]",
        "dark:border-white/20 dark:bg-zinc-950/90",
      );
    case "city_manager":
      return cn(
        "border border-amber-400/55 bg-gradient-to-r from-amber-500/[0.18] via-yellow-500/10 to-amber-600/[0.18]",
        "text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.22),inset_0_1px_0_rgba(255,255,255,0.12)]",
        "dark:border-amber-400/40 dark:from-amber-500/25 dark:via-yellow-500/15 dark:to-amber-600/25",
      );
    case "partner":
      return cn(
        "relative overflow-hidden border border-fuchsia-400/45",
        "bg-gradient-to-br from-fuchsia-600/35 via-rose-600/25 to-orange-500/30 text-white",
        "shadow-[0_0_28px_rgba(217,70,239,0.35),inset_0_1px_0_rgba(255,255,255,0.15)]",
      );
    default:
      return "border border-border bg-muted text-muted-foreground";
  }
}

/** Label typography — chromatic / glitch ramps at Elite+. */
export function tierBadgeLabelClass(tier: UserTier): string {
  switch (tier) {
    case "guest":
      return "font-mono font-bold uppercase tracking-widest text-muted-foreground";
    case "student":
      return cn(
        "font-mono font-bold uppercase tracking-wider text-brand-primary",
        "drop-shadow-[0_1px_0_rgba(255,255,255,0.65)]",
        "dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]",
      );
    case "staff":
      return cn(
        "font-mono font-bold uppercase tracking-widest text-white",
        "tier-label-chromatic",
      );
    case "city_manager":
      return cn(
        "font-mono font-black uppercase tracking-widest text-amber-50",
        "tier-label-chromatic",
      );
    case "partner":
      return cn(
        "font-mono font-black uppercase tracking-[0.12em] text-white",
        "tier-label-chromatic-strong",
      );
    default:
      return "font-mono font-bold uppercase tracking-wider";
  }
}
