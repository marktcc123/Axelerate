"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Confetti from "react-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  TIER_CONFIG,
  TIER_ORDER,
  resolveTierKey,
  type UserTier,
} from "@/lib/types";
import { TierGlyph } from "@/components/tier-identity";

const STORAGE_PREFIX = "axelerate_last_ack_tier:";

const CONFETTI_COLORS = [
  "#a855f7",
  "#c084fc",
  "#e879f9",
  "#34d399",
  "#fbbf24",
  "#f472b6",
];

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function TierUpgradeCelebration() {
  const { user, profile, isLoadingPrivate } = useAppDataContext();
  const [open, setOpen] = useState(false);
  const [newTier, setNewTier] = useState<UserTier | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const dismiss = useCallback(() => {
    setShowConfetti(false);
    setOpen(false);
    setNewTier(null);
  }, []);

  useEffect(() => {
    if (!user?.id || !profile?.tier || isLoadingPrivate) return;

    const key = storageKey(user.id);
    const current = resolveTierKey(profile.tier);

    let storedRaw: string | null = null;
    try {
      storedRaw = localStorage.getItem(key);
    } catch {
      return;
    }

    if (storedRaw === null) {
      try {
        localStorage.setItem(key, current);
      } catch {
        /* ignore */
      }
      return;
    }

    const previous = resolveTierKey(storedRaw);
    const idxCurr = TIER_ORDER.indexOf(current);
    const idxPrev = TIER_ORDER.indexOf(previous);

    if (idxCurr < idxPrev) {
      try {
        localStorage.setItem(key, current);
      } catch {
        /* ignore */
      }
      return;
    }

    if (idxCurr > idxPrev) {
      try {
        localStorage.setItem(key, current);
      } catch {
        /* ignore */
      }
      setNewTier(current);
      setOpen(true);
    }
  }, [user?.id, profile?.tier, isLoadingPrivate]);

  useEffect(() => {
    if (!open) return;
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 5500);
    return () => clearTimeout(t);
  }, [open]);

  if (!newTier) return null;

  const label = TIER_CONFIG[newTier].label;

  return (
    <>
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[220]">
          <Confetti
            width={typeof window !== "undefined" ? window.innerWidth : 400}
            height={typeof window !== "undefined" ? window.innerHeight : 600}
            recycle={false}
            numberOfPieces={280}
            gravity={0.22}
            colors={CONFETTI_COLORS}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent className="z-[210] max-w-md overflow-hidden border-2 border-border bg-card shadow-2xl sm:rounded-2xl">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-90"
            aria-hidden
          >
            <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-brand-primary/25 blur-3xl animate-pulse" />
            <div
              className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-purple-500/20 blur-3xl animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
          </div>

          <DialogHeader className="space-y-3 text-center sm:text-center">
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/15 ring-2 ring-brand-primary/40 shadow-[0_0_28px_rgba(var(--theme-primary-rgb),0.45)]"
            >
              <TierGlyph tier={newTier} size="xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.35, ease: "easeOut" }}
            >
              <DialogTitle className="font-display text-2xl font-black tracking-tight text-foreground dark:text-white">
                Rank up!
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-1 text-center text-base text-muted-foreground">
                <p className="flex flex-wrap items-center justify-center gap-2 font-mono text-sm font-bold uppercase tracking-wide text-foreground dark:text-white">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand-primary motion-safe:animate-pulse" aria-hidden />
                  You&apos;re now{" "}
                  <span className="bg-gradient-to-r from-brand-primary to-purple-400 bg-clip-text text-transparent">
                    {label}
                  </span>
                </p>
                <p className="text-sm leading-relaxed">
                  New perks, gigs, and shop drops may be unlocked — go claim what you&apos;ve
                  earned.
                </p>
              </DialogDescription>
            </motion.div>
          </DialogHeader>

          <DialogFooter className="sm:justify-center">
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              whileTap={{ scale: 0.98 }}
              onClick={dismiss}
              className="w-full rounded-xl bg-brand-primary px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.35)] transition-opacity hover:opacity-95 sm:w-auto"
            >
              Let&apos;s go
            </motion.button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
