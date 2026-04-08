"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertUserWalletEvent } from "@/lib/wallet-events";
import { revalidatePath } from "next/cache";

export type RedeemReferralResult =
  | { ok: true; refereeCredits: number }
  | { ok: false; error: string };

const REFEREE_CREDITS = 2000;
const REFERRER_CREDITS = 1000;
const REFERRER_XP = 100;

const ERRORS: Record<string, string> = {
  not_authenticated: "Please sign in to redeem a code.",
  invalid_code: "Enter a valid referral code.",
  already_redeemed: "You have already redeemed a referral code.",
  code_not_found: "That code doesn’t exist. Double-check and try again.",
  self_referral: "You can’t use your own referral code.",
};

/** Strip spaces, newlines, zero-width chars; uppercase — matches dashboard paste quirks. */
function normalizeReferralCode(raw: string): string {
  return raw
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .toUpperCase();
}

function canonicalStoredReferralCode(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value)
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "")
    .toUpperCase();
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolve referrer id by profiles.referral_code (tolerant of case / stray whitespace in DB or input).
 */
async function findReferrerIdByCode(
  admin: AdminClient,
  currentUserId: string,
  norm: string,
): Promise<string | null> {
  const { data: exact } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", norm)
    .neq("id", currentUserId)
    .maybeSingle();

  if (exact?.id) return exact.id;

  const escaped = norm
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  const { data: ilikeRows } = await admin
    .from("profiles")
    .select("id, referral_code")
    .ilike("referral_code", escaped)
    .neq("id", currentUserId)
    .limit(5);

  const ilikeUnique =
    ilikeRows?.filter(
      (r) => canonicalStoredReferralCode(r.referral_code) === norm,
    ) ?? [];
  if (ilikeUnique.length === 1) return ilikeUnique[0].id;

  const { data: candidates, error: scanErr } = await admin
    .from("profiles")
    .select("id, referral_code")
    .not("referral_code", "is", null)
    .limit(10000);

  if (scanErr) {
    console.error("[redeemReferralSignupCode] scan referral_code", scanErr);
    return null;
  }

  const hit = candidates?.find(
    (p) =>
      p.id !== currentUserId &&
      canonicalStoredReferralCode(p.referral_code) === norm,
  );
  return hit?.id ?? null;
}

/**
 * Validates code against `profiles.referral_code` and applies rewards using the
 * service role (no DB RPC required). Ensure `profiles.referred_by` exists
 * (see migration 00032) so each user can only redeem once.
 */
export async function redeemReferralSignupCode(
  raw: string,
): Promise<RedeemReferralResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: ERRORS.not_authenticated };
  }

  const norm = normalizeReferralCode(raw);
  if (norm.length < 2) {
    return { ok: false, error: ERRORS.invalid_code };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error:
        "Redeem is unavailable: set SUPABASE_SERVICE_ROLE_KEY on the server.",
    };
  }

  const { data: referee, error: refereeErr } = await admin
    .from("profiles")
    .select("id, credit_balance, referred_by, referral_code")
    .eq("id", user.id)
    .maybeSingle();

  if (refereeErr) {
    if (
      String(refereeErr.message ?? "").includes("referred_by") ||
      String(refereeErr.code ?? "") === "42703"
    ) {
      return {
        ok: false,
        error:
          "Database is missing column profiles.referred_by. Run migration 00032_referral_signup_redeem.sql (or add the column), then try again.",
      };
    }
    console.error("[redeemReferralSignupCode] load referee", refereeErr);
    return { ok: false, error: "Could not load your profile." };
  }

  if (!referee) {
    return { ok: false, error: "Could not load your profile." };
  }

  if (referee.referred_by != null) {
    return { ok: false, error: ERRORS.already_redeemed };
  }

  if (canonicalStoredReferralCode(referee.referral_code) === norm) {
    return { ok: false, error: ERRORS.self_referral };
  }

  const referrerId = await findReferrerIdByCode(admin, user.id, norm);

  if (!referrerId) {
    console.warn(
      "[redeemReferralSignupCode] no profile for normalized code (check NEXT_PUBLIC_SUPABASE_URL / SERVICE_ROLE project matches Table Editor):",
      norm.length,
      "chars",
    );
    return { ok: false, error: ERRORS.code_not_found };
  }

  if (referrerId === user.id) {
    return { ok: false, error: ERRORS.self_referral };
  }

  const refereeCredits = Number(referee.credit_balance ?? 0) + REFEREE_CREDITS;

  const { data: refereeUpdated, error: updateRefereeErr } = await admin
    .from("profiles")
    .update({
      credit_balance: refereeCredits,
      referred_by: referrerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .is("referred_by", null)
    .select("id")
    .maybeSingle();

  if (updateRefereeErr) {
    if (
      String(updateRefereeErr.message ?? "").includes("referred_by") ||
      String(updateRefereeErr.code ?? "") === "42703"
    ) {
      return {
        ok: false,
        error:
          "Database is missing column profiles.referred_by. Run migration 00032_referral_signup_redeem.sql, then try again.",
      };
    }
    console.error("[redeemReferralSignupCode] update referee", updateRefereeErr);
    return { ok: false, error: "Could not apply reward. Try again." };
  }

  if (!refereeUpdated) {
    return { ok: false, error: ERRORS.already_redeemed };
  }

  const { data: referrerRow, error: referrerLoadErr } = await admin
    .from("profiles")
    .select("credit_balance, xp")
    .eq("id", referrerId)
    .maybeSingle();

  if (referrerLoadErr || !referrerRow) {
    console.error("[redeemReferralSignupCode] load referrer", referrerLoadErr);
    return { ok: false, error: "Could not credit your friend. Contact support." };
  }

  const { error: updateReferrerErr } = await admin
    .from("profiles")
    .update({
      credit_balance: Number(referrerRow.credit_balance ?? 0) + REFERRER_CREDITS,
      xp: Number(referrerRow.xp ?? 0) + REFERRER_XP,
      updated_at: new Date().toISOString(),
    })
    .eq("id", referrerId);

  if (updateReferrerErr) {
    console.error("[redeemReferralSignupCode] update referrer", updateReferrerErr);
    return { ok: false, error: "Could not credit your friend. Contact support." };
  }

  const { error: refInsertErr } = await admin.from("referrals").insert({
    referrer_id: referrerId,
    referred_id: user.id,
    reward_amount: REFERRER_CREDITS,
    reward_xp: REFERRER_XP,
    status: "approved",
  });

  if (refInsertErr && refInsertErr.code !== "23505") {
    console.warn("[redeemReferralSignupCode] referrals insert", refInsertErr);
  }

  await insertUserWalletEvent(admin, {
    user_id: user.id,
    category: "referral",
    title: "Welcome bonus",
    detail: "Redeemed a friend's referral code",
    credits_delta: REFEREE_CREDITS,
    ref_type: "referral_signup_referee",
  });

  await insertUserWalletEvent(admin, {
    user_id: referrerId,
    category: "referral",
    title: "Referral reward",
    detail: "Someone joined with your code",
    credits_delta: REFERRER_CREDITS,
    xp_delta: REFERRER_XP,
    ref_type: "referral_signup_referrer",
  });

  revalidatePath("/");
  return { ok: true, refereeCredits: REFEREE_CREDITS };
}
