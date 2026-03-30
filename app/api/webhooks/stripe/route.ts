import { headers } from "next/headers";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { fulfillPerksShopOrder } from "@/lib/perks-order-fulfill";
import { fulfillWalletTopUpFromSession } from "@/lib/stripe/fulfill-wallet-topup";
import {
  parseCartMetadata,
  verifyCartAndComputeUsdDue,
} from "@/lib/perks-checkout-pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    return new Response("Stripe webhook not configured", { status: 500 });
  }

  const body = await request.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    console.error("[stripe webhook] signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const supabase = createAdminClient();

  if (session.metadata?.purpose === "wallet_topup") {
    const r = await fulfillWalletTopUpFromSession(supabase, session);
    if (!r.ok) {
      console.error("[stripe webhook] wallet topup:", r.message, sessionId);
      return new Response(r.message, { status: 400 });
    }
    return new Response("ok", { status: 200 });
  }

  const userId = session.metadata?.userId;
  const cartRaw = session.metadata?.cart;
  const creditsRaw = session.metadata?.creditsToUse;
  const expectedCents = session.metadata?.usdCents;

  if (!userId || !cartRaw) {
    console.error("[stripe webhook] missing shop metadata", sessionId);
    return new Response("Bad metadata", { status: 400 });
  }

  const cartItems = parseCartMetadata(cartRaw);
  if (cartItems.length === 0) {
    return new Response("Empty cart", { status: 400 });
  }

  const creditsToUse = Math.max(0, Math.floor(Number(creditsRaw) || 0));

  const pricing = await verifyCartAndComputeUsdDue(
    supabase,
    userId,
    cartItems,
    creditsToUse
  );
  if (!pricing.ok) {
    console.error("[stripe webhook] pricing failed:", pricing.error, sessionId);
    return new Response("Pricing verification failed", { status: 400 });
  }

  const paidCents = session.amount_total ?? 0;
  if (expectedCents && Number(expectedCents) !== paidCents) {
    console.error(
      "[stripe webhook] amount mismatch",
      expectedCents,
      paidCents,
      sessionId
    );
    return new Response("Amount mismatch", { status: 400 });
  }

  const expectedPaidCents = Math.round(pricing.amountToPayUsd * 100);
  if (paidCents !== expectedPaidCents) {
    console.error(
      "[stripe webhook] amount vs recomputed",
      paidCents,
      expectedPaidCents,
      sessionId
    );
    return new Response("Amount mismatch", { status: 400 });
  }

  const result = await fulfillPerksShopOrder(supabase, {
    userId,
    cartItems,
    deductCashFromBalance: 0,
    deductCredits: pricing.actualCreditsUsed,
    orderCashPaid: pricing.amountToPayUsd,
    stripeCheckoutSessionId: sessionId,
  });

  if (!result.success) {
    console.error("[stripe webhook] fulfill failed:", result.error, sessionId);
    return new Response(result.error, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
