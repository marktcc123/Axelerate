"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { verifyCartAndComputeUsdDue } from "@/lib/perks-checkout-pricing";

export async function createStripeCheckoutSession(
  cartItems: { id: string; quantity: number }[],
  creditsToUse: number = 0
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
    return { error: "Stripe is not configured (missing STRIPE_SECRET_KEY)." };
  }

  const supabase = createAdminClient();
  const pricing = await verifyCartAndComputeUsdDue(
    supabase,
    user.id,
    cartItems,
    creditsToUse
  );
  if (!pricing.ok) {
    return { error: pricing.error };
  }

  if (pricing.amountToPayUsd <= 0) {
    return {
      error: "Nothing to charge on card — use balance checkout or adjust credits.",
    };
  }

  const cents = Math.round(pricing.amountToPayUsd * 100);
  if (cents < 1) {
    return { error: "Amount too small." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  const cartMeta = cartItems.map((c) => `${c.id}:${c.quantity}`).join(",");
  if (cartMeta.length > 450) {
    return { error: "Cart is too large for card checkout — remove some items." };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Axelerate Perks Shop",
            description: `${cartItems.length} item(s)`,
          },
          unit_amount: cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/?tab=shop&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?tab=shop&checkout=cancelled`,
    metadata: {
      userId: user.id,
      cart: cartMeta,
      creditsToUse: String(pricing.actualCreditsUsed),
      usdCents: String(cents),
    },
    client_reference_id: user.id,
  });

  if (!session.url) {
    return { error: "Could not start Stripe Checkout." };
  }
  return { url: session.url };
}

/** 客户端用于判断是否展示「银行卡支付」入口（不暴露密钥）。 */
export async function isStripePaymentsEnabled(): Promise<boolean> {
  return isStripeConfigured();
}
