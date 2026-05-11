"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ConsumerIntel } from "@/lib/types";
import {
  INTEL_Q1_MONTHLY_BUDGET,
  INTEL_Q2_DISCOVERY,
  INTEL_Q3_CHECKOUT_TRIGGER,
  INTEL_Q4_BRAND_RED_FLAG,
} from "@/lib/intel-bounty-schema";

export type IntelBountyResult =
  | { success: true }
  | { success: false; error: string };

function isPick<T extends readonly string[]>(v: unknown, opts: T): v is T[number] {
  return typeof v === "string" && (opts as readonly string[]).includes(v);
}

function parseIntel(raw: Record<string, unknown>): ConsumerIntel | null {
  const q1 = raw.q1_monthly_budget;
  const q2 = raw.q2_discovery;
  const q3 = raw.q3_checkout_trigger;
  const q4 = raw.q4_brand_red_flag;
  if (!isPick(q1, INTEL_Q1_MONTHLY_BUDGET)) return null;
  if (!isPick(q2, INTEL_Q2_DISCOVERY)) return null;
  if (!isPick(q3, INTEL_Q3_CHECKOUT_TRIGGER)) return null;
  if (!isPick(q4, INTEL_Q4_BRAND_RED_FLAG)) return null;
  return {
    q1_monthly_budget: q1,
    q2_discovery: q2,
    q3_checkout_trigger: q3,
    q4_brand_red_flag: q4,
    submitted_at: new Date().toISOString(),
  };
}

/** Record skip so the optional bounty modal does not reopen. */
export async function skipIntelBounty(): Promise<IntelBountyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "You must be signed in." };

  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("intel_bounty_claimed_at, intel_bounty_skipped_at")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchErr || !profile) {
    return { success: false, error: fetchErr?.message ?? "Profile not found" };
  }
  if (profile.intel_bounty_claimed_at) return { success: true };
  if (profile.intel_bounty_skipped_at) return { success: true };

  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      intel_bounty_skipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updErr) return { success: false, error: updErr.message };
  revalidatePath("/");
  return { success: true };
}

/** Save consumer_intel JSON + grant 500 credits + 100 XP (single-profile transaction). */
export async function claimIntelBounty(payload: Record<string, unknown>): Promise<IntelBountyResult> {
  const intel = parseIntel(payload);
  if (!intel) {
    return { success: false, error: "Invalid survey answers." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "You must be signed in." };

  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("credit_balance, xp, intel_bounty_claimed_at, intel_bounty_skipped_at")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchErr || !profile) {
    return { success: false, error: fetchErr?.message ?? "Profile not found" };
  }
  if (profile.intel_bounty_claimed_at) {
    return { success: false, error: "Bounty already claimed." };
  }
  if (profile.intel_bounty_skipped_at) {
    return { success: false, error: "Bounty already skipped." };
  }

  const credits =
    typeof profile.credit_balance === "number"
      ? profile.credit_balance
      : Number(profile.credit_balance ?? 0);
  const xp = typeof profile.xp === "number" ? profile.xp : Number(profile.xp ?? 0);

  const { data: updated, error: updErr } = await supabase
    .from("profiles")
    .update({
      consumer_intel: intel,
      credit_balance: credits + 500,
      xp: xp + 100,
      intel_bounty_claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .is("intel_bounty_claimed_at", null)
    .select("id")
    .maybeSingle();

  if (updErr) {
    const msg = String(updErr.message ?? "");
    if (
      msg.includes("consumer_intel") ||
      msg.includes("intel_bounty_claimed_at") ||
      msg.includes("column")
    ) {
      return {
        success: false,
        error:
          "Database missing bounty columns — run migration 00046_profiles_hitlist_intel_bounty.sql in Supabase.",
      };
    }
    return { success: false, error: updErr.message };
  }
  if (!updated) {
    return { success: false, error: "Could not apply bounty (already claimed?)." };
  }

  revalidatePath("/");
  return { success: true };
}
