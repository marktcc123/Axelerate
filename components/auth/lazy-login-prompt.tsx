"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type LoginPromptVariant = "default" | "onboarding";

interface LazyLoginPromptProps {
  /** `onboarding`: light card on landing/auth sheet, aligned with app theme tokens */
  variant?: LoginPromptVariant;
}

export function LazyLoginPrompt({ variant = "default" }: LazyLoginPromptProps) {
  const isOnboarding = variant === "onboarding";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const supabase = createClient();

  const handleGoogleLogin = () => {
    if (!agreedToTerms) return;
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
  };

  const handleResetIntro = () => {
    try {
      localStorage.removeItem("axelerate_has_seen_intro");
      window.location.reload();
    } catch {}
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-sm flex-col items-center py-8 text-center duration-300 animate-in fade-in zoom-in",
          isOnboarding && "font-mono"
        )}
      >
        <div
          className={cn(
            "mb-4 flex h-20 w-20 items-center justify-center",
            isOnboarding
              ? "rounded-2xl border-2 border-border bg-brand-primary/15 shadow-sm dark:border-white/10"
              : "rounded-full bg-brand-primary/10 ring-2 ring-brand-primary/20"
          )}
        >
          <span className="text-3xl">✨</span>
        </div>
        <h3 className="mb-2 text-lg font-bold text-foreground">Check your email</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          We sent a magic link to <strong className="text-foreground">{email}</strong>
        </p>
        <button
          type="button"
          onClick={handleResetIntro}
          className={cn(
            "relative z-10 -m-2 cursor-pointer self-end px-3 py-2 text-[10px] transition-colors",
            isOnboarding
              ? "font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Reset Intro
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center py-8 text-center",
        isOnboarding && "font-mono"
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-border bg-muted/50 dark:border-white/10 dark:bg-white/5",
          !isOnboarding && "rounded-full border-0 bg-brand-primary/10 ring-2 ring-brand-primary/20"
        )}
      >
        <User className="h-10 w-10 text-brand-primary" />
      </div>
      <h2 className="mb-1 text-xl font-bold tracking-tight text-foreground">Unlock Axelerate</h2>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Choose how you want to sign in</p>

      <label
        className={cn(
          "mb-4 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-muted/40 p-3 text-left transition-colors dark:border-white/10 dark:bg-white/5",
          !agreedToTerms && "ring-2 ring-brand-primary/30 ring-offset-2 ring-offset-background"
        )}
      >
        <Checkbox
          checked={agreedToTerms}
          onCheckedChange={(v) => setAgreedToTerms(v === true)}
          className="mt-0.5 shrink-0 border-border data-[state=checked]:border-brand-primary data-[state=checked]:bg-brand-primary"
        />
        <span className="text-xs text-muted-foreground">
          I agree to the Terms of Service and Privacy Policy. I understand that by joining, I am an{" "}
          <strong className="font-bold text-foreground">Independent Contractor</strong> of Axelerate
          Inc. (Walnut, CA).
        </span>
      </label>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={!agreedToTerms}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card px-6 py-3.5 text-sm font-bold text-foreground transition-all hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>

      <div className="relative my-6 w-full">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span
            className={cn(
              "bg-background px-3 text-muted-foreground",
              isOnboarding && "font-mono font-bold"
            )}
          >
            Or use email
          </span>
        </div>
      </div>

      <form onSubmit={handleMagicLinkLogin} className="w-full space-y-3">
        <input
          type="email"
          placeholder="your.school@edu.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={cn(
            "w-full rounded-2xl border-2 border-border bg-background px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:border-white/10 dark:bg-zinc-900",
            isOnboarding && "font-mono"
          )}
        />
        <button
          type="submit"
          disabled={loading || !agreedToTerms}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-brand-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
        >
          {loading ? "Sending..." : "Send Magic Link"}
        </button>
      </form>
      <button
        type="button"
        onClick={handleResetIntro}
        className={cn(
          "relative z-10 -mb-2 -mr-2 mt-6 cursor-pointer self-end px-3 py-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground",
          isOnboarding && "font-mono font-bold uppercase tracking-widest"
        )}
      >
        Reset Intro
      </button>
    </div>
  );
}
