"use client";

import { useState, useEffect } from "react";
import { ChevronRight, CheckCircle2, ShieldCheck, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
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

/** Same string as the profile shell `DrawerTitle` in `app/page.tsx`. */
export const VERIFICATION_DRAWER_PAGE_TITLE = "Verification";

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
        toast.success(
          result.tierUpgraded
            ? "All steps complete — you're now Insider (student tier)!"
            : "Saved!",
        );
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
      user={user}
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
            <ShieldCheck className="h-5 w-5 text-brand-primary" aria-hidden />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
            {VERIFICATION_DRAWER_PAGE_TITLE}
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
          <p className="mt-1 text-sm font-semibold text-brand-primary">
            Guest → Insider unlocked when every step is saved.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You rank higher when applying to gigs.
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
  user,
  onSave,
  savingStep,
}: {
  stepKey: keyof VerificationSteps;
  profile: Profile | null;
  user: SupabaseUser;
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
        <UrlInputForm
          label="Paste a public image URL for your avatar (https://…). You can use a photo host or a direct link."
          placeholder="https://example.com/my-photo.jpg"
          defaultValue={profile?.avatar_url ?? ""}
          onSave={(url) => onSave("has_avatar", { avatar_url: url })}
          saving={saving}
          submitLabel="Save & complete step"
        />
      );
    case "added_skills":
      return (
        <TagInputForm
          profile={profile}
          fieldKey="skills"
          minTags={3}
          label="At least 3 skills, comma-separated"
          placeholder="e.g. Design, React, Marketing"
          onSave={(p) => onSave("added_skills", p)}
          saving={saving}
        />
      );
    case "added_interests":
      return (
        <TagInputForm
          profile={profile}
          fieldKey="interests"
          minTags={3}
          label="At least 3 interests, comma-separated"
          placeholder="e.g. Music, Startups, Fitness"
          onSave={(p) => onSave("added_interests", p)}
          saving={saving}
        />
      );
    case "has_resume":
      return (
        <UrlInputForm
          label="Link to your resume (Google Drive, Dropbox, or personal site)."
          placeholder="https://…"
          defaultValue={profile?.resume_url ?? ""}
          onSave={(url) => onSave("has_resume", { resume_url: url })}
          saving={saving}
          submitLabel="Save & complete step"
        />
      );
    case "added_portfolio":
      return (
        <UrlInputForm
          label="Portfolio or project page."
          placeholder="https://behance.net/… or your site"
          defaultValue={profile?.portfolio_url ?? ""}
          onSave={(url) => onSave("added_portfolio", { portfolio_url: url })}
          saving={saving}
          submitLabel="Save & complete step"
        />
      );
    case "phone_verified":
      return (
        <PhoneVerificationForm
          defaultPhone={profile?.phone ?? ""}
          onSave={(phone) => onSave("phone_verified", { phone })}
          saving={saving}
        />
      );
    case "email_verified":
      return (
        <EmailVerificationForm
          user={user}
          onSave={() => onSave("email_verified", {})}
          saving={saving}
        />
      );
    case "followed_brands":
      return (
        <FollowedBrandsForm
          defaultValue={profile?.followed_brands_list ?? ""}
          onSave={(text) => onSave("followed_brands", { followed_brands_list: text })}
          saving={saving}
        />
      );
    case "answered_questions":
      return (
        <InterviewAnswersForm
          defaultValue={profile?.interview_answers ?? ""}
          onSave={(text) => onSave("answered_questions", { interview_answers: text })}
          saving={saving}
        />
      );
    default:
      return null;
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
        type="button"
        onClick={() => onSave({ campus: school, graduation_year: gradYear })}
        disabled={saving || !school.trim() || !gradYear.trim()}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save & complete step
      </button>
    </div>
  );
}

function PhoneVerificationForm({
  defaultPhone,
  onSave,
  saving,
}: {
  defaultPhone: string;
  onSave: (phone: string) => void;
  saving: boolean;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  useEffect(() => {
    setPhone(defaultPhone);
  }, [defaultPhone]);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        We store your number on your profile. SMS verification can be added later — for now,
        enter the number you use for campus programs.
      </p>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(555) 123-4567"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className={BASE_INPUT}
      />
      <button
        type="button"
        onClick={() => onSave(phone)}
        disabled={saving || phone.replace(/\D/g, "").length < 10}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save & complete step
      </button>
    </div>
  );
}

function EmailVerificationForm({
  user,
  onSave,
  saving,
}: {
  user: SupabaseUser;
  onSave: () => void;
  saving: boolean;
}) {
  const confirmed = Boolean(user.email_confirmed_at);
  const email = user.email ?? "—";

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">We use your sign-in email:</p>
      <p className="break-all rounded-xl border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-foreground dark:border-white/10 dark:bg-black/30">
        {email}
      </p>
      {confirmed ? (
        <button type="button" onClick={onSave} disabled={saving} className={BASE_BTN}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm & complete step
        </button>
      ) : (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
          Open the confirmation link in the email we sent when you signed up. After your email
          shows as confirmed in Supabase Auth, return here and tap the button above (it will
          appear once confirmed).
        </p>
      )}
    </div>
  );
}

function FollowedBrandsForm({
  defaultValue,
  onSave,
  saving,
}: {
  defaultValue: string;
  onSave: (text: string) => void;
  saving: boolean;
}) {
  const [text, setText] = useState(defaultValue);
  useEffect(() => {
    setText(defaultValue);
  }, [defaultValue]);

  const count = text
    .split(/[,，\n]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        List at least <span className="font-semibold text-foreground">5 brands</span> you follow
        on social or shop from (comma or new line separated). This syncs to your profile.
      </p>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Rare Beauty, Glossier, Nike, Apple, Starbucks"
        className={cn(BASE_INPUT, "min-h-[100px] resize-y")}
      />
      <p className="text-[11px] text-muted-foreground">{count} brand(s) detected — need 5+</p>
      <button
        type="button"
        onClick={() => onSave(text)}
        disabled={saving || count < 5}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save & complete step
      </button>
    </div>
  );
}

function InterviewAnswersForm({
  defaultValue,
  onSave,
  saving,
}: {
  defaultValue: string;
  onSave: (text: string) => void;
  saving: boolean;
}) {
  const [text, setText] = useState(defaultValue);
  useEffect(() => {
    setText(defaultValue);
  }, [defaultValue]);

  const len = text.trim().length;
  const min = 60;

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Answer three short prompts in one box (e.g. Why Axelerate? Favorite campaign you’ve
        seen? How do you create content?). Minimum {min} characters — saved to your profile.
      </p>
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="1) … 2) … 3) …"
        className={cn(BASE_INPUT, "min-h-[140px] resize-y")}
      />
      <p className="text-[11px] text-muted-foreground">
        {len}/{min} characters
        {len < min ? " — keep typing" : " — ready"}
      </p>
      <button
        type="button"
        onClick={() => onSave(text)}
        disabled={saving || len < min}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save & complete step
      </button>
    </div>
  );
}

function TagInputForm({
  profile,
  fieldKey,
  label,
  placeholder,
  minTags,
  onSave,
  saving,
}: {
  profile: Profile | null;
  fieldKey: string;
  label: string;
  placeholder?: string;
  minTags: number;
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

  const count = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <input
        type="text"
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={BASE_INPUT}
      />
      <p className="text-[11px] text-muted-foreground">
        {count} tag(s) — need at least {minTags}
      </p>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || count < minTags}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save & complete step
      </button>
    </div>
  );
}

function UrlInputForm({
  label,
  placeholder,
  defaultValue,
  onSave,
  saving,
  submitLabel = "Save & complete step",
}: {
  label?: string;
  placeholder: string;
  defaultValue: string;
  onSave: (url: string) => void;
  saving: boolean;
  submitLabel?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  useEffect(() => {
    setUrl(defaultValue);
  }, [defaultValue]);

  const trimmed = url.trim();
  let looksOk = trimmed.length > 0;
  try {
    const u = new URL(trimmed);
    looksOk = u.protocol === "https:" || u.protocol === "http:";
  } catch {
    looksOk = false;
  }

  return (
    <div className="space-y-3">
      {label ? <p className="text-xs leading-relaxed text-muted-foreground">{label}</p> : null}
      <input
        type="url"
        placeholder={placeholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className={BASE_INPUT}
      />
      <button
        type="button"
        onClick={() => onSave(trimmed)}
        disabled={saving || !looksOk}
        className={BASE_BTN}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}
