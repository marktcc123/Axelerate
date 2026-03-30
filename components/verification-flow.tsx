"use client";

import React from "react"

import { useState } from "react";
import {
  Phone,
  Mail,
  Shield,
  Check,
  ChevronRight,
  AlertCircle,
  Lock,
  Fingerprint,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  Globe,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VerificationLevel, WalletType } from "@/lib/data";
import { VERIFICATION_LEVELS } from "@/lib/data";

interface VerificationFlowProps {
  onComplete: (level: VerificationLevel, walletType: WalletType) => void;
  initialLevel?: VerificationLevel;
}

type Step =
  | "overview"
  | "phone-input"
  | "otp-verify"
  | "edu-input"
  | "edu-verify"
  | "work-auth"
  | "ssn-input"
  | "points-only"
  | "complete";

export function VerificationFlow({
  onComplete,
  initialLevel = 1,
}: VerificationFlowProps) {
  const [step, setStep] = useState<Step>("overview");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [eduEmail, setEduEmail] = useState("");
  const [ssn, setSsn] = useState("");
  const [showSsn, setShowSsn] = useState(false);
  const [currentLevel, setCurrentLevel] =
    useState<VerificationLevel>(initialLevel);
  const [walletType, setWalletType] = useState<WalletType>("points");
  const [isLoading, setIsLoading] = useState(false);

  const simulateVerify = (callback: () => void) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      callback();
    }, 1500);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    // Auto-focus next
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handlePhoneSubmit = () => {
    if (phone.length >= 10) {
      simulateVerify(() => setStep("otp-verify"));
    }
  };

  const handleOtpSubmit = () => {
    if (otp.every((d) => d !== "")) {
      simulateVerify(() => {
        setCurrentLevel(1);
        setStep("edu-input");
      });
    }
  };

  const handleEduSubmit = () => {
    if (eduEmail.includes(".edu")) {
      simulateVerify(() => setStep("edu-verify"));
    }
  };

  const handleEduVerified = () => {
    simulateVerify(() => {
      setCurrentLevel(2);
      setStep("work-auth");
    });
  };

  const handleWorkAuth = (authorized: boolean) => {
    if (authorized) {
      setWalletType("cash");
      setStep("ssn-input");
    } else {
      setWalletType("points");
      setStep("points-only");
    }
  };

  const handleSsnSubmit = () => {
    if (ssn.length >= 4) {
      simulateVerify(() => {
        setCurrentLevel(3);
        setStep("complete");
      });
    }
  };

  const handlePointsAcknowledge = () => {
    setCurrentLevel(3);
    setStep("complete");
  };

  const handleFinish = () => {
    onComplete(currentLevel, walletType);
  };

  // Overview screen
  if (step === "overview") {
    return (
      <div className="flex min-h-[80vh] flex-col pb-8">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-primary">
            <Shield className="h-3 w-3" />
            Trust & Safety
          </div>
          <h1 className="mb-2 text-3xl font-black uppercase tracking-tight text-foreground">
            Get Verified
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Unlock more gigs and higher pay by verifying your identity. Each
            level opens new opportunities.
          </p>
        </header>

        {/* Level cards */}
        <div className="flex flex-col gap-3">
          {([1, 2, 3] as VerificationLevel[]).map((level) => {
            const config = VERIFICATION_LEVELS[level];
            const isUnlocked = currentLevel >= level;
            const isNext = level === currentLevel + 1 || (currentLevel < 1 && level === 1);
            return (
              <div
                key={level}
                className={cn(
                  "relative overflow-hidden rounded-2xl border p-4 transition-all",
                  isUnlocked
                    ? "border-brand-primary/30 bg-brand-primary/5"
                    : isNext
                      ? "border-border bg-card"
                      : "border-border bg-card opacity-50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      isUnlocked
                        ? "bg-brand-primary text-white"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {isUnlocked ? (
                      <Check className="h-5 w-5" />
                    ) : level === 1 ? (
                      <Phone className="h-5 w-5" />
                    ) : level === 2 ? (
                      <Mail className="h-5 w-5" />
                    ) : (
                      <Fingerprint className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Level {level}
                      </span>
                      {isUnlocked && (
                        <span className="rounded-full bg-brand-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase text-brand-primary">
                          Verified
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      {config.label}
                    </h3>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {config.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {config.unlocks.map((unlock) => (
                        <span
                          key={unlock}
                          className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                        >
                          {unlock}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={() => setStep("phone-input")}
            className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 text-base font-black uppercase tracking-wider text-brand-primary-foreground transition-all active:scale-[0.98]"
          >
            Start Verification
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => onComplete(1, "points")}
            className="mt-3 w-full py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now (browse only)
          </button>
        </div>
      </div>
    );
  }

  // Phone input
  if (step === "phone-input") {
    return (
      <StepWrapper
        level={1}
        title="Phone Verification"
        subtitle="We'll send a 6-digit code to verify your number."
        onBack={() => setStep("overview")}
      >
        <div className="mb-6">
          <label
            htmlFor="phone"
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Phone Number
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 focus-within:border-brand-primary/50 focus-within:ring-1 focus-within:ring-brand-primary/20">
            <span className="text-sm text-muted-foreground">+1</span>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="(555) 000-0000"
              maxLength={10}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <button
          onClick={handlePhoneSubmit}
          disabled={phone.length < 10 || isLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
            phone.length >= 10
              ? "bg-brand-primary text-white active:scale-[0.98]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Send Code
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </StepWrapper>
    );
  }

  // OTP verification
  if (step === "otp-verify") {
    return (
      <StepWrapper
        level={1}
        title="Enter Code"
        subtitle={`We sent a code to +1 ${phone.slice(0, 3)}***${phone.slice(-2)}`}
        onBack={() => setStep("phone-input")}
      >
        <div className="mb-8 flex justify-center gap-3">
          {otp.map((digit, i) => (
            <input
              key={`otp-field-${i}`}
              id={`otp-${i}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              className={cn(
                "h-14 w-11 rounded-xl border bg-card text-center text-xl font-black text-foreground outline-none transition-all",
                digit
                  ? "border-brand-primary/50 ring-1 ring-brand-primary/20"
                  : "border-border"
              )}
            />
          ))}
        </div>
        <button
          onClick={handleOtpSubmit}
          disabled={!otp.every((d) => d !== "") || isLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
            otp.every((d) => d !== "")
              ? "bg-brand-primary text-white active:scale-[0.98]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Verify
              <Check className="h-4 w-4" />
            </>
          )}
        </button>
        <button className="mt-4 w-full text-center text-xs font-medium text-muted-foreground hover:text-brand-primary">
          Resend code
        </button>
      </StepWrapper>
    );
  }

  // .edu Email input
  if (step === "edu-input") {
    return (
      <StepWrapper
        level={2}
        title="Student Verification"
        subtitle="Link your .edu email to unlock the Perks Shop and digital tasks."
        onBack={() => setStep("overview")}
      >
        <div className="mb-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p className="text-xs text-foreground">
              Level 1 complete - phone verified
            </p>
          </div>
        </div>
        <div className="mb-6">
          <label
            htmlFor="edu-email"
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            University Email
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 focus-within:border-brand-primary/50 focus-within:ring-1 focus-within:ring-brand-primary/20">
            <input
              id="edu-email"
              type="email"
              value={eduEmail}
              onChange={(e) => setEduEmail(e.target.value)}
              placeholder="you@university.edu"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          {eduEmail && !eduEmail.includes(".edu") && (
            <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              Must be a .edu email address
            </p>
          )}
        </div>
        <button
          onClick={handleEduSubmit}
          disabled={!eduEmail.includes(".edu") || isLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
            eduEmail.includes(".edu")
              ? "bg-brand-primary text-white active:scale-[0.98]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Send Verification Link
              <Mail className="h-4 w-4" />
            </>
          )}
        </button>
      </StepWrapper>
    );
  }

  // .edu pending verification
  if (step === "edu-verify") {
    return (
      <StepWrapper
        level={2}
        title="Check Your Inbox"
        subtitle={`We sent a verification link to ${eduEmail}`}
        onBack={() => setStep("edu-input")}
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
            <Mail className="h-8 w-8 text-brand-primary" />
          </div>
          <p className="mb-1 text-sm font-medium text-foreground">
            Click the link in your email
          </p>
          <p className="text-xs text-muted-foreground">
            This verifies you are a current student
          </p>
        </div>
        {/* Simulate clicking the link */}
        <button
          onClick={handleEduVerified}
          disabled={isLoading}
          className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 text-sm font-black uppercase tracking-wider text-brand-primary-foreground transition-all active:scale-[0.98]"
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              I Verified My Email
              <Check className="h-4 w-4" />
            </>
          )}
        </button>
        <button className="mt-4 w-full text-center text-xs font-medium text-muted-foreground hover:text-brand-primary">
          Resend email
        </button>
      </StepWrapper>
    );
  }

  // F-1 Compliance - Work Authorization question
  if (step === "work-auth") {
    return (
      <StepWrapper
        level={3}
        title="Work Authorization"
        subtitle="This helps us show you the right opportunities."
        onBack={() => setStep("overview")}
      >
        <div className="mb-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p className="text-xs text-foreground">
              Level 2 complete - student verified
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-brand-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Are you authorized to work in the US?
            </h3>
          </div>
          <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
            This determines which gig types and payment methods are available to
            you. Your answer is kept private and secure.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleWorkAuth(true)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-brand-primary/30 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
                <Check className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Yes, I am authorized
                </p>
                <p className="text-xs text-muted-foreground">
                  US citizen, permanent resident, or valid work permit
                </p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>

            <button
              onClick={() => handleWorkAuth(false)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-brand-primary/30 active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  No, international student
                </p>
                <p className="text-xs text-muted-foreground">
                  F-1, J-1, or other student visa
                </p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-secondary p-3">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Your information is encrypted and never shared with third parties.
            We use this solely to ensure legal compliance.
          </p>
        </div>
      </StepWrapper>
    );
  }

  // SSN input (for work-authorized users)
  if (step === "ssn-input") {
    return (
      <StepWrapper
        level={3}
        title="Identity Verification"
        subtitle="Required for cash payouts. Secured by Stripe Identity."
        onBack={() => setStep("work-auth")}
      >
        <div className="mb-6">
          <label
            htmlFor="ssn"
            className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            Last 4 digits of SSN
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 focus-within:border-brand-primary/50 focus-within:ring-1 focus-within:ring-brand-primary/20">
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
            <input
              id="ssn"
              type={showSsn ? "text" : "password"}
              value={ssn}
              onChange={(e) => setSsn(e.target.value.replace(/\D/g, ""))}
              placeholder="****"
              maxLength={4}
              className="flex-1 bg-transparent font-mono text-lg tracking-[0.5em] text-foreground outline-none placeholder:text-muted-foreground/50 placeholder:tracking-[0.5em]"
            />
            <button
              onClick={() => setShowSsn(!showSsn)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={showSsn ? "Hide SSN" : "Show SSN"}
            >
              {showSsn ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-secondary p-3">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Verified through Stripe Identity. We never store your full SSN.
            </p>
          </div>
        </div>
        <button
          onClick={handleSsnSubmit}
          disabled={ssn.length < 4 || isLoading}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-wider transition-all",
            ssn.length >= 4
              ? "bg-brand-primary text-white active:scale-[0.98]"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Verify Identity
              <Shield className="h-4 w-4" />
            </>
          )}
        </button>
      </StepWrapper>
    );
  }

  // Points-only wallet (for international students)
  if (step === "points-only") {
    return (
      <StepWrapper
        level={3}
        title="Points Wallet Enabled"
        subtitle=""
        onBack={() => setStep("work-auth")}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
            <Sparkles className="h-8 w-8 text-brand-primary" />
          </div>
          <h3 className="mb-2 text-lg font-black text-foreground">
            {"You're all set!"}
          </h3>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
            <p className="text-sm font-medium text-foreground">
              As an international student, you can earn exclusive products and
              experiences, but cash gigs are disabled to protect your visa
              status.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-brand-primary" />
              Earn points from digital tasks
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-brand-primary" />
              Redeem in the Perks Shop
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-brand-primary" />
              Send gifts to friends
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-brand-primary" />
              Build your marketing resume
            </div>
          </div>
        </div>

        <button
          onClick={handlePointsAcknowledge}
          className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary py-4 text-sm font-black uppercase tracking-wider text-brand-primary-foreground transition-all active:scale-[0.98]"
        >
          Got It
          <ArrowRight className="h-4 w-4" />
        </button>
      </StepWrapper>
    );
  }

  // Complete
  if (step === "complete") {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <div className="animate-count-up mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-primary">
          <Check className="h-10 w-10 text-brand-primary-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-black uppercase tracking-tight text-foreground">
          {"You're Verified"}
        </h1>
        <p className="mb-2 text-sm text-muted-foreground">
          Level {currentLevel} -{" "}
          {VERIFICATION_LEVELS[currentLevel].label}
        </p>
        {walletType === "cash" ? (
          <p className="mb-8 text-xs text-brand-primary">
            Cash Wallet enabled - withdraw anytime
          </p>
        ) : (
          <p className="mb-8 text-xs text-brand-primary">
            Points Wallet enabled - redeem in the Perks Shop
          </p>
        )}
        <button
          onClick={handleFinish}
          className="flex items-center gap-2 rounded-2xl bg-brand-primary px-8 py-4 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98]"
        >
          Start Exploring
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return null;
}

// Reusable step wrapper
function StepWrapper({
  level,
  title,
  subtitle,
  onBack,
  children,
}: {
  level: VerificationLevel;
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-slide-up pb-8">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        Back
      </button>

      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-primary">
        Level {level}
      </div>
      <h2 className="mb-1 text-2xl font-black uppercase tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
