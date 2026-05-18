"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  ChevronRight,
  TrendingUp,
  Award,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "axelerate_feed_rules_banner_v2";

export function FeedRulesWaveBanner() {
  const reduceMotion = useReducedMotion();
  /** false = minimized strip; hydrated from storage */
  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const v = localStorage.getItem(STORAGE_KEY);
      // migrate old “dismiss forever” to collapsed chip
      if (v === "1" || v === "collapsed") setExpanded(false);
      else setExpanded(true);
      setHydrated(true);
    } catch {
      setHydrated(true);
    }
  }, []);

  const collapse = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "collapsed");
    } catch {
      //
    }
    setExpanded(false);
  };

  const expandBanner = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "expanded");
    } catch {
      //
    }
    setExpanded(true);
  };

  const spring = reduceMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 340, damping: 30 };

  if (!hydrated) return <div className="mb-6 h-28 rounded-3xl bg-muted/30 animate-pulse" aria-hidden />;

  const shellClass =
    "relative mb-6 overflow-hidden rounded-3xl border-2 border-border shadow-[4px_4px_0_0_rgba(0,0,0,0.12)] dark:border-white/15 dark:shadow-[0_0_32px_rgba(var(--theme-primary-rgb),0.18)]";

  return (
    <>
      <motion.div
        layout
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className={shellClass}
      >
        <div className="absolute inset-0">
          <Image
            src="/banners/rules-wave-hero.png"
            alt=""
            fill
            className={cn(
              "object-cover object-[50%_40%] transition-opacity duration-300",
              expanded ? "opacity-100" : "opacity-55"
            )}
            sizes="100vw"
            priority
          />
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br from-black/75 via-black/45 to-purple-950/70 dark:from-black/82 dark:via-violet-950/55 dark:to-black/85 transition-opacity duration-300",
              expanded ? "opacity-100" : "opacity-95"
            )}
            aria-hidden
          />
          {expanded && (
            <>
              <motion.div
                className="pointer-events-none absolute -left-1/4 top-0 h-[140%] w-[80%] rounded-full bg-brand-primary/25 blur-[64px]"
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, 18, -10, 0], opacity: [0.35, 0.5, 0.4] }
                }
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
              <motion.div
                className="pointer-events-none absolute -right-[10%] bottom-0 h-[90%] w-[55%] rounded-full bg-cyan-400/20 blur-[56px]"
                animate={
                  reduceMotion ? undefined : { y: [0, -14, 6, 0], opacity: [0.25, 0.45, 0.3] }
                }
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
            </>
          )}
        </div>

        {!expanded ? (
          <motion.button
            layout
            type="button"
            onClick={expandBanner}
            className="relative z-[1] flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:gap-4 sm:px-5 sm:py-3.5"
            aria-expanded={expanded}
            aria-label="Expand rules banner"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/35 text-white backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-amber-300" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-black tracking-tight text-white drop-shadow-sm sm:text-base">
                What&apos;s new
              </p>
              <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">
                Perks upgrade pack · tap to open
              </p>
            </div>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-white/80"
              aria-hidden
            />
          </motion.button>
        ) : (
          <motion.div layout className="relative z-[1] p-4 pb-5 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 text-amber-300" aria-hidden />
                  Rules drop
                </span>
                <span className="rounded-full bg-fuchsia-500/90 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(217,70,239,0.6)] animate-pulse">
                  New
                </span>
              </div>
              <button
                type="button"
                onClick={collapse}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm transition-colors hover:bg-black/55"
                aria-label="Hide banner — collapse to compact bar"
              >
                Hide
                <ChevronUp className="h-3.5 w-3.5 opacity-90" aria-hidden />
              </button>
            </div>

            <h2 className="mb-2 max-w-[22ch] font-display text-xl font-black leading-[1.1] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-2xl">
              What&apos;s new
              <span className="mt-1 block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/65">
                Perks upgrade pack
              </span>
            </h2>

            <ul className="mb-4 space-y-2 text-[13px] font-semibold leading-snug text-white/92">
              <motion.li
                className="flex gap-2.5 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 backdrop-blur-md"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: reduceMotion ? 0 : 0.06 }}
              >
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  Earn <strong className="text-amber-200">Credits back</strong> after every Perks checkout — up to{" "}
                  <strong className="text-amber-200">20%</strong> (per product). Credits are{" "}
                  <strong className="text-amber-200">for on-platform use only</strong>.
                </span>
              </motion.li>
              <motion.li
                className="flex gap-2.5 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 backdrop-blur-md"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: reduceMotion ? 0 : 0.14 }}
              >
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
                <span>
                  <strong className="text-cyan-200">Gigs &amp; XP</strong> — complete gigs to earn XP, rank up, and unlock more{" "}
                  <strong className="text-cyan-200">free</strong> exclusive events, gigs, and Perks.
                </span>
              </motion.li>
              <motion.li
                className="flex gap-2.5 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 backdrop-blur-md"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: reduceMotion ? 0 : 0.22 }}
              >
                <Award className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" aria-hidden />
                <span>
                  <strong className="text-fuchsia-100">Brand gigs &amp; careers</strong> — top performers may earn platform or brand{" "}
                  <strong className="text-fuchsia-100">internship certificates</strong> and unlock referral-style hiring opportunities.
                </span>
              </motion.li>
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <motion.span whileTap={{ scale: 0.96 }} whileHover={reduceMotion ? undefined : { scale: 1.02 }}>
                <Link
                  href="/?tab=shop"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 bg-brand-primary px-4 py-2.5 font-mono text-[11px] font-black uppercase tracking-wider text-primary-foreground shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.55)] transition-[box-shadow,transform]",
                    "hover:shadow-[0_0_32px_rgba(var(--theme-primary-rgb),0.75)]"
                  )}
                >
                  Shop Perks
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </motion.span>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="inline-flex items-center gap-1 rounded-2xl border border-white/25 bg-black/35 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white/95 backdrop-blur-sm transition-colors hover:bg-black/45"
              >
                Details
                <ChevronRight className="h-4 w-4 opacity-85" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DrawerContent className="border-t-2 border-border dark:border-white/10">
          <DrawerHeader className="flex flex-row items-center justify-between gap-3 text-left">
            <DrawerTitle className="flex items-center gap-2 font-display text-lg">
              <Sparkles className="h-5 w-5 text-brand-primary" />
              Rules details
            </DrawerTitle>
            <DrawerClose className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground ring-offset-background transition-colors hover:bg-muted/80 dark:bg-white/10">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </DrawerHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 pb-8 text-sm leading-relaxed text-foreground">
            <section className="rounded-2xl border border-border bg-muted/40 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="mb-2 font-bold text-brand-primary">1. Credits back on Perks</p>
              <p className="text-muted-foreground">
                After eligible Perks orders fulfill, we credit your wallet with Pts based on each product&apos;s rebate rate — often up to about{" "}
                <strong className="text-foreground">20%</strong> of catalog-line USD on rebated SKUs (exact % per item is shown in-shop and set in admin).{" "}
                <strong className="text-foreground">Credits stay on-platform</strong>: use them toward Perks, wallet flows, and other in-app perks per our Terms —
                they are not cash, not transferable off-platform, and not redeemable for fiat.
              </p>
            </section>
            <section className="rounded-2xl border border-border bg-muted/40 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="mb-2 font-bold text-brand-primary">2. Gigs, XP &amp; unlocks</p>
              <p className="text-muted-foreground">
                Finish gigs across the app to earn <strong className="text-foreground">XP</strong>, level your rank, and{" "}
                <strong className="text-foreground">unlock more</strong> free-to-enter exclusive{" "}
                <strong className="text-foreground">events</strong>, curated <strong className="text-foreground">gigs</strong>, and{" "}
                <strong className="text-foreground">Perks</strong> tiers that were gated for newer members — higher engagement opens more upside.
              </p>
            </section>
            <section className="rounded-2xl border border-border bg-muted/40 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="mb-2 font-bold text-brand-primary">3. Brand gigs &amp; career tracks</p>
              <p className="text-muted-foreground">
                Completing gigs for partner brands puts you on the radar for{" "}
                <strong className="text-foreground">platform- or brand-issued internship certificates</strong> and similar proof-of-work credentials. Strong
                standout work may also lead to intros, referrals, or pipeline opportunities — availability and criteria vary by brand and program.
              </p>
            </section>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
