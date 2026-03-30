"use client";

import { useState, useEffect } from "react";
import { ChevronRight, CheckCircle2, Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  DEFAULT_VERIFICATION_STEPS,
  VERIFICATION_STEP_KEYS,
  VERIFICATION_STEP_LABELS,
  type VerificationSteps,
  type Profile,
} from "@/lib/types";
import { syncVerificationStep } from "@/app/actions/user";
import { toast } from "sonner";

function getSteps(profile: Profile | null): VerificationSteps {
  const raw = profile?.verification_steps;
  if (raw && typeof raw === "object") {
    return { ...DEFAULT_VERIFICATION_STEPS, ...raw } as VerificationSteps;
  }
  return DEFAULT_VERIFICATION_STEPS;
}

export function VerificationDrawer() {
  const { profile, user, refetchPrivate } = useAppDataContext();
  const steps = getSteps(profile);
  const [expandedStep, setExpandedStep] = useState<keyof VerificationSteps | null>(null);
  const [savingStep, setSavingStep] = useState<keyof VerificationSteps | null>(null);

  const completed = VERIFICATION_STEP_KEYS.filter((k) => steps[k]);
  const pending = VERIFICATION_STEP_KEYS.filter((k) => !steps[k]);
  const total = VERIFICATION_STEP_KEYS.length;
  const completedCount = completed.length;

  const handleSave = async (
    stepKey: keyof VerificationSteps,
    payload: Record<string, unknown>
  ) => {
    if (!user?.id) return;
    setSavingStep(stepKey);
    try {
      const result = await syncVerificationStep(user.id, stepKey, payload);
      if (result.success) {
        toast.success("Saved!");
        await refetchPrivate?.();
        setExpandedStep(null);
      } else {
        toast.error(result.error ?? "Failed to save");
      }
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setSavingStep(null);
    }
  };

  const renderStepForm = (stepKey: keyof VerificationSteps) => (
    <StepFormContent
      stepKey={stepKey}
      profile={profile}
      onSave={handleSave}
      savingStep={savingStep}
    />
  );

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to verify your profile</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-8">
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/20">
            <Sparkles className="h-5 w-5 text-brand-primary" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
            Verify your profile
          </h3>
        </div>
        <div className="relative mb-4">
          <div className="mb-2 flex justify-between">
            <span className="text-sm font-bold text-foreground">
              {completedCount} out of {total} Steps completed
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-border/40 dark:bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-primary to-purple-500 transition-all duration-700"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            {VERIFICATION_STEP_KEYS.map((key, i) => {
              const isDone = steps[key];
              return (
                <div
                  key={key}
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all",
                    isDone
                      ? "bg-brand-primary text-white shadow-[0_0_8px_rgba(var(--theme-primary-rgb),0.5)]"
                      : "border-border bg-card opacity-50"
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-brand-primary" />
          <div>
            <p className="text-xs font-black text-foreground">Rank higher</p>
            <p className="text-[10px] text-muted-foreground">
              Rank higher as an applicant when applying to GIGS
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Accordion - All steps */}
      <div className="mb-6">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Steps to verify your profile
        </h4>
        <div className="flex flex-col gap-2">
          {VERIFICATION_STEP_KEYS.map((key) => {
            const isDone = steps[key];
            const isExpanded = expandedStep === key;
            return (
              <div
                key={key}
                className={cn(
                  "overflow-hidden rounded-xl border transition-all",
                  isDone
                    ? "border-brand-primary/20 bg-brand-primary/5"
                    : "border-border bg-card hover:border-brand-primary/30 hover:bg-brand-primary/5"
                )}
              >
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isDone
                        ? "bg-brand-primary/20"
                        : "border border-white/20 bg-white/5"
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4",
                        isDone ? "text-brand-primary" : "text-muted-foreground/50"
                      )}
                    />
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">
                    {VERIFICATION_STEP_LABELS[key]}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="border-t border-border bg-muted/40 px-4 py-4 dark:border-white/10 dark:bg-black/20">
                    {renderStepForm(key)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {completedCount === total && (
        <div className="rounded-2xl border border-brand-primary/30 bg-brand-primary/10 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-brand-primary" />
          <p className="text-xl font-black text-foreground">All verified!</p>
          <p className="text-xs text-muted-foreground">
            You rank higher in gig applications
          </p>
        </div>
      )}
    </div>
  );
}

const BASE_INPUT =
  "w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 dark:border-white/10 dark:bg-black/50";
const BASE_BTN =
  "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-[var(--theme-primary)] py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50";

function StepFormContent({
  stepKey,
  profile,
  onSave,
  savingStep,
}: {
  stepKey: keyof VerificationSteps;
  profile: Profile | null;
  onSave: (k: keyof VerificationSteps, p: Record<string, unknown>) => void;
  savingStep: keyof VerificationSteps | null;
}) {
  const saving = savingStep === stepKey;

  switch (stepKey) {
    case "added_school":
      return (
        <AddedSchoolForm
          profile={profile}
          onSave={(p) => onSave("added_school", p)}
          saving={saving}
        />
      );
    case "has_avatar":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Upload a profile picture. (Storage integration placeholder)
          </p>
          <input type="file" accept="image/*" className={BASE_INPUT} disabled />
          <button
            onClick={() => onSave("has_avatar", { avatar_url: profile?.avatar_url ?? "" })}
            disabled={saving || !profile?.avatar_url}
            className={BASE_BTN}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      );
    case "added_skills":
      return (
        <TagInputForm
          profile={profile}
          fieldKey="skills"
          label="Skills (comma-separated, e.g. Design, React, Marketing)"
          onSave={(p) => onSave("added_skills", p)}
          saving={saving}
        />
      );
    case "added_interests":
      return (
        <TagInputForm
          profile={profile}
          fieldKey="interests"
          label="Interests (comma-separated)"
          onSave={(p) => onSave("added_interests", p)}
          saving={saving}
        />
      );
    case "has_resume":
      return (
        <UrlInputForm
          placeholder="Resume URL (e.g. Google Drive link)"
          defaultValue={profile?.resume_url ?? ""}
          onSave={(url) => onSave("has_resume", { resume_url: url })}
          saving={saving}
        />
      );
    case "added_portfolio":
      return (
        <UrlInputForm
          placeholder="Portfolio URL (e.g. Behance, personal site)"
          defaultValue={profile?.portfolio_url ?? ""}
          onSave={(url) => onSave("added_portfolio", { portfolio_url: url })}
          saving={saving}
        />
      );
    case "phone_verified":
    case "email_verified":
    case "followed_brands":
    case "answered_questions":
    default:
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            This step requires external verification. (Placeholder)
          </p>
          <button
            onClick={() => onSave(stepKey, {})}
            disabled={saving}
            className={BASE_BTN}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark as done
          </button>
        </div>
      );
  }
}

function AddedSchoolForm({
  profile,
  onSave,
  saving,
}: {
  profile: Profile | null;
  onSave: (p: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [school, setSchool] = useState(profile?.campus ?? "");
  const [gradYear, setGradYear] = useState(
    profile?.graduation_year != null ? String(profile.graduation_year) : ""
  );
  useEffect(() => {
    if (profile) {
      setSchool(profile.campus ?? "");
      setGradYear(profile.graduation_year != null ? String(profile.graduation_year) : "");
    }
  }, [profile?.campus, profile?.graduation_year]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="School (e.g. UCLA)"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        className={BASE_INPUT}
      />
      <input
        type="text"
        placeholder="Graduation Year (e.g. 2026)"
        value={gradYear}
        onChange={(e) => setGradYear(e.target.value)}
        className={BASE_INPUT}
      />
      <button
        onClick={() => onSave({ campus: school, graduation_year: gradYear })}
        disabled={saving}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save
      </button>
    </div>
  );
}

function TagInputForm({
  profile,
  fieldKey,
  label,
  onSave,
  saving,
}: {
  profile: Profile | null;
  fieldKey: string;
  label: string;
  onSave: (p: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const raw = (profile as Record<string, unknown>)?.[fieldKey];
  const arr = Array.isArray(raw) ? raw : [];
  const initial = arr.map(String).filter(Boolean).join(", ");
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (profile) {
      const r = (profile as Record<string, unknown>)?.[fieldKey];
      const a = Array.isArray(r) ? r : [];
      setValue(a.map(String).filter(Boolean).join(", "));
    }
  }, [profile, fieldKey]);

  const handleSave = () => {
    const list = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave({ [fieldKey]: list });
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder={label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={BASE_INPUT}
      />
      <button onClick={handleSave} disabled={saving} className={BASE_BTN}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save
      </button>
    </div>
  );
}

function UrlInputForm({
  placeholder,
  defaultValue,
  onSave,
  saving,
}: {
  placeholder: string;
  defaultValue: string;
  onSave: (url: string) => void;
  saving: boolean;
}) {
  const [url, setUrl] = useState(defaultValue);
  useEffect(() => {
    setUrl(defaultValue);
  }, [defaultValue]);

  return (
    <div className="space-y-3">
      <input
        type="url"
        placeholder={placeholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className={BASE_INPUT}
      />
      <button onClick={() => onSave(url)} disabled={saving} className={BASE_BTN}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save
      </button>
    </div>
  );
}
