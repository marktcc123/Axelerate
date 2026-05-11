"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  syndicateVerificationComplete,
  resolveTierKey,
} from "@/lib/types";
import {
  INTEL_Q1_MONTHLY_BUDGET,
  INTEL_Q2_DISCOVERY,
  INTEL_Q3_CHECKOUT_TRIGGER,
  INTEL_Q4_BRAND_RED_FLAG,
} from "@/lib/intel-bounty-schema";
import { skipIntelBounty, claimIntelBounty } from "@/app/actions/intel-bounty";

type Phase = "form" | "claiming" | "success";

function OptionBlock({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold leading-snug text-foreground">{label}</p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border-2 border-border bg-black/60 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-foreground shadow-[2px_2px_0_rgb(255_255_255/0.08)] hover:border-brand-primary/50 dark:border-white/20",
          value ? "border-emerald-500/45" : "",
        )}
      >
        <span className="truncate text-left text-muted-foreground">{value ?? "Tap to choose"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-1.5 border-2 border-dashed border-border/80 p-2 dark:border-white/15">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setExpanded(false);
              }}
              className={cn(
                "rounded-md border-2 px-3 py-2 text-left font-mono text-[10px] font-bold uppercase leading-snug tracking-wide transition-all",
                value === opt
                  ? "border-cyan-400 bg-cyan-500/15 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-white/35 hover:text-foreground dark:border-white/12",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Opens 1s after Syndicate clears (all missions + Insider tier). Persists skip/claim on profile.
 */
export function IntelBountyOpportunity() {
  const { user, profile, refetchPrivate, isLoadingPrivate } = useAppDataContext();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);
  const [q3, setQ3] = useState<string | null>(null);
  const [q4, setQ4] = useState<string | null>(null);
  const armedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressDismissSkipRef = useRef(false);

  const eligible =
    !!user?.id &&
    !!profile &&
    syndicateVerificationComplete(profile.verification_steps) &&
    resolveTierKey(profile.tier) === "student" &&
    !profile.intel_bounty_skipped_at &&
    !profile.intel_bounty_claimed_at;

  useEffect(() => {
    if (isLoadingPrivate || !eligible) {
      armedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (armedRef.current) return;
    armedRef.current = true;
    timerRef.current = setTimeout(() => setOpen(true), 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [eligible, isLoadingPrivate]);

  const handleDismiss = useCallback(async () => {
    if (phase !== "form") return;
    const r = await skipIntelBounty();
    if (!r.success) toast.error(r.error ?? "Skip failed");
    await refetchPrivate?.({ silent: true });
    setOpen(false);
  }, [phase, refetchPrivate]);

  const handleClaim = async () => {
    if (!q1 || !q2 || !q3 || !q4) return;
    setPhase("claiming");
    const r = await claimIntelBounty({
      q1_monthly_budget: q1,
      q2_discovery: q2,
      q3_checkout_trigger: q3,
      q4_brand_red_flag: q4,
    });
    if (!r.success) {
      toast.error(r.error ?? "Claim failed");
      setPhase("form");
      return;
    }
    await refetchPrivate?.();
    setPhase("success");
    window.setTimeout(() => {
      suppressDismissSkipRef.current = true;
      setOpen(false);
      setPhase("form");
      setQ1(null);
      setQ2(null);
      setQ3(null);
      setQ4(null);
      window.setTimeout(() => {
        suppressDismissSkipRef.current = false;
      }, 600);
    }, 2600);
  };

  const canClaim = !!(q1 && q2 && q3 && q4);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          return;
        }
        if (suppressDismissSkipRef.current) return;
        if (phase === "claiming" || phase === "success") return;
        void handleDismiss();
      }}
    >
      <SheetContent
        side="bottom"
        onPointerDownOutside={(e) => {
          if (phase !== "form") e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (phase !== "form") e.preventDefault();
        }}
        className={cn(
          "z-[230] max-h-[92vh] overflow-y-auto border-t-4 border-brand-primary bg-card pb-10 pt-8 dark:bg-black [&>button.absolute]:hidden sm:mx-auto sm:max-w-lg sm:rounded-t-2xl",
        )}
      >
        {phase === "success" ? (
          <div className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-emerald-400 bg-emerald-500/15 shadow-[0_0_28px_rgba(16,185,129,0.45)]">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden />
            </div>
            <p className="font-mono text-sm font-black uppercase tracking-wider text-emerald-200">
              bounty secured · wallet updated
            </p>
            <Loader2 className="h-6 w-6 animate-spin text-brand-primary opacity-70" aria-hidden />
          </div>
        ) : (
          <>
            <SheetHeader className="items-center space-y-3 text-center">
              <SheetTitle className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-transparent [text-shadow:0_0_18px_rgba(167,243,208,0.45)] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400 bg-clip-text sm:text-xs">
                [ OPTIONAL BOUNTY UNLOCKED ]
              </SheetTitle>
              <SheetDescription className="text-center text-[11px] font-mono uppercase leading-relaxed tracking-wide text-muted-foreground">
                Complete this Syndicate Intel report to claim your sign-on bonus.
              </SheetDescription>
            </SheetHeader>

            <div className="relative mt-5 overflow-hidden rounded-xl border-2 border-border bg-black/80 px-4 py-4 shadow-[4px_4px_0_rgb(168_85_247/0.35)] dark:border-white/15">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-emerald-500/15"
                aria-hidden
              />
              <div className="relative space-y-2 text-center">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">
                  REWARD:
                </p>
                <p className="bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 bg-clip-text font-mono text-lg font-black uppercase tracking-tight text-transparent drop-shadow-[0_0_16px_rgba(250,204,21,0.55)]">
                  500 CREDITS + 100 XP
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 pb-24">
              <OptionBlock
                label={`What's your monthly budget for "Treat Yourself" drops?`}
                options={INTEL_Q1_MONTHLY_BUDGET}
                value={q1}
                onChange={setQ1}
              />
              <OptionBlock
                label="Where do you actually discover the brands you care about?"
                options={INTEL_Q2_DISCOVERY}
                value={q2}
                onChange={setQ2}
              />
              <OptionBlock
                label={`What's the ultimate trigger that makes you hit "Checkout"?`}
                options={INTEL_Q3_CHECKOUT_TRIGGER}
                value={q3}
                onChange={setQ3}
              />
              <OptionBlock
                label={`What's a brand "Red Flag" that makes you instantly scroll past?`}
                options={INTEL_Q4_BRAND_RED_FLAG}
                value={q4}
                onChange={setQ4}
              />
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[235] flex flex-col gap-2 border-t-2 border-border bg-background/95 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-md dark:bg-black/90 sm:relative sm:z-0 sm:mt-2 sm:flex-row sm:flex-wrap sm:justify-between sm:border-0 sm:bg-transparent sm:p-0">
              <button
                type="button"
                disabled={phase === "claiming"}
                onClick={() => void handleDismiss()}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-40 sm:order-first"
              >
                SKIP FOR NOW
              </button>
              <button
                type="button"
                disabled={phase === "claiming" || !canClaim}
                onClick={() => void handleClaim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border bg-brand-primary px-6 py-3 font-mono text-xs font-black uppercase tracking-wider text-primary-foreground shadow-[4px_4px_0_rgb(0_0_0)] transition-all hover:brightness-110 disabled:opacity-50 dark:border-white/15 dark:shadow-[4px_4px_0_rgb(255_255_255/0.12)] sm:max-w-xs sm:flex-none"
              >
                {phase === "claiming" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                CLAIM BOUNTY
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
