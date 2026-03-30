"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SplashScreen } from "./splash-screen";
import { AuthWrapper } from "./auth-wrapper";
import { BrutalLandingPage } from "@/components/landing/brutal-landing-page";

const STORAGE_KEY = "axelerate_has_seen_intro";

function getHasSeenIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setHasSeenIntro(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
}

type Phase = "splash" | "intro" | "auth" | "done";

interface OnboardingFlowProps {
  isLoggedIn: boolean;
  onComplete: () => void;
}

export function OnboardingFlow({ isLoggedIn, onComplete }: OnboardingFlowProps) {
  const [phase, setPhase] = useState<Phase>("splash");
  const [hasSeenIntro, setHasSeenIntroState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const seen = getHasSeenIntro();
    setHasSeenIntroState(seen);
    if (seen && isLoggedIn) {
      onComplete();
    } else if (seen && !isLoggedIn) {
      setPhase("auth");
    }
  }, [mounted, isLoggedIn, onComplete]);

  const handleSplashComplete = useCallback(() => {
    setPhase("intro");
  }, []);

  const handleGetStarted = useCallback(() => {
    setHasSeenIntro();
    setHasSeenIntroState(true);
    setPhase("auth");
  }, []);

  const handleAuthSuccess = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-2 w-20 animate-pulse rounded-full bg-brand-primary/40" />
      </div>
    );
  }

  if (hasSeenIntro && isLoggedIn) {
    return null;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === "splash" && (
          <SplashScreen key="splash" onComplete={handleSplashComplete} />
        )}
        {phase === "intro" && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-40 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          >
            <BrutalLandingPage onGetStarted={handleGetStarted} />
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "auth" && (
        <AuthWrapper show={true} onSkip={onComplete} />
      )}
    </>
  );
}
