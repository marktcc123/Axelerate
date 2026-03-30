import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureProfileRowForUser } from "@/lib/supabase/ensure-user-profile";

export async function fulfillWalletTopUpFromSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = session.metadata?.userId;
  const purpose = session.metadata?.purpose;
  const sessionId = session.id;
  const paidCents = session.amount_total ?? 0;
  const expectedCentsRaw = session.metadata?.usdCents;

  if (purpose !== "wallet_topup" || !userId) {
    return { ok: false, message: "Not a wallet top-up session" };
  }

  if (!expectedCentsRaw || Number(expectedCentsRaw) !== paidCents) {
    return { ok: false, message: "Amount mismatch" };
  }

  const amountUsd = paidCents / 100;

  const ensured = await ensureProfileRowForUser(supabase, userId);
  if (!ensured.ok) {
    console.error("[fulfillWalletTopUp] ensure profile:", ensured.error);
    return { ok: false, message: ensured.error };
  }

  const { data: existing } = await supabase
    .from("stripe_wallet_topups")
    .select("id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (existing) {
    return { ok: true };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("cash_balance")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    console.error("[fulfillWalletTopUp] profile:", profileErr);
    return { ok: false, message: "User not found" };
  }

  const { error: insertTopupErr } = await supabase.from("stripe_wallet_topups").insert({
    user_id: userId,
    stripe_checkout_session_id: sessionId,
    amount_usd: amountUsd,
  });

  if (insertTopupErr) {
    if (insertTopupErr.code === "23505") {
      return { ok: true };
    }
    console.error("[fulfillWalletTopUp] insert topup:", insertTopupErr);
    return { ok: false, message: insertTopupErr.message };
  }

  const nextBal = Number(profile.cash_balance ?? 0) + amountUsd;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      cash_balance: nextBal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updErr) {
    console.error("[fulfillWalletTopUp] balance update:", updErr);
    return { ok: false, message: updErr.message };
  }

  const { error: txErr } = await supabase.from("transactions").insert({
    user_id: userId,
    amount: amountUsd,
    type: "wallet_deposit",
    status: "cleared",
    metadata: { stripe_checkout_session_id: sessionId, source: "stripe" },
  });

  if (txErr) {
    console.warn(
      "[fulfillWalletTopUp] transaction row skipped (enum/column?):",
      txErr.message
    );
  }

  revalidatePath("/");
  return { ok: true };
}
