"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VerificationSteps } from "@/lib/types";

export type SubmitUgcResult =
  | { success: true }
  | { success: false; error: string };

/** Submit UGC link for a user_gig - updates to submitted status for admin review */
export async function submitUgcLink(
  userGigId: string,
  platform: string,
  ugcLink: string,
  notes: string
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
  | { success: true }
  | { success: false; error: string };

/** 同步验证步骤：合并 JSONB verification_steps，并更新 profile 物理列 */
export async function syncVerificationStep(
  userId: string,
  stepKey: keyof VerificationSteps,
  payload: Record<string, unknown>
): Promise<SyncVerificationResult> {
  if (!userId?.trim()) return { success: false, error: "User ID required" };

  const supabase = await createClient();

  // 1. 获取当前 profile 和 verification_steps
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("verification_steps, avatar_url, campus, graduation_year, skills, interests, resume_url, portfolio_url")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    console.error("[syncVerificationStep] fetch error:", fetchError);
    return { success: false, error: fetchError?.message ?? "Profile not found" };
  }

  const currentSteps = (profile.verification_steps as Record<string, boolean>) ?? {};

  // 2. 合并新步骤，不覆盖其他已完成步骤
  const newSteps = { ...currentSteps, [stepKey]: true };

  // 3. 构建更新 payload：verification_steps + 物理列
  const updatePayload: Record<string, unknown> = {
    verification_steps: newSteps,
    updated_at: new Date().toISOString(),
  };

  if (stepKey === "has_avatar" && payload.avatar_url) {
    updatePayload.avatar_url = payload.avatar_url;
  } else if (stepKey === "added_school") {
    if (payload.campus != null) updatePayload.campus = payload.campus;
    if (payload.graduation_year != null) updatePayload.graduation_year = payload.graduation_year;
  } else if (stepKey === "has_resume" && payload.resume_url) {
    updatePayload.resume_url = payload.resume_url;
  } else if (stepKey === "added_skills" && Array.isArray(payload.skills)) {
    updatePayload.skills = payload.skills;
  } else if (stepKey === "added_interests" && Array.isArray(payload.interests)) {
    updatePayload.interests = payload.interests;
  } else if (stepKey === "added_portfolio" && payload.portfolio_url) {
    updatePayload.portfolio_url = payload.portfolio_url;
  }
  // phone_verified, email_verified, followed_brands, answered_questions 暂只更新 verification_steps

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (updateError) {
    console.error("[syncVerificationStep] update error:", updateError);
    return { success: false, error: updateError.message };
  }

  revalidatePath("/");
  return { success: true };
}
