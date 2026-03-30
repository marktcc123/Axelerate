"use client";

import type { ElementType } from "react";
import {
  User,
  DollarSign,
  Shield,
  Video,
  Gift,
  Settings,
  ChevronRight,
  Zap,
  LogOut,
  Package,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type ProfileDrawerKey =
  | "wallet"
  | "verification"
  | "elite"
  | "ugc"
  | "orders"
  | "events"
  | "referrals"
  | "settings";

import { getTierLabel, type Profile } from "@/lib/types";
import { schoolToConfig } from "@/lib/constants/schools";
import { isDefaultAppTheme } from "@/lib/schools";
import { useAppDataContext } from "@/lib/context/app-data-context";

export interface UserProfileProps {
  user: SupabaseUser | null;
  profile?: Profile | null;
  isLoadingProfile?: boolean;
  onOpenDrawer: (key: ProfileDrawerKey) => void;
}

type MenuRow = { key: ProfileDrawerKey; label: string; icon: ElementType };

const MENU_SECTIONS: { title: string; items: MenuRow[] }[] = [
  {
    title: "Wallet & orders",
    items: [
      { key: "wallet", label: "My Wallet & Earnings", icon: DollarSign },
      { key: "orders", label: "My Orders", icon: Package },
    ],
  },
  {
    title: "Grow & earn",
    items: [
      { key: "verification", label: "Verification & Elite Status", icon: Shield },
      { key: "elite", label: "Elite Tracks", icon: Zap },
      { key: "ugc", label: "Brand Co-Creations", icon: Video },
      { key: "events", label: "My Events", icon: CalendarDays },
      { key: "referrals", label: "Invite Friends", icon: Gift },
    ],
  },
  {
    title: "Account",
    items: [{ key: "settings", label: "Settings", icon: Settings }],
  },
];

import { LazyLoginPrompt } from "@/components/auth/lazy-login-prompt";

export function UserProfile({ user, profile: contextProfile, isLoadingProfile, onOpenDrawer }: UserProfileProps) {
  const supabase = createClient();
  const { campusSchool, previewAppTheme } = useAppDataContext();
  const dbProfile = contextProfile ?? null;
  const effectiveAppTheme = previewAppTheme ?? dbProfile?.app_theme ?? null;
  const isDefaultTheme = isDefaultAppTheme(effectiveAppTheme);
  const loadingProfile = isLoadingProfile ?? false;

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  if (!user) {
    return (
      <div className="pb-8">
        <LazyLoginPrompt />
      </div>
    );
  }

  // Resolve display name and avatar from profile / auth metadata
  const displayName =
    dbProfile?.full_name ||
    user.user_metadata?.full_name?.split(" ")[0] ||
    user.user_metadata?.name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "User";

  const avatarUrl = dbProfile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const currentSchool = schoolToConfig(campusSchool);

  return (
    <div className="animate-in pb-8 fade-in duration-500">
      {/* Header: avatar, name, tier, campus */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-primary/30 to-purple-500/30 p-[2px] ring-2 ring-border dark:ring-white/10">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-muted dark:bg-zinc-900">
                <User className="h-10 w-10 text-brand-primary/80" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-border bg-card px-3 py-0.5 text-[10px] font-semibold tracking-tight text-foreground shadow-sm dark:border-white/20 dark:bg-[#1A1A1A] dark:text-white">
            {getTierLabel(dbProfile?.tier)}
          </div>
        </div>
        <h1 className="text-fluid-xl font-bold tracking-tight text-foreground dark:text-white">
          {displayName}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Your profile</p>
        {!isDefaultTheme && dbProfile?.campus?.trim() && (
          <div
            className="mt-2 flex items-center justify-center gap-2 rounded-full border-2 border-border bg-muted/50 px-3 py-1 dark:border-white/10 dark:bg-black/40"
            style={{
              color: currentSchool.primaryColor,
              textShadow: `0 0 12px ${currentSchool.primaryColor}40`,
            }}
          >
            {currentSchool.logoUrl && currentSchool.logoUrl.trim() !== "" && (
              <img
                src={currentSchool.logoUrl}
                alt="Campus Logo"
                className="h-5 w-5 shrink-0 rounded-full object-contain"
              />
            )}
            <span className="text-xs font-semibold tracking-tight">
              {currentSchool.shortName}
              {currentSchool.slogan && (
                <span className="ml-1.5 font-normal opacity-90">· {currentSchool.slogan}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Balance cards — open wallet drawer (same as My Wallet below) */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onOpenDrawer("wallet")}
          className="relative overflow-hidden rounded-2xl border-2 border-border bg-muted/40 p-4 text-left shadow-sm transition-all hover:bg-muted/60 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <p className="mb-1 flex items-center gap-1 text-xs font-medium tracking-tight text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-green-400" />
            Cash balance
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground dark:text-white">
            ${loadingProfile ? "..." : (dbProfile?.cash_balance || 0).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Available to spend or withdraw</p>
        </button>

        <button
          type="button"
          onClick={() => onOpenDrawer("wallet")}
          className="relative overflow-hidden rounded-2xl border-2 border-brand-primary/30 bg-brand-primary/5 p-4 text-left shadow-sm transition-all hover:bg-brand-primary/10 active:scale-[0.99]"
        >
          <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-brand-primary/20 blur-2xl" />
          <p className="mb-1 flex items-center gap-1 text-xs font-medium tracking-tight text-brand-primary">
            <Zap className="h-3.5 w-3.5" />
            Credits
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground dark:text-white">
            {loadingProfile ? "..." : (dbProfile?.credit_balance || 0)}{" "}
            <span className="text-base font-medium text-brand-primary/80">pts</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">For Perks Shop and rewards</p>
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            <div className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onOpenDrawer(item.key)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/80 active:bg-muted dark:hover:bg-white/5 dark:active:bg-white/10",
                      index > 0 && "border-t border-border dark:border-white/5"
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted dark:bg-white/5">
                      <Icon className="h-4 w-4 text-brand-primary/90" />
                    </div>
                    <span className="flex-1 text-sm font-semibold text-foreground dark:text-white">
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="mx-auto mt-6 flex items-center gap-2 rounded-xl border-2 border-border bg-transparent px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:scale-95 dark:hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" />
        Log out
      </button>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        Axelerate Pioneer Campus Platform
      </p>
    </div>
  );
}
