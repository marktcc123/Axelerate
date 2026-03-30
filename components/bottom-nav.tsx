"use client";

import { Home, ShoppingBag, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "feed", label: "Feed", icon: Home },
  { id: "shop", label: "Shop", icon: ShoppingBag },
  { id: "gigs", label: "My gigs", icon: Briefcase },
  { id: "profile", label: "Profile", icon: User },
] as const;

export type TabId = (typeof tabs)[number]["id"];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Standard bottom tab bar: equal tabs, safe area, ~44px tap targets.
 */
export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      role="tablist"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-stretch justify-between gap-0.5 rounded-2xl border border-border/90 bg-card/95 px-1 py-1 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/92 dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors",
                isActive
                  ? "bg-brand-primary/12 text-brand-primary dark:bg-brand-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className="h-[22px] w-[22px] shrink-0"
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden
              />
              <span
                className={cn(
                  "max-w-full truncate text-[11px] font-medium leading-tight tracking-tight",
                  isActive && "font-semibold text-foreground dark:text-white"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
