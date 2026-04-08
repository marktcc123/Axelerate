import React from "react";
import { cn } from "@/lib/utils";
import type { UserTier } from "@/lib/types";
import { TIER_CONFIG } from "@/lib/types";
import {
  TierGlyph,
  tierBadgeShellClass,
  tierBadgeLabelClass,
} from "@/components/tier-identity";

interface TierBadgeProps {
  tier: UserTier;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TierBadge({ tier, size = "md", className }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  const glyphSizes = {
    sm: "sm" as const,
    md: "md" as const,
    lg: "lg" as const,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-mono uppercase tracking-wider",
        sizeClasses[size],
        tierBadgeShellClass(tier),
        tier === "partner" &&
          "motion-safe:animate-[tier-badge-syndicate-glow_3.5s_ease-in-out_infinite]",
        className,
      )}
    >
      <TierGlyph tier={tier} size={glyphSizes[size]} className="shrink-0" />
      <span className={cn("min-w-0 truncate", tierBadgeLabelClass(tier))}>
        {config.label}
      </span>
    </span>
  );
}
