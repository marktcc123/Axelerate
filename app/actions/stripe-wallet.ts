"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillWalletTopUpFromSession } from "@/lib/stripe/fulfill-wallet-topup";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

const MIN_TOPUP_USD = 5;
const MAX_TOPUP_USD = 500;

export async function createWalletTopUpSession(
  amountUsd: number
): Promise<{ url: string } | { error: string }> {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return { error: "Please sign in." };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { error: "Stripe is not configured." };
  }

  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt < MIN_TOPUP_USD || amt > MAX_TOPUP_USD) {
    return {
      error: `Enter an amount between $${MIN_TOPUP_USD} and $${MAX_TOPUP_USD}.`,
    };
  }

  const cents = Math.round(amt * 100);
  if (cents < MIN_TOPUP_USD * 100) {
    return { error: "Amount too small." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Wallet top-up",
            description: `Add $${amt.toFixed(2)} to your Axelerate balance`,
          },
          unit_amount: cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/?tab=profile&wallet_topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?tab=profile&wallet_topup=cancelled`,
    metadata: {
      purpose: "wallet_topup",
      userId: user.id,
      usdCents: String(cents),
    },
    client_reference_id: user.id,
  });

  if (!session.url) {
    return { error: "Could not start checkout." };
  }
  return { url: session.url };
}

export async function isWalletStripeEnabled(): Promise<boolean> {
  return isStripeConfigured();
}

/**
 * 支付成功页带回 session_id 时调用：在本地未收到 webhook 时也能幂等入账。
 */
export async function syncWalletTopUpFromStripeSession(
  sessionId: string
): Promise<{ ok: true; credited: boolean } | { ok: false; error: string }> {
  const id = sessionId?.trim();
  if (!id) {
    return { ok: false, error: "Missing session id." };
  }

  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured." };
  }

  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in." };
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(id);
  } catch (e) {
    console.error("[syncWalletTopUp] retrieve:", e);
    return { ok: false, error: "Could not verify payment." };
  }

  if (session.metadata?.userId !== user.id) {
    return { ok: false, error: "Unauthorized." };
  }

  if (session.payment_status !== "paid") {
    return { ok: true, credited: false };
  }

  const supabase = createAdminClient();
  const result = await fulfillWalletTopUpFromSession(supabase, session);
  if (!result.ok) {
    return { ok: false, error: result.message };
  }

  return { ok: true, credited: true };
}
