"use client";

import { motion } from "framer-motion";
import { LazyLoginPrompt } from "@/components/auth/lazy-login-prompt";

interface AuthWrapperProps {
  show: boolean;
  onSkip?: () => void;
}

export function AuthWrapper({ show, onSkip }: AuthWrapperProps) {
  if (!show) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-background/70 backdrop-blur-md [-webkit-overflow-scrolling:touch] [touch-action:pan-y] dark:bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-end px-0 pt-4">
        <motion.div
          className="w-full max-w-lg rounded-t-3xl border-t-2 border-border bg-card px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-8 text-card-foreground shadow-lg dark:border-white/10 dark:bg-zinc-950"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 32,
          }}
        >
        <LazyLoginPrompt variant="onboarding" />
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mt-6 w-full rounded-xl border border-transparent py-3 text-center font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now (browse only)
          </button>
        )}
        </motion.div>
      </div>
    </motion.div>
  );
}
