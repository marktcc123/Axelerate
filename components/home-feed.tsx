"use client";

import React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  MapPin,
  Clock,
  Zap,
  Users,
  ArrowRight,
  Camera,
  CalendarDays,
  Lock,
  TrendingUp,
  Search,
  Flame,
  Sparkles,
  ChevronRight,
  Star,
  Package,
  X,
  DollarSign,
  ShoppingBag,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  gigTypeToDisplay,
  formatGigPay,
  getGigBrandName,
  canAccessEvent,
  canAccessTier,
  getTierLabel,
  resolveTierKey,
  TIER_CONFIG,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import Confetti from "react-confetti";
import { toast } from "sonner";
import type { Gig, UserTier, Event, Brand, Product } from "@/lib/types";
import { TierBadge } from "./tier-badge";
import { TierXpProgress } from "./tier-xp-progress";
import { Skeleton } from "./ui/skeleton";
import { schoolToConfig } from "@/lib/constants/schools";
import { DEFAULT_SCHOOL_NAME, isDefaultAppTheme } from "@/lib/schools";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { BrandsDrawer } from "./drawers/brands-drawer";
import { FeedNotificationsBell } from "./feed-notifications-bell";
import type { FeedNotificationNavAction } from "@/lib/feed-notifications";

type Filter = "all" | "digital" | "physical";

function EventsSection({
  events,
  userTier,
  eventApplications,
  isLoading,
  onEventClick,
}: {
  events: Event[];
  userTier: UserTier;
  eventApplications: { event_id: string }[];
  isLoading: boolean;
  onEventClick: (event: Event) => void;
}) {
  if (isLoading) {
    return (
      <div className="-mx-5 mb-6 flex w-full touch-pan-x snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-3 [-webkit-overflow-scrolling:touch] scrollbar-visible">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-36 w-56 min-w-[224px] shrink-0 snap-center rounded-2xl"
          />
        ))}
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="-mx-5 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-5 py-8 text-center dark:border-white/10 dark:bg-white/5">
        <CalendarDays className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">No events yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Check back soon for exclusive events
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-5 flex w-full touch-pan-x snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-3 [-webkit-overflow-scrolling:touch] scrollbar-visible">
      {events.map((event) => (
        <button
          key={event.id}
          type="button"
          onClick={() => onEventClick(event)}
          className="relative flex h-36 w-56 min-w-[224px] shrink-0 snap-center overflow-hidden rounded-2xl border-2 border-border bg-muted/50 shadow-sm transition-all hover:border-primary/40 active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-none"
        >
          {event.image_url ? (
            <img
              src={event.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-primary/20 to-purple-500/20" />
          )}
          <div className="absolute inset-0 feed-image-scrim" />
          <div className="relative flex flex-1 flex-col justify-end p-4 text-left">
            <h3 className="text-sm font-bold text-foreground drop-shadow-sm dark:text-white dark:drop-shadow-md">
              {event.title}
            </h3>
          </div>
        </button>
      ))}
    </div>
  );
}

function EventDetailDrawer({
  event,
  userTier,
  userId,
  hasApplied,
  open,
  onOpenChange,
}: {
  event: Event | null;
  userTier: UserTier;
  userId: string | null;
  hasApplied: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const { refetchPrivate } = useAppDataContext();
  const [isApplying, setIsApplying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  if (!event) return null;

  const rawTier = event.min_tier ?? event.min_tier_required;
  const tierLabel = getTierLabel(rawTier ?? event.min_tier_required);
  const accessible = userId ? canAccessEvent(userTier, rawTier) : false;
  const eventDate = event.event_date ?? event.starts_at;

  const handleApply = async () => {
    if (!userId) {
      toast.error("Please sign in to apply for exclusive events.");
      return;
    }
    if (!accessible || hasApplied || isApplying) return;

    try {
      setIsApplying(true);

      const { error } = await supabase.from("event_applications").insert({
        user_id: userId,
        event_id: event.id,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("You have already applied for this event!");
        } else {
          toast.error("Failed to apply. Please try again.");
          console.error("Apply Error:", error);
        }
        return;
      }

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      toast.success("Application submitted! Check 'My Events' for your ticket.");
      refetchPrivate({ silent: true });
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          <Confetti
            width={typeof window !== "undefined" ? window.innerWidth : 400}
            height={typeof window !== "undefined" ? window.innerHeight : 600}
            recycle={false}
            numberOfPieces={350}
          />
        </div>
      )}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-muted dark:[&>div:first-child]:bg-white/20">
          <div className="flex flex-col px-5 pb-8">
            <div className="flex items-center justify-between border-b border-border py-4 dark:border-white/10">
              <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Event Details
              </DrawerTitle>
              <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground dark:bg-white/10">
                <X className="h-4 w-4" />
              </DrawerClose>
            </div>

            <div className="pt-4">
              {event.image_url && (
                <div className="-mx-5 mb-5 max-h-[200px] overflow-hidden rounded-xl">
                  <img
                    src={event.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <h2 className="mb-5 text-2xl font-black leading-tight text-foreground dark:text-white">
                {event.title}
              </h2>

              <div className="mb-5 space-y-3">
                {event.location && (
                  <div className="flex items-center gap-2.5 text-base text-muted-foreground dark:text-gray-300">
                    <MapPin className="h-4.5 w-4.5 shrink-0 text-brand-primary" />
                    {event.location}
                  </div>
                )}
                {eventDate && (
                  <div className="flex items-center gap-2.5 text-base text-muted-foreground dark:text-gray-300">
                    <CalendarDays className="h-4.5 w-4.5 shrink-0 text-brand-primary" />
                    {new Date(eventDate).toLocaleString()}
                  </div>
                )}
              </div>

              {event.description && (
                <p className="mb-6 text-base leading-relaxed text-muted-foreground">
                  {event.description}
                </p>
              )}

              <div className="mt-2 space-y-3">
                {hasApplied ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-4">
                    <span className="text-sm font-bold text-emerald-400">
                      Applied
                    </span>
                  </div>
                ) : accessible ? (
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.4)] transition-all hover:bg-brand-primary active:scale-[0.98] disabled:opacity-60"
                  >
                    {isApplying ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Applying...
                      </>
                    ) : (
                      "Apply to Join"
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-4 text-sm font-bold uppercase tracking-wider text-muted-foreground dark:bg-white/5 dark:text-gray-500"
                    >
                      <Lock className="h-4 w-4" />
                      Locked
                    </button>
                    <p className="text-center text-xs text-muted-foreground">
                      This event is exclusive to {tierLabel} and above. Keep
                      grinding to level up!
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function BrandStories({
  brands,
  isLoading,
  onBrandClick,
}: {
  brands: Brand[];
  isLoading: boolean;
  onBrandClick: (brand: Brand) => void;
}) {
  if (isLoading) {
    return (
      <div className="-mx-5 mb-6 flex gap-4 px-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }
  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return (
    <div className="-mx-5 mb-6 overflow-x-auto px-5 scrollbar-none">
      <div className="flex gap-4">
        {brands.slice(0, 6).map((brand) => (
          <button
            key={brand.id}
            onClick={() => onBrandClick(brand)}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <div
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full p-[2px] text-sm font-black",
                brand.is_featured
                  ? "bg-gradient-to-tr from-brand-primary to-purple-500"
                  : "bg-muted ring-1 ring-border dark:bg-white/20 dark:ring-0"
              )}
            >
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card text-foreground dark:bg-black dark:text-white">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(brand.name)
                )}
              </div>
            </div>
            <span className="max-w-[64px] truncate text-[10px] text-muted-foreground">
              {brand.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandDetailsDrawer({
  brand,
  gigs,
  products,
  open,
  onOpenChange,
  onSelectGig,
}: {
  brand: Brand | null;
  gigs: Gig[];
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGig: (gig: Gig) => void;
}) {
  const brandGigs = useMemo(
    () => (brand ? gigs.filter((g) => g.brand_id === brand.id) : []),
    [brand, gigs]
  );
  const brandProducts = useMemo(
    () => (brand ? products.filter((p) => p.brand_id === brand.id) : []),
    [brand, products]
  );
  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  if (!brand) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-muted dark:[&>div:first-child]:bg-white/20">
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between border-b border-border py-3 dark:border-white/10">
            <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Brand Details
            </DrawerTitle>
            <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground dark:bg-white/10">
              <X className="h-4 w-4" />
            </DrawerClose>
          </div>

          <div className="mb-6 flex items-center gap-4 py-4">
            <div
              className={cn(
                "flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-[2px] text-sm font-black",
                brand.is_featured
                  ? "bg-gradient-to-tr from-brand-primary to-purple-500"
                  : "bg-muted ring-1 ring-border dark:bg-white/20 dark:ring-0"
              )}
            >
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card text-foreground dark:bg-black dark:text-white">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(brand.name)
                )}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground dark:text-white">{brand.name}</h2>
              <p className="text-xs text-muted-foreground">
                {brandGigs.length} gigs · {brandProducts.length} products
              </p>
            </div>
          </div>

          {brandGigs.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Gigs
              </h3>
              <div className="space-y-2">
                {brandGigs.map((gig) => (
                  <button
                    key={gig.id}
                    onClick={() => {
                      onSelectGig(gig);
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border-2 border-border bg-muted/40 p-3 text-left transition-all hover:border-primary/35 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="text-sm font-bold text-foreground dark:text-white">
                      {gig.title}
                    </span>
                    <span className="text-xs font-black text-brand-primary">
                      {formatGigPay(gig)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {brandProducts.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Products
              </h3>
              <div className="space-y-2">
                {brandProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center gap-3 rounded-xl border-2 border-border bg-muted/40 p-3 text-left transition-all hover:border-primary/35 active:scale-[0.99] dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted dark:bg-white/5">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-full w-full rounded-lg object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground dark:text-white">
                        {product.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.discount_price ?? product.original_price ?? product.price_credits} pts
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {brandGigs.length === 0 && brandProducts.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <Package className="mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No gigs or products yet</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function FeaturedGigCard({ gig, onSelect }: { gig: Gig; onSelect: (gig: Gig) => void }) {
  const displayType = gigTypeToDisplay(gig.type);
  return (
    <button
      onClick={() => onSelect(gig)}
      className="group relative w-full overflow-hidden rounded-3xl border-2 border-border bg-card text-left text-card-foreground shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg active:scale-[0.98] dark:border-white/10 dark:bg-zinc-950/95 dark:shadow-[0_0_30px_rgba(var(--theme-primary-rgb),0.15)] dark:hover:border-white/20 dark:hover:shadow-[0_0_40px_rgba(var(--theme-primary-rgb),0.2)]"
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/20 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-primary shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.3)]">
              <Flame className="h-3 w-3" />
              Featured
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider",
                displayType === "digital"
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "bg-purple-500/15 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
              )}
            >
              {displayType === "digital" ? "Digital" : "In-Person"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {gig.reward_cash > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-600/35 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                <DollarSign className="h-3 w-3" />
                {gig.reward_cash}
              </span>
            )}
            {gig.reward_credits > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-600/35 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                <Zap className="h-3 w-3" />
                {gig.reward_credits} pts
              </span>
            )}
            {(gig.xp_reward ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2 py-1 text-[10px] font-bold text-brand-primary">
                <Sparkles className="h-3 w-3" />
                {gig.xp_reward} XP
              </span>
            )}
            {!gig.reward_cash && !gig.reward_credits && (gig.xp_reward ?? 0) <= 0 && (
              <span className="text-[10px] font-medium text-muted-foreground">—</span>
            )}
          </div>
        </div>

        <h3 className="mb-1 text-lg font-black leading-tight text-foreground">
          {gig.title}
        </h3>
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          {getGigBrandName(gig)}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {gig.spots_left} spots left
            </span>
            {gig.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {gig.deadline}
              </span>
            )}
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-primary)] text-black transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_var(--theme-primary)]">
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function GigCard({
  gig,
  userTier,
  onSelect,
  onRequestLogin,
}: {
  gig: Gig;
  userTier: UserTier;
  onSelect: (gig: Gig) => void;
  onRequestLogin?: () => void;
}) {
  const requiredTier: UserTier = "guest";
  const isAccessible = canAccessTier(userTier, requiredTier);

  const handleClick = () => {
    if (!isAccessible) return;
    onSelect(gig);
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isAccessible}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-start justify-between gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-all dark:border-white/5 dark:bg-[#0c0c0c]",
        isAccessible
          ? "hover:border-[var(--theme-primary)]/40 hover:bg-muted/40 active:scale-[0.99] dark:hover:bg-white/[0.02]"
          : "opacity-50 cursor-not-allowed"
      )}
    >
      {!isAccessible && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
            <Lock className="h-3 w-3" />
            {TIER_CONFIG[requiredTier].label} Only
          </div>
        </div>
      )}

      {/* 左侧文字区：flex-1 min-w-0 确保文字能正常截断，不被挤压 */}
      <div className="flex-1 min-w-0 w-full pr-0 sm:pr-4">
        <h4 className="truncate text-base font-bold text-foreground transition-colors group-hover:text-[var(--theme-primary)]">
          {gig.title}
        </h4>
        <div className="mt-1.5 flex items-center space-x-2 text-xs text-muted-foreground">
          <span className="font-medium">{getGigBrandName(gig)}</span>
          <span>•</span>
          <span>{gig.spots_left} spots left</span>
        </div>
      </div>

      {/* 右侧徽章与箭头区：shrink-0 防止被左边挤压，手机端换行 */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
        {gig.reward_cash > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded border border-emerald-600/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
            <DollarSign className="h-3 w-3" />
            {gig.reward_cash}
          </span>
        )}
        {gig.reward_credits > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded border border-amber-600/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <Zap className="h-3 w-3" />
            {gig.reward_credits} pts
          </span>
        )}
        {(gig.xp_reward ?? 0) > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded border border-[var(--theme-primary)]/30 bg-[var(--theme-primary)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--theme-primary)]">
            <Sparkles className="h-3 w-3" />
            {gig.xp_reward} XP
          </span>
        )}
        {!gig.reward_cash && !gig.reward_credits && (gig.xp_reward ?? 0) <= 0 && (
          <span className="text-[11px] font-medium text-muted-foreground">—</span>
        )}
        <ChevronRight
          size={16}
          className="ml-1 hidden shrink-0 text-muted-foreground transition-colors group-hover:text-[var(--theme-primary)] sm:block"
        />
      </div>
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  action,
  onActionClick,
}: {
  icon: React.ElementType;
  title: string;
  action?: string;
  onActionClick?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-primary" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </div>
      {action && (
        <button
          onClick={onActionClick}
          className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {action}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

/** Sun / moon toggle next to notifications — uses next-themes */
function FeedThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  if (!mounted) {
    return (
      <div
        className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5"
        aria-hidden
      >
        <span className="h-9 w-9 rounded-full" />
        <span className="h-9 w-9 rounded-full" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          !isDark
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Light mode"
        aria-pressed={!isDark}
      >
        <Sun className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          isDark
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Dark mode"
        aria-pressed={isDark}
      >
        <Moon className="h-4 w-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

interface HomeFeedProps {
  onSelectGig: (gig: Gig) => void;
  onRequestLogin?: () => void;
  onNotificationNavigate?: (action: FeedNotificationNavAction) => void;
}

export function HomeFeed({
  onSelectGig,
  onRequestLogin,
  onNotificationNavigate,
}: HomeFeedProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);
  const [brandsDrawerOpen, setBrandsDrawerOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const debouncedSearch = useDebounce(searchQuery.trim().toLowerCase(), 300);

  const {
    user,
    profile,
    previewAppTheme,
    campusSchool: schoolFromDb,
    publicGigs,
    publicProducts,
    brands,
    events,
    userGigs,
    eventApplications,
    isLoadingPublic,
    refetchPrivate,
  } = useAppDataContext();

  const userTier = resolveTierKey(profile?.tier ?? "guest");
  const displayName =
    profile?.full_name?.split(" ")[0] ??
    user?.user_metadata?.name?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "there";

  const openGigs = publicGigs.filter((g) => g.status === "active");
  const featuredGig = openGigs[0];
  const restGigs = openGigs.slice(1);

  const filteredGigs = restGigs.filter((gig) => {
    if (filter === "all") return true;
    const dt = gigTypeToDisplay(gig.type);
    return dt === filter;
  });

  const searchResults = useMemo(() => {
    if (!debouncedSearch) return { gigs: [], brands: [], products: [] };
    const q = debouncedSearch;
    const gigs = publicGigs.filter((g) =>
      g.title.toLowerCase().includes(q)
    );
    const brandMatches = brands.filter((b) =>
      b.name.toLowerCase().includes(q)
    );
    const products = publicProducts.filter((p) =>
      p.title.toLowerCase().includes(q)
    );
    const productBrandIds = new Set(products.map((p) => p.brand_id));
    const productBrands = brands.filter((b) => productBrandIds.has(b.id));
    const allBrands = [...new Map([...brandMatches, ...productBrands].map((b) => [b.id, b])).values()];
    return { gigs, brands: allBrands, products };
  }, [debouncedSearch, publicGigs, publicProducts, brands]);

  /** 有任意 is_featured 时仅展示精选（最多 6）；否则按名称取前 6 */
  const brandsForFeedStrip = useMemo(() => {
    const featured = brands.filter((b) => b.is_featured);
    if (featured.length > 0) {
      return [...featured]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        .slice(0, 6);
    }
    return [...brands]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .slice(0, 6);
  }, [brands]);

  /** 有任意 is_featured 时仅展示精选（按创建时间新→旧，最多 12）；否则沿用全表最新 12 */
  const productsForTrending = useMemo(() => {
    const featured = publicProducts.filter((p) => p.is_featured === true);
    if (featured.length > 0) {
      return [...featured].sort((a, b) => {
        const ta = new Date(a.created_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? 0).getTime();
        return tb - ta;
      }).slice(0, 12);
    }
    return publicProducts.slice(0, 12);
  }, [publicProducts]);

  const searchHasResults =
    searchResults.gigs.length > 0 ||
    searchResults.brands.length > 0 ||
    searchResults.products.length > 0;

  const handleBrandClick = useCallback((brand: Brand) => {
    setSelectedBrand(brand);
    setBrandDrawerOpen(true);
  }, []);

  const handleEventClick = useCallback((event: Event) => {
    setSelectedEvent(event);
    setEventDrawerOpen(true);
  }, []);

  const effectiveAppTheme = previewAppTheme ?? profile?.app_theme ?? null;
  const isDefaultTheme = isDefaultAppTheme(effectiveAppTheme);
  const hasRealCampus =
    !isDefaultTheme &&
    !!user &&
    !!profile?.campus?.trim() &&
    profile.campus?.trim() !== DEFAULT_SCHOOL_NAME;
  const school = hasRealCampus ? schoolToConfig(schoolFromDb) : null;
  const headerTitle = hasRealCampus && school ? `Axelerate × ${school.shortName}` : "Axelerate";
  const headerSlogan = school?.slogan ?? "";
  const headerBg = school?.secondaryColor ? `${school.secondaryColor}15` : "rgba(255,255,255,0.03)";
  const headerColor = school?.primaryColor ?? "var(--theme-primary)";
  const headerGlow =
    school?.primaryColor
      ? `0 0 16px ${school.primaryColor}50`
      : "0 0 16px rgba(var(--theme-primary-rgb), 0.3)";

  return (
    <div className="pb-4">
      <div
        className="relative mb-5 overflow-hidden rounded-2xl border-2 border-border bg-card/80 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-transparent dark:shadow-none"
        style={{
          backgroundColor: headerBg,
        }}
      >
        {!isDefaultTheme && school?.logoUrl && (
          <div
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-20"
            style={{ filter: "grayscale(1)" }}
          >
            <img
              src={school.logoUrl}
              alt=""
              className="h-12 w-12 object-contain"
            />
          </div>
        )}
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p
              className="text-sm font-black uppercase tracking-tight"
              style={{
                color: headerColor,
                textShadow: headerGlow,
              }}
            >
              {headerTitle}
            </p>
            {headerSlogan && (
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                {headerSlogan}
              </p>
            )}
          </div>
          {!isDefaultTheme && school?.logoUrl && (
            <img
              src={school.logoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border dark:ring-white/10"
            />
          )}
        </div>
      </div>

      <header className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs font-medium tracking-wide text-muted-foreground">
              Good vibes only
            </p>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Hey, {displayName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <TierBadge tier={userTier} size="sm" />
            ) : (
              <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                Guest
              </span>
            )}
            <FeedNotificationsBell
              onNavigate={onNotificationNavigate}
              onRequestLogin={onRequestLogin}
            />
            <FeedThemeToggle />
          </div>
        </div>
      </header>

      {isLoadingPublic ? (
        <>
          <Skeleton className="mb-6 h-24 w-full rounded-2xl" />
          <Skeleton className="mb-6 h-20 w-full rounded-2xl" />
        </>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border-2 border-border bg-muted/40 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <TierXpProgress
              xp={profile?.xp ?? 0}
              tier={userTier}
              variant="feed"
            />
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border-2 border-border bg-muted/40 p-3 text-center shadow-sm backdrop-blur-md transition-all hover:border-primary/35 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <DollarSign className="mx-auto mb-1 h-4 w-4 text-brand-primary" />
              <p className="text-xl font-black text-foreground">
                {user ? `$${Number(profile?.cash_balance ?? 0).toFixed(0)}` : "—"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Balance
              </p>
            </div>
            <div className="rounded-2xl border-2 border-border bg-muted/40 p-3 text-center shadow-sm backdrop-blur-md transition-all hover:border-primary/35 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <Zap className="mx-auto mb-1 h-4 w-4 text-brand-primary" />
              <p className="text-xl font-black text-foreground">
                {user ? (profile?.credit_balance ?? 0) : "—"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Credits
              </p>
            </div>
            <div className="rounded-2xl border-2 border-border bg-muted/40 p-3 text-center shadow-sm backdrop-blur-md transition-all hover:border-primary/35 dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <Star className="mx-auto mb-1 h-4 w-4 text-brand-primary" />
              <p className="text-xl font-black text-foreground">
                {user ? userGigs.length : "—"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Gigs Done
              </p>
            </div>
          </div>
        </>
      )}

      <div className="mb-8">
        <SectionHeader
          icon={Flame}
          title="Axelerating Brands"
          action="See All"
          onActionClick={() => setBrandsDrawerOpen(true)}
        />
        <BrandStories
        brands={brandsForFeedStrip}
        isLoading={isLoadingPublic}
        onBrandClick={handleBrandClick}
      />
      </div>

      <div className="relative mb-8">
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-all",
            searchFocused
              ? "border-brand-primary ring-2 ring-brand-primary/30"
              : "border-border"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            placeholder="Search gigs, brands, products..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {searchFocused && searchQuery.trim() && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border-2 border-border bg-popover text-popover-foreground shadow-lg dark:border-white/10 dark:bg-zinc-950 dark:shadow-xl">
            {searchHasResults ? (
              <div className="flex flex-col py-2">
                {searchResults.gigs.map((gig) => (
                  <button
                    key={gig.id}
                    onClick={() => {
                      onSelectGig(gig);
                      setSearchQuery("");
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted dark:hover:bg-white/5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
                      <Zap className="h-5 w-5 text-brand-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {gig.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getGigBrandName(gig)} · {formatGigPay(gig)}
                      </p>
                    </div>
                  </button>
                ))}
                {searchResults.brands.map((brand) => (
                  <button
                    key={`brand-${brand.id}`}
                    onClick={() => {
                      handleBrandClick(brand);
                      setSearchQuery("");
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted dark:hover:bg-white/5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted dark:bg-white/10">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-black text-foreground">
                          {brand.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">
                        {brand.name}
                      </p>
                      <p className="text-xs text-muted-foreground">Brand</p>
                    </div>
                  </button>
                ))}
                {searchResults.products.map((product) => {
                  const brand = brands.find((b) => b.id === product.brand_id);
                  return (
                    <button
                      key={`product-${product.id}`}
                      onClick={() => {
                        if (brand) handleBrandClick(brand);
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted dark:hover:bg-white/5"
                    >
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-muted dark:bg-white/5">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {product.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {brand?.name ?? "Product"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hot Products / Trending Rewards */}
      {!isLoadingPublic && productsForTrending.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <ShoppingBag size={20} className="mr-2 text-[var(--theme-primary)]" />
            TRENDING REWARDS
          </h2>
          <div className="-mx-5 flex w-full overflow-x-auto snap-x snap-mandatory gap-4 px-5 pb-4 scrollbar-visible">
            {productsForTrending.map((product) => {
              const priceUsd = product.discount_price ?? product.original_price ?? 0;
              return (
                <Link
                  key={product.id}
                  href={"/product/" + product.id}
                  className="flex h-56 w-40 min-w-[160px] shrink-0 cursor-pointer snap-center flex-col overflow-hidden rounded-2xl border-2 border-border bg-card text-card-foreground shadow-md transition-all hover:border-primary/40 dark:border-white/10 dark:bg-gradient-to-b dark:from-zinc-900 dark:to-zinc-950 dark:shadow-lg"
                >
                  <div className="relative h-32 shrink-0 overflow-hidden">
                    {product.image_url ? (
                      <>
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 feed-image-scrim" />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted dark:bg-zinc-800">
                        <Package className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-3">
                    <p className="line-clamp-2 text-xs font-bold text-card-foreground">
                      {product.title}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">
                        ${priceUsd.toFixed(2)}
                      </div>
                      <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                        {product.price_credits} Pts
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {isLoadingPublic ? (
        <div className="space-y-8">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {featuredGig && (
            <div className="mb-8">
              <SectionHeader icon={Sparkles} title="Hot Right Now" />
              <FeaturedGigCard gig={featuredGig} onSelect={onSelectGig} />
            </div>
          )}

          <div className="mb-8">
            <SectionHeader
              icon={TrendingUp}
              title="All Opportunities"
              action={`${filteredGigs.length} gigs`}
            />
            <div className="mb-4 flex gap-2">
            {(["all", "digital", "physical"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all",
                  filter === f
                    ? "bg-brand-primary text-primary-foreground shadow-sm"
                    : "border-2 border-border bg-muted/50 text-foreground backdrop-blur-sm hover:border-primary/35 dark:border-white/10 dark:bg-white/5 dark:text-secondary-foreground"
                )}
              >
                {f === "all" ? "All" : f === "digital" ? "Digital" : "In-Person"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 w-full">
            {filteredGigs.map((gig, i) => (
              <div
                key={gig.id}
                className="animate-slide-up w-full"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <GigCard
                  gig={gig}
                  userTier={userTier}
                  onSelect={onSelectGig}
                  onRequestLogin={onRequestLogin}
                />
              </div>
            ))}

            {filteredGigs.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-bold text-foreground">No gigs found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a different filter or check back later
                </p>
              </div>
            )}
          </div>
          </div>

          <div id="events-section" className="mb-8 min-w-0 scroll-mt-24">
            <SectionHeader icon={CalendarDays} title="Exclusive Events" />
            <EventsSection
            events={events}
            userTier={userTier}
            eventApplications={eventApplications}
            isLoading={isLoadingPublic}
            onEventClick={handleEventClick}
          />
          </div>
        </>
      )}

      <BrandDetailsDrawer
        brand={selectedBrand}
        gigs={publicGigs}
        products={publicProducts}
        open={brandDrawerOpen}
        onOpenChange={setBrandDrawerOpen}
        onSelectGig={onSelectGig}
      />

      <BrandsDrawer
        brands={brands}
        gigs={publicGigs}
        open={brandsDrawerOpen}
        onOpenChange={setBrandsDrawerOpen}
        onBrandClick={handleBrandClick}
      />

      <EventDetailDrawer
        event={selectedEvent}
        userTier={userTier}
        userId={user?.id ?? null}
        hasApplied={
          selectedEvent
            ? eventApplications.some((a) => a.event_id === selectedEvent.id)
            : false
        }
        open={eventDrawerOpen}
        onOpenChange={(o) => {
          setEventDrawerOpen(o);
          if (!o) setTimeout(() => setSelectedEvent(null), 300);
        }}
      />
    </div>
  );
}
