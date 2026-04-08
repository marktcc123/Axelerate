"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CAREER_BRAND_THRESHOLD,
  CAREER_GENERAL_THRESHOLD,
  isFinishedGigStatus,
  parseCareerRewardKey,
} from "@/lib/career-rewards";
import type { UserGigStatus } from "@/lib/types";
import { revalidatePath } from "next/cache";

export type CareerRewardStatus = "pending" | "approved" | "rejected";

export type ClaimCareerRewardResult =
  | { ok: true }
  | { ok: false; error: string };

export type CareerCertificateUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type GigRow = { brand_id?: string | null } | null;

/**
 * Submit a career reward request (status `pending`). Admin must approve and attach PDF when required.
 */
export async function requestCareerReward(rewardKey: string): Promise<ClaimCareerRewardResult> {
  const key = rewardKey.trim();
  const parsed = parseCareerRewardKey(key);
  if (!parsed) {
    return { ok: false, error: "Invalid reward." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Sign in to continue." };
  }

  const { data: rows, error: loadErr } = await supabase
    .from("user_gigs")
    .select("id, status, gig:gigs(brand_id)")
    .eq("user_id", user.id);

  if (loadErr) {
    console.error("[requestCareerReward] user_gigs", loadErr);
    return { ok: false, error: "Could not load your gigs." };
  }

  let totalCompleted = 0;
  const brandCounts = new Map<string, number>();
  for (const r of rows ?? []) {
    const st = r.status as UserGigStatus;
    if (!isFinishedGigStatus(st)) continue;
    totalCompleted++;
    const g = r.gig as GigRow;
    const bid = g?.brand_id?.toLowerCase();
    if (bid) {
      brandCounts.set(bid, (brandCounts.get(bid) ?? 0) + 1);
    }
  }

  if (parsed.kind === "general_cert") {
    if (totalCompleted < CAREER_GENERAL_THRESHOLD) {
      return { ok: false, error: `Complete at least ${CAREER_GENERAL_THRESHOLD} gigs first.` };
    }
  } else {
    const brandId = parsed.brandId;
    const n = brandCounts.get(brandId) ?? 0;
    if (n < CAREER_BRAND_THRESHOLD) {
      return {
        ok: false,
        error: `Need ${CAREER_BRAND_THRESHOLD}+ finished gigs with this brand.`,
      };
    }
  }

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    reward_key: key,
    status: "pending",
  };
  if (parsed.kind === "brand") {
    insertPayload.brand_id = parsed.brandId;
  }

  const { error: insErr } = await supabase.from("career_rewards").insert(insertPayload);

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, error: "Already submitted or completed." };
    }
    if (
      String(insErr.message ?? "").includes("career_rewards") ||
      String(insErr.message ?? "").includes("status") ||
      insErr.code === "42703" ||
      insErr.code === "42P01"
    ) {
      return {
        ok: false,
        error:
          "Database needs migrations 00037 (career workflow) and 00038 (career_rewards.brand_id) if the error mentions brand_id.",
      };
    }
    console.error("[requestCareerReward] insert", insErr);
    return { ok: false, error: "Could not submit. Try again." };
  }

  revalidatePath("/");
  return { ok: true };
}

/** Signed download URL for the user’s own approved certificate PDF. */
export async function getCareerCertificateDownloadUrl(
  rewardId: string,
): Promise<CareerCertificateUrlResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "Sign in required." };
  }

  const { data: row, error } = await supabase
    .from("career_rewards")
    .select("id, user_id, status, certificate_pdf_path")
    .eq("id", rewardId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "Reward not found." };
  }
  if (row.user_id !== user.id) {
    return { ok: false, error: "Not allowed." };
  }
  if (row.status !== "approved" || !row.certificate_pdf_path?.trim()) {
    return { ok: false, error: "Certificate not available yet." };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("career-certificates")
    .createSignedUrl(row.certificate_pdf_path.trim(), 120);

  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: signErr?.message ?? "Could not create download link." };
  }

  return { ok: true, url: signed.signedUrl };
}
