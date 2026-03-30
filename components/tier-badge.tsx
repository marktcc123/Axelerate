import React from "react"
import { cn } from "@/lib/utils";
import type { UserTier } from "@/lib/types";
import { TIER_CONFIG } from "@/lib/types";
import { Shield, Star, Crown, User, Briefcase } from "lucide-react";

const tierIcons: Record<UserTier, React.ElementType> = {
  guest: User,
  student: Shield,
  staff: Briefcase,
  city_manager: Crown,
  partner: Star,
};

interface TierBadgeProps {
  tier: UserTier;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TierBadge({ tier, size = "md", className }: TierBadgeProps) {
  const config = TIER_CONFIG[tier];
  const Icon = tierIcons[tier];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-mono font-bold uppercase tracking-wider",
        sizeClasses[size],
        (tier === "guest" || tier === "student") && "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
        tier === "partner" &&
          "border-white/20 bg-white/10 text-foreground backdrop-blur-md",
        (tier === "city_manager" || tier === "staff") &&
          "border-foreground/30 bg-foreground/10 text-foreground",
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
}
