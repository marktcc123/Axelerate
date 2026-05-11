"use client";

import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  DEFAULT_VERIFICATION_STEPS,
  VERIFICATION_STEP_KEYS,
  type VerificationSteps,
  type Profile,
} from "@/lib/types";
import { syncVerificationStep, resetSyndicateVerificationProgress } from "@/app/actions/user";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Same string as the profile shell `DrawerTitle` in `app/page.tsx`. */
export const VERIFICATION_DRAWER_PAGE_TITLE = "Syndicate Access Protocol";

function getSteps(profile: Profile | null): VerificationSteps {
  const raw = profile?.verification_steps;
  if (raw && typeof raw === "object") {
    return { ...DEFAULT_VERIFICATION_STEPS, ...raw } as VerificationSteps;
  }
  return DEFAULT_VERIFICATION_STEPS;
}

type AccessMissionId =
  | "identity"
  | "campus"
  | "creator_persona"
  | "clout"
  | "algorithm_sync"
  | "vibe_check";

const ACCESS_MISSIONS: {
  id: AccessMissionId;
  title: string;
  subtitle: string;
  subSteps: (keyof VerificationSteps)[];
}[] = [
  {
    id: "identity",
    title: "Mission 1: Identity Link",
    subtitle:
      "Verify your email and phone. (Use a .edu email for fast-track approval).",
    subSteps: ["email_verified", "phone_verified"],
  },
  {
    id: "campus",
    title: "Mission 2: Campus Coordinates",
    subtitle:
      "Lock in your school and graduation year to unlock geo-fenced drops.",
    subSteps: ["added_school"],
  },
  {
    id: "creator_persona",
    title: "Mission 3: Creator Persona",
    subtitle:
      "Upload a profile picture and select your top 3 Hustle Tags (e.g., UGC, Tech, Beauty).",
    subSteps: ["has_avatar", "added_skills", "added_interests"],
  },
  {
    id: "clout",
    title: "Mission 4: Clout Check (No Resumes Allowed)",
    subtitle:
      "Connect your TikTok or Instagram. Your content is your resume.",
    subSteps: ["has_resume", "added_portfolio"],
  },
  {
    id: "algorithm_sync",
    title: "Mission 5: Algorithm Sync",
    subtitle:
      "Follow 5 brands to customize your exclusive Drops feed.",
    subSteps: ["followed_brands"],
  },
  {
    id: "vibe_check",
    title: "Mission 6: The Vibe Check",
    subtitle:
      "Drop a link to your best piece of content or a 15-second intro video.",
    subSteps: ["answered_questions"],
  },
];

const TOTAL_ACCESS_MISSIONS = ACCESS_MISSIONS.length;

function missionSubStepsDone(
  steps: VerificationSteps,
  sub: (keyof VerificationSteps)[]
): boolean {
  return sub.every((k) => steps[k]);
}

function completedMissionsCount(steps: VerificationSteps): number {
  return ACCESS_MISSIONS.filter((m) =>
    missionSubStepsDone(steps, m.subSteps)
  ).length;
}

function allVerificationKeysDone(steps: VerificationSteps): boolean {
  return VERIFICATION_STEP_KEYS.every((k) => steps[k]);
}

const BASE_INPUT =
  "w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground shadow-[2px_2px_0_rgb(0_0_0/0.12)] focus:border-[var(--theme-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 dark:border-white/10 dark:bg-black/50 dark:shadow-[2px_2px_0_rgb(255_255_255/0.06)]";

const BASE_BTN =
  "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-[var(--theme-primary)] py-3 text-sm font-black uppercase tracking-wider text-primary-foreground shadow-[3px_3px_0_rgb(0_0_0)] transition-all hover:brightness-110 hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 dark:border-white/10 dark:shadow-[3px_3px_0_rgb(255_255_255/0.12)]";

export function VerificationDrawer() {
  const { profile, user, refetchPrivate } = useAppDataContext();
  const steps = getSteps(profile);
  const [expandedMission, setExpandedMission] =
    useState<AccessMissionId | null>(null);
  const [savingStep, setSavingStep] = useState<keyof VerificationSteps | null>(
    null
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const missionsDone = completedMissionsCount(steps);
  const syndicateReady = allVerificationKeysDone(steps);

  const handleSave = async (
    stepKey: keyof VerificationSteps,
    payload: Record<string, unknown>
  ): Promise<boolean> => {
    if (!user?.id) return false;
    setSavingStep(stepKey);
    try {
      const result = await syncVerificationStep(stepKey, payload);
      if (result.success) {
        toast.success(
          result.tierUpgraded
            ? "All missions complete — Insider status unlocked."
            : "Locked in!",
        );
        await refetchPrivate?.();
        return true;
      }
      toast.error(result.error ?? "Failed to save");
      return false;
    } catch {
      toast.error("Something went wrong");
      return false;
    } finally {
      setSavingStep(null);
    }
  };

  const handleResetProgress = async () => {
    if (!user?.id) return;
    setResetting(true);
    try {
      const result = await resetSyndicateVerificationProgress();
      if (result.success) {
        toast.success(
          "Progress cleared. Your answers are still here — expand each mission to edit & save again.",
        );
        setResetOpen(false);
        setExpandedMission(null);
        await refetchPrivate?.();
      } else {
        toast.error(result.error ?? "Reset failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResetting(false);
    }
  };

  const handleCloutUnifiedSave = async (url: string) => {
    if (!user?.id) return;
    setSavingStep("added_portfolio");
    try {
      const r1 = await syncVerificationStep("added_portfolio", {
        portfolio_url: url,
      });
      if (!r1.success) {
        toast.error(r1.error ?? "Could not save portfolio link");
        return;
      }
      setSavingStep("has_resume");
      const r2 = await syncVerificationStep("has_resume", {
        resume_url: url,
      });
      if (!r2.success) {
        toast.error(r2.error ?? "Could not save creator link");
        return;
      }
      toast.success(
        r2.tierUpgraded
          ? "All missions complete — Insider status unlocked."
          : "Content link saved — Mission 4 complete.",
      );
      await refetchPrivate?.();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingStep(null);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in to start your access missions
        </p>
      </div>
    );
  }

  const renderStepForm = (stepKey: keyof VerificationSteps) => (
    <StepFormContent
      stepKey={stepKey}
      profile={profile}
      user={user}
      steps={steps}
      onSave={handleSave}
      savingStep={savingStep}
    />
  );

  return (
    <div className="min-w-0 pb-8">
      <div className="mb-6 rounded-2xl border-2 border-brand-primary/25 bg-brand-primary/5 p-5 shadow-[4px_4px_0_rgb(0_0_0/0.25)] dark:shadow-[4px_4px_0_rgb(255_255_255/0.08)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-primary/30 bg-brand-primary/20 shadow-[0_0_14px_rgba(var(--theme-primary-rgb),0.35)]">
            <ShieldCheck className="h-5 w-5 text-brand-primary" aria-hidden />
          </div>
          <h3 className="text-base font-black uppercase tracking-tight text-foreground md:text-lg">
            {VERIFICATION_DRAWER_PAGE_TITLE}
          </h3>
        </div>
        <div className="relative mb-4">
          <div className="mb-2 flex justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
              {missionsDone} out of {TOTAL_ACCESS_MISSIONS} Missions completed
            </span>
          </div>
          <div className="relative h-3.5 w-full overflow-hidden rounded-full border border-border bg-border/40 dark:border-white/10 dark:bg-black/40">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-primary via-purple-500 to-fuchsia-500 transition-all duration-700 shadow-[0_0_14px_rgba(var(--theme-primary-rgb),0.55)]"
              style={{
                width: `${
                  TOTAL_ACCESS_MISSIONS > 0
                    ? (missionsDone / TOTAL_ACCESS_MISSIONS) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="mt-4 flex justify-between gap-1">
            {ACCESS_MISSIONS.map((m, i) => {
              const done = missionSubStepsDone(steps, m.subSteps);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black transition-all",
                    done
                      ? "border-brand-primary bg-brand-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--theme-primary-rgb),0.55)]"
                      : "border-border bg-card text-muted-foreground opacity-70 dark:border-white/15"
                  )}
                  title={m.title}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border-2 border-brand-primary/35 bg-brand-primary/10 px-3 py-2.5">
          <SparklesBadge />
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">View &amp; edit: </span>
          expand any mission to see what&apos;s saved; saving overwrites stored values on your profile.
        </p>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border-2 border-red-500/40 bg-transparent px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-red-600 transition-colors hover:bg-red-500/10 dark:border-red-400/35 dark:text-red-400 dark:hover:bg-red-500/15"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset mission progress
        </button>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="max-w-[min(100vw-2rem,28rem)] border-2 border-border dark:border-white/15">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all mission checks?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>
                  Clears completion markers only. Your answers stay in the inputs — expand missions to review or change them, then save again when ready.
                </p>
                <p className="font-semibold text-foreground dark:text-white">
                  If your tier is Insider (student), you&apos;ll revert to Guest until all missions are complete again.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={resetting}>
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              disabled={resetting}
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl border-2 border-red-600 bg-red-600 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-[3px_3px_0_rgb(0_0_0)] transition-all hover:bg-red-600/90 disabled:opacity-60 dark:border-red-500 dark:bg-red-500"
              onClick={() => void handleResetProgress()}
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Confirm reset"
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-6">
        <h4 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Access missions
        </h4>
        <div className="flex flex-col gap-2">
          {ACCESS_MISSIONS.map((mission) => {
            const missionDone = missionSubStepsDone(steps, mission.subSteps);
            const isExpanded = expandedMission === mission.id;
            return (
              <div
                key={mission.id}
                className={cn(
                  "overflow-hidden rounded-xl border-2 transition-all",
                  missionDone
                    ? "border-brand-primary/35 bg-brand-primary/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-border bg-card hover:border-brand-primary/40 hover:bg-brand-primary/[0.04] dark:border-white/12"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMission(isExpanded ? null : mission.id)
                  }
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      missionDone
                        ? "border-brand-primary/40 bg-brand-primary/20"
                        : "border-white/15 bg-black/30"
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4",
                        missionDone
                          ? "text-brand-primary"
                          : "text-muted-foreground/50"
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-black uppercase tracking-tight text-foreground">
                      {mission.title}
                    </span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {mission.subtitle}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="border-t-2 border-border bg-muted/30 px-4 py-4 dark:border-white/10 dark:bg-black/25">
                    <MissionExpandPanel
                      mission={mission}
                      steps={steps}
                      profile={profile}
                      onSave={handleSave}
                      onCloutUnifiedSave={handleCloutUnifiedSave}
                      savingStep={savingStep}
                      renderStepForm={renderStepForm}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {syndicateReady && (
        <div className="rounded-2xl border-2 border-brand-primary/35 bg-brand-primary/10 p-5 text-center shadow-[4px_4px_0_rgb(0_0_0/0.2)] dark:shadow-[4px_4px_0_rgb(255_255_255/0.06)]">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-brand-primary drop-shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.5)]" />
          <p className="text-lg font-black uppercase tracking-tight text-foreground">
            Syndicate clearance
          </p>
          <p className="mt-2 text-sm font-semibold tracking-tight text-brand-primary">
            Guest → Insider status unlocked.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Drops feed &amp; gigs lean your way — keep your persona fresh.
          </p>
        </div>
      )}
    </div>
  );
}

function SparklesBadge() {
  return (
    <>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-primary" />
      <div className="min-w-0 text-left">
        <p className="text-xs font-black uppercase tracking-wide text-foreground">
          Creator club perks
        </p>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Finish all 6 missions to unlock Insider rank, geo-fenced drops, and
          priority on hot collabs.
        </p>
      </div>
    </>
  );
}

function MissionExpandPanel({
  mission,
  steps,
  profile,
  onSave,
  onCloutUnifiedSave,
  savingStep,
  renderStepForm,
}: {
  mission: (typeof ACCESS_MISSIONS)[number];
  steps: VerificationSteps;
  profile: Profile | null;
  onSave: (k: keyof VerificationSteps, p: Record<string, unknown>) => Promise<boolean>;
  onCloutUnifiedSave: (url: string) => void;
  savingStep: keyof VerificationSteps | null;
  renderStepForm: (stepKey: keyof VerificationSteps) => ReactNode;
}) {
  if (mission.id === "clout") {
    const r = steps.has_resume;
    const p = steps.added_portfolio;

    return (
      <div className="flex flex-col gap-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
          Your links stay on file — edit below anytime and save.
        </p>
        {!r && !p ? (
          <CloutUnifiedForm
            profile={profile}
            onSave={onCloutUnifiedSave}
            saving={Boolean(savingStep)}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border/80 bg-background/40 p-3 dark:border-white/10 dark:bg-black/20">
              {r ? (
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                  Creator link ✓ · edit anytime
                </span>
              ) : (
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-amber-500/95">
                  Add creator URL
                </span>
              )}
              {renderStepForm("has_resume")}
            </div>
            <div className="rounded-xl border border-border/80 bg-background/40 p-3 dark:border-white/10 dark:bg-black/20">
              {p ? (
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-brand-primary">
                  Portfolio / spotlight ✓ · edit anytime
                </span>
              ) : (
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-amber-500/95">
                  Add spotlight URL
                </span>
              )}
              {renderStepForm("added_portfolio")}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        Saved answers appear in the inputs — tweak and tap save to update.
      </p>
      {mission.subSteps.map((stepKey) => (
        <div
          key={stepKey}
          className="rounded-xl border border-border/80 bg-background/40 p-3 dark:border-white/10 dark:bg-black/20"
        >
          {steps[stepKey] ? (
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-brand-primary">
              On file ✓ · edit anytime
            </span>
          ) : (
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-amber-500/95">
              Open — finish this checkpoint
            </span>
          )}
          {renderStepForm(stepKey)}
        </div>
      ))}
    </div>
  );
}

function CloutUnifiedForm({
  profile,
  onSave,
  saving,
}: {
  profile: Profile | null;
  onSave: (url: string) => void;
  saving: boolean;
}) {
  const defaultUrl =
    (profile?.portfolio_url || profile?.resume_url || "").trim();
  const [url, setUrl] = useState(defaultUrl);
  useEffect(() => {
    setUrl((profile?.portfolio_url || profile?.resume_url || "").trim());
  }, [profile?.portfolio_url, profile?.resume_url]);

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
      <p className="text-xs leading-relaxed text-muted-foreground">
        One public link is enough — we&apos;ll use it as your{" "}
        <span className="font-semibold text-foreground">creator profile</span>{" "}
        (TikTok / IG / portfolio). No PDF resumes here.
      </p>
      <input
        type="url"
        placeholder="https://www.tiktok.com/@you or https://instagram.com/you"
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
        Save creator link — complete Mission 4
      </button>
    </div>
  );
}

function StepFormContent({
  stepKey,
  profile,
  user,
  steps,
  onSave,
  savingStep,
}: {
  stepKey: keyof VerificationSteps;
  profile: Profile | null;
  user: SupabaseUser;
  steps: VerificationSteps;
  onSave: (k: keyof VerificationSteps, p: Record<string, unknown>) => Promise<boolean>;
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
          label="Drop a public image URL for your PFP (hosting links or CDN work)."
          placeholder="https://…/photo.jpg"
          defaultValue={profile?.avatar_url ?? ""}
          onSave={(url) => onSave("has_avatar", { avatar_url: url })}
          saving={saving}
          submitLabel="Save & lock persona"
        />
      );
    case "added_skills":
      return (
        <TagInputForm
          profile={profile}
          fieldKey="skills"
          minTags={3}
          label="Hustle Tags (skills) — at least 3, comma-separated."
          placeholder="e.g. UGC, TikTok Editing, Paid Ads"
          onSave={(p) => onSave("added_skills", p)}
          saving={saving}
          submitLabel="Save hustle tags"
        />
      );
    case "added_interests":
      return (
        <TagInputForm
          profile={profile}
          fieldKey="interests"
          minTags={3}
          label="Vibe lanes (interests) — at least 3, comma-separated."
          placeholder="e.g. Streetwear Drops, Indie Music, LATAM Brands"
          onSave={(p) => onSave("added_interests", p)}
          saving={saving}
          submitLabel="Save vibe lanes"
        />
      );
    case "has_resume":
      return (
        <UrlInputForm
          label="Creator link (TikTok / IG profile or portfolio URL). No résumés — your feed is the proof."
          placeholder="https://www.tiktok.com/@you"
          defaultValue={profile?.resume_url ?? ""}
          onSave={(url) => onSave("has_resume", { resume_url: url })}
          saving={saving}
          submitLabel="Save creator link"
        />
      );
    case "added_portfolio":
      return (
        <UrlInputForm
          label="Portfolio, campaign reel, or best single post URL."
          placeholder="https://…"
          defaultValue={profile?.portfolio_url ?? ""}
          onSave={(url) => onSave("added_portfolio", { portfolio_url: url })}
          saving={saving}
          submitLabel="Save spotlight link"
        />
      );
    case "phone_verified":
      return (
        <PhoneVerificationForm
          defaultPhone={profile?.phone ?? ""}
          missionDone={steps.phone_verified}
          onSave={(phone) => onSave("phone_verified", { phone })}
          saving={saving}
        />
      );
    case "email_verified":
      return (
        <EmailVerificationForm
          user={user}
          missionDone={steps.email_verified}
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
        Drop coordinates — lock mission
      </button>
    </div>
  );
}

/** OTP resend countdown (seconds). */
const OTP_RESEND_COOLDOWN_SEC = 60;

type IdentityOtpPhase = "idle" | "awaiting_otp" | "verified";

function normalizePhoneForSms(raw: string): { e164: string; digitsProfile: string } | null {
  const t = raw.trim();
  const d = t.replace(/\D/g, "");
  if (t.startsWith("+")) {
    if (d.length < 10) return null;
    return { e164: `+${d}`, digitsProfile: d };
  }
  if (d.length === 10) {
    return { e164: `+1${d}`, digitsProfile: d };
  }
  if (d.length === 11 && d.startsWith("1")) {
    return { e164: `+${d}`, digitsProfile: d };
  }
  return null;
}

function looksLikeEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * ─── Supabase / Twilio checklist (Mission 1 OTP) ───
 *
 * Dashboard → Authentication → Providers → Email: enable Email + **Email OTP**
 * (6-digit code). If you only enable magic links, `verifyOtp` with type `email`
 * will fail. Adjust **rate limits / hook** under Auth → Policies as needed.
 *
 * Dashboard → Authentication → Providers → **Phone**: turn on SMS; add Twilio
 * (**Account SID**, **Auth Token**, **Messaging Service SID** or Alphanumeric
 * Sender — per Supabase phone docs). Sandbox: use Twilio verified test numbers.
 *
 * Project Settings → Authentication: **Site URL** + **Redirect URLs** for your
 * app (`https://your-domain...`) so redirects from email/SMS flows are allowed.
 *
 * **Logged-in phone link (this UI)**: use `auth.updateUser({ phone })` + `verifyOtp`
 * `{ type: "phone_change" }` so the **same** Auth user / `profiles.id` is preserved.
 * Do **not** use `signInWithOtp({ phone })` here — it can create a second user and
 * break `syncVerificationStep` (session no longer matches your profile row).
 * API error **"Unsupported phone provider"** → GoTrue has no usable SMS gateway.
 * Dashboard: Phone ON + valid Twilio/Vonage credentials required for `updateUser({ phone })`
 * to send OTP — independent of the digits you typed.
 */

/** Map GoTrue SMS errors to a toast line + full inline copy (link in banner). */
function smsAuthErrorPresentation(message: string): { toast: string; banner: string } {
  const m = message.toLowerCase();
  if (m.includes("unsupported phone provider")) {
    const doc = "https://supabase.com/docs/guides/auth/phone-login";
    const banner =
      "Supabase returned “Unsupported phone provider”: the project has no working SMS gateway yet. " +
      "In Dashboard → Authentication → Providers → Phone: turn Phone on and enter Twilio or Vonage credentials (Account SID, Auth token, Messaging Service SID / From number as required). " +
      "Hosted Supabase does not send SMS until this is done — the number you typed is fine. " +
      `Docs: ${doc}`;
    return {
      toast:
        "SMS not wired: enable Phone + add Twilio/Vonage under Supabase Authentication → Providers.",
      banner,
    };
  }
  if (
    m.includes("sms provider") &&
    (m.includes("could not be found") || m.includes("not found"))
  ) {
    const doc = "https://supabase.com/docs/guides/auth/phone-login";
    const banner =
      `${message} — On self‑hosted or local CLI, check config.toml [auth.sms] provider name and keys. Hosted: Dashboard → Providers → Phone. Docs: ${doc}`;
    return { toast: "SMS provider misconfigured — check Supabase Phone provider settings.", banner };
  }
  return { toast: message, banner: message };
}

function NeoOtpSix({
  id,
  value,
  onChange,
  accent,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  accent: "cyan" | "violet";
}) {
  const activeRing =
    accent === "cyan"
      ? "border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.45)] ring-2 ring-cyan-400/90 ring-offset-2 ring-offset-background"
      : "border-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.45)] ring-2 ring-violet-400/90 ring-offset-2 ring-offset-background";

  return (
    <InputOTP
      id={id}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={onChange}
      containerClassName="gap-1.5"
      inputMode="numeric"
      aria-label="6-digit OTP"
      autoComplete="one-time-code"
      render={({ slots }) => (
        <InputOTPGroup className="gap-1.5">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className={cn(
                "relative flex h-11 w-9 shrink-0 items-center justify-center rounded-md border-2 border-white/35 bg-black font-mono text-base font-black text-white shadow-[3px_3px_0_rgb(255_255_255/0.06)] transition-all first:rounded-l-lg first:border-l-[3px] last:rounded-r-lg dark:border-white/25",
                slot.isActive ? activeRing : "hover:border-white/50",
              )}
            >
              {slot.char}
              {slot.hasFakeCaret ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-4 w-px animate-caret-blink bg-white duration-1000" />
                </div>
              ) : null}
            </div>
          ))}
        </InputOTPGroup>
      )}
    />
  );
}

function PhoneVerificationForm({
  defaultPhone,
  missionDone,
  onSave,
  saving,
}: {
  defaultPhone: string;
  missionDone: boolean;
  onSave: (phone: string) => Promise<boolean>;
  saving: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phone, setPhone] = useState(defaultPhone);
  const [phase, setPhase] = useState<IdentityOtpPhase>(missionDone ? "verified" : "idle");
  const [otp, setOtp] = useState("");
  const [pendingE164, setPendingE164] = useState<string | null>(null);
  const [pendingDigits, setPendingDigits] = useState<string | null>(null);
  const [coolLeft, setCoolLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPhone(defaultPhone);
  }, [defaultPhone]);

  useEffect(() => {
    if (missionDone) {
      setPhase("verified");
    } else {
      setPhase("idle");
      setOtp("");
      setPendingE164(null);
      setPendingDigits(null);
      setCoolLeft(0);
      setErr(null);
    }
  }, [missionDone]);

  useEffect(() => {
    if (coolLeft <= 0) return;
    const id = window.setInterval(() => setCoolLeft((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [coolLeft]);

  const parsed = normalizePhoneForSms(phone);

  const sendOtp = async () => {
    const target =
      pendingE164 && pendingDigits ? { e164: pendingE164, digitsProfile: pendingDigits } : parsed;
    if (!target) {
      toast.error(
        "Enter a valid number — 10-digit US format, or international with leading +country code.",
      );
      return;
    }
    /*
     * Logged-in users: `updateUser({ phone })` sends OTP and keeps the same user id.
     * Verify with type `phone_change` — not `sms` (that pairs with `signInWithOtp`).
     */
    const { error } = await supabase.auth.updateUser({
      phone: target.e164,
    });
    setBusy(false);
    if (error) {
      const { toast: tMsg, banner } = smsAuthErrorPresentation(error.message);
      setErr(banner);
      toast.error(tMsg, { duration: 10000 });
      return;
    }
    setPendingE164(target.e164);
    setPendingDigits(target.digitsProfile);
    setPhase("awaiting_otp");
    setOtp("");
    setCoolLeft(OTP_RESEND_COOLDOWN_SEC);
    toast.success("SMS verification code sent.");
  };

  const verifyOtpAndSeal = async () => {
    if (!pendingE164 || !pendingDigits) {
      setErr("Send a verification code first.");
      return;
    }
    if (otp.trim().length !== 6) {
      setErr("Enter all 6 digits.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({
      phone: pendingE164,
      token: otp.trim(),
      type: "phone_change",
    });
    if (error) {
      setBusy(false);
      const { toast: tMsg, banner } = smsAuthErrorPresentation(error.message);
      setErr(banner);
      toast.error(tMsg, { duration: 10000 });
      return;
    }
    const ok = await onSave(pendingDigits);
    setBusy(false);
    if (!ok) return;
    setPhase("verified");
  };

  if (phase === "verified") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          This number passed SMS OTP and was saved on your Syndicate profile (Supabase{" "}
          <span className="font-mono">verifyOtp</span>, type{" "}
          <span className="font-mono">phone_change</span>).
        </p>
        <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-500/50 bg-black px-4 py-3 shadow-[3px_3px_0_rgb(16_185_129/0.35)]">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <span className="font-mono text-sm font-bold uppercase tracking-wide text-emerald-200">
            Phone verified
          </span>
        </div>
      </div>
    );
  }

  if (phase === "awaiting_otp") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          We texted a code to{" "}
          <span className="font-mono font-semibold text-foreground">{pendingE164}</span>. Enter all 6
          digits below, then tap verify.
        </p>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Syndicate OTP
        </label>
        <NeoOtpSix id="phone-otp" value={otp} onChange={setOtp} accent="violet" />
        {err ? (
          <p className="text-xs font-medium text-red-400" role="alert">
            {err}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void verifyOtpAndSeal()}
          disabled={busy || otp.length !== 6 || saving}
          className={BASE_BTN}
        >
          {busy || saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          VERIFY CODE
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={coolLeft > 0 || busy}
            onClick={() => void sendOtp()}
            className="text-left font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
          >
            {coolLeft > 0 ? `Resend in ${coolLeft}s` : "Resend SMS code"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPhase("idle");
              setOtp("");
              setPendingE164(null);
              setPendingDigits(null);
              setCoolLeft(0);
              setErr(null);
            }}
            className="text-left font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Change number
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Link the number we use for SMS drops and syndicate pings. Sends via Twilio + Supabase —
        configure both in your project dashboard first.
      </p>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(555) 123-4567 or +1…"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className={BASE_INPUT}
      />
      <button
        type="button"
        onClick={() => void sendOtp()}
        disabled={busy || !parsed}
        className={BASE_BTN}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        SAVE DIGITS
      </button>
    </div>
  );
}

function EmailVerificationForm({
  user,
  missionDone,
  onSave,
  saving,
}: {
  user: SupabaseUser;
  missionDone: boolean;
  onSave: () => Promise<boolean>;
  saving: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const loginEmail = user.email ?? "";

  const [email, setEmail] = useState(loginEmail);
  const [phase, setPhase] = useState<IdentityOtpPhase>(missionDone ? "verified" : "idle");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [coolLeft, setCoolLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setEmail(loginEmail);
  }, [loginEmail]);

  useEffect(() => {
    if (missionDone) {
      setPhase("verified");
    } else {
      setPhase("idle");
      setOtp("");
      setPendingEmail(null);
      setCoolLeft(0);
      setErr(null);
    }
  }, [missionDone]);

  useEffect(() => {
    if (coolLeft <= 0) return;
    const id = window.setInterval(() => setCoolLeft((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [coolLeft]);

  const sendOtp = async () => {
    const trimmed = (pendingEmail ?? email).trim().toLowerCase();
    if (!looksLikeEmail(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (loginEmail && trimmed !== loginEmail.toLowerCase()) {
      toast.error(
        "That inbox does not match your signed-in account. `signInWithOtp({ email })` is a login flow — use your current login email or switch accounts.",
        { duration: 8000 },
      );
      return;
    }

    setBusy(true);
    setErr(null);

    /*
     * Requires: Dashboard → Authentication → enable **Email OTP** (six-digit code), not magic-link-only.
     * Optional: customize OTP email template under Auth → Email templates.
     */
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      },
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      toast.error(error.message);
      return;
    }
    setPendingEmail(trimmed);
    setPhase("awaiting_otp");
    setOtp("");
    setCoolLeft(OTP_RESEND_COOLDOWN_SEC);
    toast.success("Check your inbox for the verification code (Email OTP must be enabled in Auth).");
  };

  const verifyOtpAndSeal = async () => {
    if (!pendingEmail) {
      setErr("Send a verification code first.");
      return;
    }
    if (otp.trim().length !== 6) {
      setErr("Enter all 6 digits.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: otp.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setErr(error.message);
      toast.error(error.message);
      return;
    }
    const ok = await onSave();
    setBusy(false);
    if (!ok) return;
    setPhase("verified");
  };

  if (phase === "verified") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Email OTP is locked — a <span className="font-semibold text-foreground">.edu</span> inbox
          still shortcuts you with ops for approvals.
        </p>
        <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-500/50 bg-black px-4 py-3 shadow-[3px_3px_0_rgb(16_185_129/0.35)]">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <span className="font-mono text-sm font-bold uppercase tracking-wide text-emerald-200">
            Email verified
          </span>
        </div>
      </div>
    );
  }

  if (phase === "awaiting_otp") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Code inbound for{" "}
          <span className="break-all font-mono font-semibold text-foreground">{pendingEmail}</span>.
        </p>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Email OTP
        </label>
        <NeoOtpSix id="email-otp" value={otp} onChange={setOtp} accent="cyan" />
        {err ? (
          <p className="text-xs font-medium text-red-400" role="alert">
            {err}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void verifyOtpAndSeal()}
          disabled={busy || otp.length !== 6 || saving}
          className={BASE_BTN}
        >
          {busy || saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          VERIFY CODE
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={coolLeft > 0 || busy}
            onClick={() => void sendOtp()}
            className="text-left font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
          >
            {coolLeft > 0 ? `Resend in ${coolLeft}s` : "Resend email code"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPhase("idle");
              setOtp("");
              setPendingEmail(null);
              setCoolLeft(0);
              setErr(null);
            }}
            className="text-left font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Change email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        We&apos;ll ping your signed-in inbox with a 6-digit code. Turn on Email OTP in Supabase
        Auth — magic-link-only setups won&apos;t return a numeric OTP.
      </p>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@school.edu"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={BASE_INPUT}
      />
      <button
        type="button"
        onClick={() => void sendOtp()}
        disabled={busy || !looksLikeEmail(email)}
        className={BASE_BTN}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        SEAL IDENTITY LINK
      </button>
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
        Drop <span className="font-semibold text-foreground">5+ brands</span> that own your algorithm
        (comma or line breaks). We tune your Drops feed + collab matches.
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
        Sync feed — Mission 5
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
        Vibe Check: paste a link to your best clip, campaign, or a 15s intro. Add a short note on
        why it hits (min {min} characters total).
      </p>
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Link: … + why it slaps…"
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
        Submit vibe reel
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
  submitLabel = "Save tags",
}: {
  profile: Profile | null;
  fieldKey: string;
  label: string;
  placeholder?: string;
  minTags: number;
  onSave: (p: Record<string, unknown>) => void;
  saving: boolean;
  submitLabel?: string;
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
        {submitLabel}
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
