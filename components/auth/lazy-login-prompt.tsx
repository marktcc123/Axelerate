"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type LoginPromptVariant = "default" | "onboarding";

interface LazyLoginPromptProps {
  /** `onboarding`: light card on landing/auth sheet, aligned with app theme tokens */
  variant?: LoginPromptVariant;
  /** Absolute path starting with `/`; appended to OAuth / magic-link callback (`?next=`) */
  redirectPath?: string;
}

const STORAGE_TCPA_TERMS_MS = "axelerate_tcpa_terms_accepted_at";
const STORAGE_SMS_OPT_IN = "axelerate_sms_marketing_opt_in_pending";

/** Set true to show optional SMS marketing checkbox again */
const SHOW_SMS_OPT_IN_CHECKBOX = false;

export function LazyLoginPrompt({
  variant = "default",
  redirectPath,
}: LazyLoginPromptProps) {
  const isOnboarding = variant === "onboarding";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isSmsAccepted, setIsSmsAccepted] = useState(false);
  /** Plays neo-brutal red border shake when user tries OAuth / magic link without accepting terms */
  const [termsRemind, setTermsRemind] = useState(false);

  useEffect(() => {
    if (!termsRemind) return;
    const t = window.setTimeout(() => setTermsRemind(false), 620);
    return () => window.clearTimeout(t);
  }, [termsRemind]);

  const pokeTermsReminder = useCallback(() => {
    setTermsRemind(false);
    queueMicrotask(() => setTermsRemind(true));
  }, []);

  const supabase = createClient();

  const nextQuery =
    redirectPath &&
    redirectPath.startsWith("/") &&
    !redirectPath.startsWith("//") &&
    !redirectPath.includes("://") ?
      `?next=${encodeURIComponent(redirectPath)}`
    : "";

  const callbackUrl = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/auth/callback${nextQuery}`;

  const stashAuthComplianceFlags = () => {
    try {
      const iso = new Date().toISOString();
      sessionStorage.setItem(STORAGE_TCPA_TERMS_MS, iso);
      sessionStorage.setItem(STORAGE_SMS_OPT_IN, isSmsAccepted ? "1" : "0");
    } catch {
      //
    }
  };

  const handleGoogleLogin = () => {
    if (loading) return;
    if (!isTermsAccepted) {
      pokeTermsReminder();
      return;
    }
    stashAuthComplianceFlags();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });
  };

  const handleResetIntro = () => {
    try {
      localStorage.removeItem("axelerate_has_seen_intro");
      window.location.reload();
    } catch {
      //
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTermsAccepted) {
      pokeTermsReminder();
      return;
    }
    setLoading(true);
    stashAuthComplianceFlags();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl,
        data: {
          sms_marketing_opt_in: isSmsAccepted,
          tcpa_terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      setSent(true);
    }
  };

  const authBlocked = !isTermsAccepted;

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
            isOnboarding ?
              "rounded-2xl border-2 border-border bg-brand-primary/15 shadow-sm dark:border-white/10"
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
            isOnboarding ?
              "font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
            : "text-muted-foreground hover:text-foreground"
          )}
        >
          Reset Intro
        </button>
      </div>
    );
  }

  const linkMutedClass =
    "font-bold text-brand-primary underline decoration-2 underline-offset-2 hover:text-brand-primary/90 dark:text-purple-400 dark:hover:text-purple-300";

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
      <h2 className="mb-1 text-xl font-bold tracking-tight text-foreground">
        Unlock Axelerate
      </h2>
      <p className="mb-6 text-sm font-medium text-muted-foreground">
        Choose how you want to sign in
      </p>

      {/* Required — TCPA / AB5 + consumer + creator acknowledgement */}
      <label
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-muted/35 p-3.5 text-left shadow-[var(--shadow-sm)] outline-none transition-colors dark:border-white/10 dark:bg-zinc-900/85 dark:shadow-none",
          SHOW_SMS_OPT_IN_CHECKBOX ? "mb-3" : "mb-5",
          !isTermsAccepted && "ring-2 ring-brand-primary/25 ring-offset-2 ring-offset-background dark:ring-offset-zinc-950",
          termsRemind && "login-tcpa-terms-remind ring-2 ring-red-500/90 ring-offset-2 ring-offset-background dark:ring-offset-zinc-950"
        )}
      >
        <Checkbox
          checked={isTermsAccepted}
          onCheckedChange={(v) => setIsTermsAccepted(v === true)}
          className="mt-1 h-5 w-5 shrink-0 rounded-lg border-[2px] border-border shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-transform data-[state=checked]:border-brand-primary data-[state=checked]:bg-brand-primary data-[state=checked]:shadow-[3px_3px_0_0_rgba(0,0,0,0.85)] dark:border-white/20 dark:data-[state=checked]:shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
        />
        <span className={cn("text-xs leading-relaxed text-foreground", isOnboarding ? "tracking-tight" : "")}>
          I agree to the{" "}
          <Link href="/terms" className={linkMutedClass} target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className={linkMutedClass} target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          . I acknowledge that if I participate in paid gigs or campaigns, I do so as an{" "}
          <strong className="font-semibold text-foreground">Independent Contractor</strong>, not an
          employee.
        </span>
      </label>

      {/* Optional TCPA SMS consent — gated while product pauses SMS collection */}
      {SHOW_SMS_OPT_IN_CHECKBOX && (
      <label className="mb-5 flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-3 text-left dark:border-white/10 dark:bg-zinc-900/55">
        <Checkbox
          checked={isSmsAccepted}
          onCheckedChange={(v) => setIsSmsAccepted(v === true)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-border dark:border-white/15 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
        />
        <span className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground/80">(Optional)</span> Send me SMS drops and
          exclusive gig alerts. Msg &amp; data rates may apply.
        </span>
      </label>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleLogin}
        aria-disabled={authBlocked || loading}
        className={cn(
          "flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card px-6 py-3.5 text-sm font-bold text-foreground shadow-[var(--shadow-sm)] transition-all hover:bg-muted/60 hover:brightness-[1.02] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-white/15 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:active:translate-x-[2px] dark:active:translate-y-[2px]",
          authBlocked && "cursor-not-allowed opacity-50 saturate-75",
          loading && "cursor-wait opacity-70"
        )}
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
          <span className="w-full border-t border-border dark:border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span
            className={cn(
              "bg-background px-3 text-muted-foreground dark:bg-zinc-950",
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
            "w-full rounded-2xl border-2 border-border bg-background px-4 py-3.5 text-sm text-foreground shadow-[var(--shadow-sm)] placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/50 dark:border-white/10 dark:bg-zinc-900 dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]",
            isOnboarding && "font-mono"
          )}
        />
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-brand-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:opacity-95 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-wait dark:border-white/10 dark:shadow-[4px_4px_0_0_rgba(0,0,0,1)]",
            authBlocked && "cursor-not-allowed opacity-50 saturate-75",
            loading && "opacity-70"
          )}
        >
          {loading ? "Sending..." : "SEND MAGIC LINK"}
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
