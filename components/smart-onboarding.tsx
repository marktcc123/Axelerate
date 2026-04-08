"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ShoppingBag, Briefcase, Wallet, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";

/** Persisted when user finishes or dismisses the post-login tutorial */
export const SMART_ONBOARDING_STORAGE_KEY = "axelerate_newbie_guided";

function hasCompletedSmartOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SMART_ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

function markSmartOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SMART_ONBOARDING_STORAGE_KEY, "true");
  } catch {
    /* ignore */
  }
}

const STEPS = [
  {
    id: "verify",
    icon: Shield,
    kicker: "STEP 01 — UNLOCK YOUR ACCESS",
    title: "GET CAMPUS VERIFIED.",
    body: "Welcome to the exclusive network. To unlock premium brand collabs and high-value drops, we need to know you're really on campus. Get verified to lift the gates and upgrade your tier.",
    hint: "Profile tab (bottom right) → Verification & Elite Status. Knock this out first to experience the full Axelerate ecosystem.",
  },
  {
    id: "feed",
    icon: Zap,
    kicker: "STEP 02 — THE FEED",
    title: "YOUR CREATOR RADAR.",
    body: "Exclusive brand missions, offline events, and fast-paced gigs—all in one scroll. Pick a mission that fits your vibe, level up, and turn your influence into cash and perks.",
    hint: "The Feed is your daily launchpad. More high-value tasks open up as you verify and grow your tier.",
  },
  {
    id: "gigs",
    icon: Briefcase,
    kicker: "STEP 03 — MANAGE YOUR MOVES",
    title: "YOUR COLLAB COMMAND CENTER.",
    body: "Tap the briefcase to track your active campaigns, submit your UGC, and manage your brand partnerships. This is where the real work gets done.",
    hint: "Bottom bar: My Gigs. Keep an eye on your deadlines and push your content live to secure the bag.",
  },
  {
    id: "shop",
    icon: ShoppingBag,
    kicker: "STEP 04 — THE PERKS SHOP",
    title: "EXPERIENCE THE DROPS.",
    body: "Where your credits turn into real rewards. Cop tech gear, beauty drops, and blind boxes. The higher your verified tier, the rarer the items you can unlock.",
    hint: "Shop tab (shopping bag). Exclusive tags disappear and rare SKUs unlock as you build your campus influence.",
  },
  {
    id: "wallet",
    icon: Wallet,
    kicker: "STEP 05 — THE PAYOUT",
    title: "CASH OUT SEAMLESSLY.",
    body: "Real influence equals real earnings. Track your balance and withdraw your Stripe-backed payouts in one tap. You put in the work, now collect the reward.",
    hint: "Profile → My Wallet & Earnings. Stack your earnings and cash out straight to your bank account.",
  },
] as const;

interface SmartOnboardingProps {
  /** Hide overlay (e.g. gig detail) without unmounting — preserves step progress */
  suppressWhen?: boolean;
}

export function SmartOnboarding({ suppressWhen = false }: SmartOnboardingProps) {
  const { user } = useAppDataContext();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    if (hasCompletedSmartOnboarding()) return;
    setVisible(true);
  }, [mounted, user]);

  const close = useCallback(() => {
    markSmartOnboardingComplete();
    setVisible(false);
  }, []);

  const isLast = stepIndex >= STEPS.length - 1;
  const step = STEPS[stepIndex];
  const StepIcon = step.icon;

  if (!mounted || !visible || !user || suppressWhen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-onboarding-title"
      aria-describedby="smart-onboarding-desc"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-label="Dismiss tutorial"
        onClick={close}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={cn(
            "relative z-10 w-full max-w-md border-4 border-black bg-white p-5 text-black",
            "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
            "dark:border-white dark:bg-black dark:text-white dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]"
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3 border-b-4 border-black pb-3 dark:border-white">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary">
              {step.kicker}
            </span>
            <span className="font-mono text-[10px] font-black uppercase tracking-widest opacity-80">
              {stepIndex + 1}/{STEPS.length}
            </span>
          </div>

          <div className="mb-4 flex items-start gap-4">
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center border-4 border-black bg-brand-primary text-primary-foreground",
                "dark:border-white"
              )}
            >
              <StepIcon className="h-7 w-7" strokeWidth={2.5} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="smart-onboarding-title"
                className="font-display text-2xl font-black uppercase leading-[1.05] tracking-tight sm:text-3xl"
              >
                {step.title}
              </h2>
            </div>
          </div>

          <p
            id="smart-onboarding-desc"
            className="mb-3 font-mono text-sm font-medium leading-relaxed tracking-tight opacity-90"
          >
            {step.body}
          </p>
          <p className="mb-6 border-l-4 border-brand-primary pl-3 font-mono text-xs font-semibold uppercase leading-snug tracking-wide text-foreground/80 dark:text-white/80">
            {step.hint}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={close}
              className="order-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] underline decoration-2 underline-offset-4 opacity-70 transition-opacity hover:opacity-100 sm:order-1"
            >
              Skip for now
            </button>

            {!isLast ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))}
                className={cn(
                  "order-1 w-full border-4 border-black bg-black px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-white",
                  "shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                  "dark:border-white dark:bg-white dark:text-black dark:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)]",
                  "sm:order-2 sm:w-auto"
                )}
              >
                NEXT
              </button>
            ) : (
              <button
                type="button"
                onClick={close}
                className={cn(
                  "order-1 w-full border-4 border-black bg-brand-primary px-6 py-4 font-mono text-xs font-black uppercase tracking-[0.25em] text-primary-foreground",
                  "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
                  "dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]",
                  "sm:order-2 sm:w-auto"
                )}
              >
                START EARNING
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
