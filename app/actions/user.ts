"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_VERIFICATION_STEPS,
  VERIFICATION_STEP_KEYS,
  resolveTierKey,
  type VerificationSteps,
} from "@/lib/types";

export type SubmitUgcResult =
  | { success: true }
  | { success: false; error: string };

/** Submit UGC link for a user_gig - updates to submitted status for admin review */
export async function submitUgcLink(
  userGigId: string,
  platform: string,
  ugcLink: string,
  notes: string,
): Promise<SubmitUgcResult> {
  if (!userGigId?.trim()) return { success: false, error: "User Gig ID required" };
  if (!platform?.trim()) return { success: false, error: "Platform required" };
  if (!ugcLink?.trim()) return { success: false, error: "UGC link required" };

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({
      platform: platform.trim(),
      ugc_link: ugcLink.trim(),
      notes: notes?.trim() || null,
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    })
    .eq("id", userGigId);

  if (error) {
    console.error("[submitUgcLink] error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export type SyncVerificationResult =
  | { success: true; tierUpgraded?: boolean }
  | { success: false; error: string };

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function validateVerificationPayload(
  stepKey: keyof VerificationSteps,
  payload: Record<string, unknown>,
): string | null {
  switch (stepKey) {
    case "has_avatar": {
      const u = String(payload.avatar_url ?? "").trim();
      if (!u) return "Enter a URL to your profile photo, or paste an image link.";
      if (!isValidHttpUrl(u)) return "Enter a valid URL starting with https://";
      return null;
    }
    case "has_resume": {
      const u = String(payload.resume_url ?? "").trim();
      if (!u) return "Resume link is required.";
      if (!isValidHttpUrl(u)) return "Enter a valid URL.";
      return null;
    }
    case "phone_verified": {
      const digits = String(payload.phone ?? "").replace(/\D/g, "");
      if (digits.length < 10) return "Enter a valid phone number (at least 10 digits).";
      return null;
    }
    case "added_school": {
      if (!String(payload.campus ?? "").trim()) return "School name is required.";
      if (!String(payload.graduation_year ?? "").trim()) return "Graduation year is required.";
      return null;
    }
    case "added_skills": {
      const arr = payload.skills;
      if (!Array.isArray(arr) || arr.length < 3) {
        return "Add at least 3 skills (comma-separated).";
      }
      return null;
    }
    case "added_interests": {
      if (!Array.isArray(payload.interests) || payload.interests.length < 3) {
        return "Add at least 3 interests (comma-separated).";
      }
      return null;
    }
    case "added_portfolio": {
      const u = String(payload.portfolio_url ?? "").trim();
      if (!u) return "Portfolio URL is required.";
      if (!isValidHttpUrl(u)) return "Enter a valid URL.";
      return null;
    }
    case "followed_brands": {
      const raw = String(payload.followed_brands_list ?? "").trim();
      const parts = raw
        .split(/[,，\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length < 5) {
        return "List at least 5 brands you follow (separate with commas).";
      }
      return null;
    }
    case "answered_questions": {
      const t = String(payload.hitlist_brand ?? "").trim();
      if (t.length < 2) return "Enter at least 2 characters.";
      if (t.length > 200) return "Keep it under 200 characters.";
      return null;
    }
    case "email_verified":
      return null;
    default:
      return null;
  }
}

/** Sync verification_steps JSON + physical columns; all keys true ⇒ missions complete ⇒ guest tier can promote to student (Insider). */
export async function syncVerificationStep(
  stepKey: keyof VerificationSteps,
  payload: Record<string, unknown>,
): Promise<SyncVerificationResult> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return { success: false, error: "You must be signed in to save this step." };
  }

  const userId = authUser.id;

  if (stepKey === "email_verified") {
    if (!authUser.email_confirmed_at) {
      return {
        success: false,
        error:
          "Confirm your email using the link we sent you, then try again.",
      };
    }
  } else {
    const validationError = validateVerificationPayload(stepKey, payload);
    if (validationError) return { success: false, error: validationError };
  }

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select(
      "verification_steps, avatar_url, campus, graduation_year, skills, interests, resume_url, portfolio_url, tier, phone, followed_brands_list, interview_answers, hitlist_brand, consumer_intel, intel_bounty_skipped_at, intel_bounty_claimed_at",
    )
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    const msg = String(fetchError?.message ?? "");
    if (
      msg.includes("phone") ||
      msg.includes("followed_brands_list") ||
      msg.includes("interview_answers") ||
      msg.includes("hitlist_brand") ||
      msg.includes("consumer_intel") ||
      msg.includes("intel_bounty") ||
      fetchError?.code === "42703"
    ) {
      return {
        success: false,
        error:
        "Run migration 00033 / 00046 in Supabase (profile columns), then try again.",
      };
    }
    console.error("[syncVerificationStep] fetch error:", fetchError);
    return { success: false, error: fetchError?.message ?? "Profile not found" };
  }

  const currentSteps = (profile.verification_steps as Record<string, boolean>) ?? {};
  const newSteps: Record<string, boolean> = {
    ...DEFAULT_VERIFICATION_STEPS,
    ...currentSteps,
    [stepKey]: true,
  };

  const updatePayload: Record<string, unknown> = {
    verification_steps: newSteps,
    updated_at: new Date().toISOString(),
  };

  if (stepKey === "has_avatar" && payload.avatar_url) {
    updatePayload.avatar_url = String(payload.avatar_url).trim();
  } else if (stepKey === "added_school") {
    if (payload.campus != null) updatePayload.campus = String(payload.campus).trim();
    if (payload.graduation_year != null) {
      updatePayload.graduation_year = String(payload.graduation_year).trim();
    }
  } else if (stepKey === "has_resume" && payload.resume_url) {
    updatePayload.resume_url = String(payload.resume_url).trim();
  } else if (stepKey === "added_skills" && Array.isArray(payload.skills)) {
    updatePayload.skills = payload.skills;
  } else if (stepKey === "added_interests" && Array.isArray(payload.interests)) {
    updatePayload.interests = payload.interests;
  } else if (stepKey === "added_portfolio" && payload.portfolio_url) {
    updatePayload.portfolio_url = String(payload.portfolio_url).trim();
  } else if (stepKey === "phone_verified" && payload.phone != null) {
    const digits = String(payload.phone).replace(/\D/g, "");
    updatePayload.phone = digits;
  } else if (stepKey === "followed_brands" && payload.followed_brands_list != null) {
    updatePayload.followed_brands_list = String(payload.followed_brands_list).trim();
  } else if (stepKey === "answered_questions" && payload.hitlist_brand != null) {
    updatePayload.hitlist_brand = String(payload.hitlist_brand).trim();
  }

  const mergedSteps = newSteps as VerificationSteps;

  const allDone = VERIFICATION_STEP_KEYS.every((k) => Boolean(mergedSteps[k]));
  const currentTier = resolveTierKey(String(profile.tier ?? "guest"));
  let tierUpgraded = false;

  if (allDone && currentTier === "guest") {
    updatePayload.tier = "student";
    tierUpgraded = true;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (updateError) {
    if (
      String(updateError.message ?? "").includes("phone") ||
      String(updateError.message ?? "").includes("followed_brands_list") ||
      String(updateError.message ?? "").includes("interview_answers") ||
      String(updateError.message ?? "").includes("hitlist_brand") ||
      String(updateError.message ?? "").includes("consumer_intel") ||
      String(updateError.message ?? "").includes("intel_bounty")
    ) {
      return {
        success: false,
        error:
          "Database is missing new columns. Run migration 00033_profiles_verification_extras.sql in Supabase, then try again.",
      };
    }
    console.error("[syncVerificationStep] update error:", updateError);
    return { success: false, error: updateError.message };
  }

  revalidatePath("/");
  return { success: true, tierUpgraded };
}

export type ResetSyndicateVerificationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * 重置任务勾选：`verification_steps` 全部归零。不清空已填字段，展开任务仍可看到并修改。
 * tier 为 student 时降回 guest（与仅通过验证解锁的 Insider 一致）。
 */
export async function resetSyndicateVerificationProgress(): Promise<ResetSyndicateVerificationResult> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return { success: false, error: "You must be signed in." };
  }

  const userId = authUser.id;

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    return { success: false, error: fetchError?.message ?? "Profile not found" };
  }

  const tier = resolveTierKey(String(profile.tier ?? "guest"));
  const updatePayload: Record<string, unknown> = {
    verification_steps: DEFAULT_VERIFICATION_STEPS,
    updated_at: new Date().toISOString(),
  };

  if (tier === "student") {
    updatePayload.tier = "guest";
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (updateError) {
    console.error("[resetSyndicateVerificationProgress]", updateError);
    return { success: false, error: updateError.message };
  }

  revalidatePath("/");
  return { success: true };
}
