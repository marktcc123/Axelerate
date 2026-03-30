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
      {/* Taller shell so inset highlight keeps ~44px tap target with even gutter vs border */}
      <div className="flex h-16 rounded-2xl border border-border/90 bg-card/95 p-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/92 dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]">
        {/* Inner radius = outer 2xl (1rem) − padding (0.375rem×2) → concentric with border */}
        <div className="flex h-full w-full min-h-0 overflow-hidden rounded-[10px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <div key={tab.id} className="flex min-h-0 min-w-0 flex-1 p-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex min-h-[44px] w-full min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-lg px-0.5 transition-colors duration-200",
                    isActive
                      ? "bg-brand-primary/12 text-brand-primary dark:bg-brand-primary/20"
                      : "text-muted-foreground hover:bg-muted/35 hover:text-foreground"
                  )}
                >
                  <Icon
                    className="h-5 w-5 shrink-0"
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "max-w-full truncate text-center text-[10px] font-medium leading-none tracking-tight",
                      isActive && "font-semibold text-foreground dark:text-white"
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
