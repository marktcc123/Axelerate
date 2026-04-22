"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
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

const subscribeStorage = () => () => {};
function readHasSeenIntroSnapshot(): boolean {
  return getHasSeenIntro();
}

export function OnboardingFlow({ isLoggedIn, onComplete }: OnboardingFlowProps) {
  const [phase, setPhase] = useState<Phase>("splash");
  /** Same-tab localStorage 写入不会触发 store 的 subscribe，用 revision 强刷一帧。 */
  const [storageRev, setStorageRev] = useState(0);
  const hasSeenIntro = useSyncExternalStore(
    subscribeStorage,
    () => {
      void storageRev;
      return readHasSeenIntroSnapshot();
    },
    () => false
  );

  useEffect(() => {
    if (hasSeenIntro && isLoggedIn) {
      onComplete();
    } else if (hasSeenIntro && !isLoggedIn) {
      setPhase("auth");
    }
  }, [hasSeenIntro, isLoggedIn, onComplete]);

  const handleSplashComplete = useCallback(() => {
    setPhase("intro");
  }, []);

  const handleGetStarted = useCallback(() => {
    setHasSeenIntro();
    setStorageRev((n) => n + 1);
    setPhase("auth");
  }, []);

  const handleAuthSuccess = useCallback(() => {
    onComplete();
  }, [onComplete]);

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
