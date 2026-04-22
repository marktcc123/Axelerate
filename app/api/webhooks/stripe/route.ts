import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { fulfillPerksShopOrder } from "@/lib/perks-order-fulfill";
import { fulfillWalletTopUpFromSession } from "@/lib/stripe/fulfill-wallet-topup";
import {
  createPaidOrderInShopify,
  type CreatePaidOrderInShopifyInput,
} from "@/lib/shopify/api";
import {
  parseCartMetadata,
  verifyCartAndComputeUsdDue,
} from "@/lib/perks-checkout-pricing";

export const runtime = "nodejs";

function getPaymentIntentId(session: Stripe.Checkout.Session): string | undefined {
  const pi = session.payment_intent;
  if (pi == null) return undefined;
  return typeof pi === "string" ? pi : pi.id;
}

type SessionWithShipping = Stripe.Checkout.Session & {
  shipping_details?: {
    name?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      postal_code?: string | null;
    } | null;
  } | null;
};

function mapStripeShippingToShopify(
  session: Stripe.Checkout.Session
): CreatePaidOrderInShopifyInput["shippingAddress"] | undefined {
  const s = (session as SessionWithShipping).shipping_details;
  const a = s?.address;
  if (!a) return undefined;
  const name = s?.name?.trim() || "Customer";
  const [first, ...rest] = name.split(/\s+/);
  return {
    first_name: first || "Customer",
    last_name: rest.join(" ") || "-",
    address1: a.line1 || "",
    city: a.city || "",
    province: a.state || "",
    country: a.country || "",
    zip: a.postal_code || "",
    phone: s?.phone || undefined,
  };
}

/** Dropshipping：先写业务订单再调 Shopify；Shopify 失败时标记并始终 200 响应对齐 Stripe 重试策略。 */
async function handleDropshippingSession(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
): Promise<Response> {
  const sessionId = session.id;
  const userId = session.metadata?.userId?.trim();
  const shopifyVariantId = session.metadata?.shopifyVariantId?.trim();
  const quantity = Math.max(0, Math.floor(Number(session.metadata?.quantity) || 0));

  if (!userId || !shopifyVariantId) {
    console.error("[stripe webhook] dropshipping: missing userId or shopifyVariantId", sessionId);
    return new Response("Bad dropshipping metadata", { status: 400 });
  }
  if (quantity < 1) {
    console.error("[stripe webhook] dropshipping: invalid quantity", sessionId);
    return new Response("Bad quantity", { status: 400 });
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (existing) {
    return new Response("ok", { status: 200 });
  }

  if (session.payment_status !== "paid") {
    return new Response("ok", { status: 200 });
  }

  const paidCents = session.amount_total ?? 0;
  if (paidCents < 1) {
    return new Response("ok", { status: 200 });
  }

  const amountNum = paidCents / 100;
  const currencyCode = (session.currency ?? "usd").toUpperCase();
  const itemsRow = [
    { id: shopifyVariantId, quantity, orderType: "dropshipping" },
  ];

  let email =
    session.customer_details?.email?.trim() ??
    (typeof session.customer_email === "string" ? session.customer_email.trim() : null) ??
    null;

  if (!email) {
    const { data: authRes, error: authErr } = await supabase.auth.admin.getUserById(userId);
    if (!authErr && authRes.user?.email) {
      email = authRes.user.email;
    }
  }

  if (!email) {
    const { error: insErr } = await supabase.from("orders").insert({
      user_id: userId,
      cash_paid: amountNum,
      credits_used: 0,
      total_amount: amountNum,
      status: "shopify_sync_failed",
      items: itemsRow,
      stripe_checkout_session_id: sessionId,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return new Response("ok", { status: 200 });
      }
      console.error("[stripe webhook] dropshipping: insert (no email)", insErr, sessionId);
      return new Response("Order insert failed", { status: 500 });
    }
    console.error("[stripe webhook] dropshipping: no email for order", sessionId);
    return new Response("ok", { status: 200 });
  }

  const { data: row, error: insertError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      cash_paid: amountNum,
      credits_used: 0,
      total_amount: amountNum,
      status: "processing",
      items: itemsRow,
      stripe_checkout_session_id: sessionId,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return new Response("ok", { status: 200 });
    }
    console.error("[stripe webhook] dropshipping: insert", insertError, sessionId);
    return new Response("Order insert failed", { status: 500 });
  }

  const orderId = row?.id as string;
  const paymentIntentId = getPaymentIntentId(session);
  const shippingAddress = mapStripeShippingToShopify(session);

  try {
    await createPaidOrderInShopify({
      stripeReference: {
        paymentIntentId,
        checkoutSessionId: sessionId,
      },
      email,
      lineItems: [{ shopifyVariantId, quantity }],
      totalAmount: amountNum.toFixed(2),
      currencyCode,
      shippingAddress,
      sendReceipt: false,
    });
  } catch (e) {
    console.error("[stripe webhook] createPaidOrderInShopify:", e, sessionId);
    const { error: upErr } = await supabase
      .from("orders")
      .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (upErr) {
      console.error("[stripe webhook] mark shopify_sync_failed:", upErr, orderId);
    }
  }

  return new Response("ok", { status: 200 });
}

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

  if (session.metadata?.orderType === "dropshipping") {
    return handleDropshippingSession(session, supabase);
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
