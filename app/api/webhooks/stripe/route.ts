import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { fulfillPerksShopOrder } from "@/lib/perks-order-fulfill";
import { fulfillWalletTopUpFromSession } from "@/lib/stripe/fulfill-wallet-topup";
import { createPaidOrderInShopify } from "@/lib/shopify/api";
import {
  mapStripeAddressToShopify,
  mapStripeBillingToShopify,
  getCustomerNamePhoneForStripeShopify as getCustomerNamePhoneForShopify,
} from "@/lib/stripe/checkout-session-shopify-maps";
import { logShopifyOrderCreateFailure } from "@/lib/supabase/error-logs";
import { ensureProfileRowForUser } from "@/lib/supabase/ensure-user-profile";
import {
  parseCartMetadata,
  verifyCartAndComputeUsdDue,
} from "@/lib/perks-checkout-pricing";
import { parseDropshipLineMetadata } from "@/lib/shopify/dropship-from-product";
import type { StripeMirroredLineItem } from "@/lib/shopify/api";
import {
  cartLineHasResolvableShopifyVariant,
  mergeShopifyCommaTags,
  parseProductSpecifications,
} from "@/lib/shopify/product-specifications";

export const runtime = "nodejs";

function getPaymentIntentId(session: Stripe.Checkout.Session): string | undefined {
  const pi = session.payment_intent;
  if (pi == null) return undefined;
  return typeof pi === "string" ? pi : pi.id;
}

type StripeCentsBreakdown = {
  productCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

function getStripeCentsBreakdown(
  session: Stripe.Checkout.Session
): StripeCentsBreakdown {
  const totalCents = session.amount_total ?? 0;
  const td = (
    session as {
      total_details?: {
        amount_shipping?: number | null;
        amount_tax?: number | null;
      };
    }
  ).total_details;
  const shippingCents = Math.max(0, td?.amount_shipping ?? 0);
  const taxCents = Math.max(0, td?.amount_tax ?? 0);
  const sub = (session as { amount_subtotal?: number | null }).amount_subtotal;
  let productCents =
    sub != null && sub > 0
      ? sub
      : Math.max(0, totalCents - shippingCents - taxCents);
  return { productCents, shippingCents, taxCents, totalCents };
}

/**
 * 按 catalog 价比例把 Stripe 实收（商品部分，分）摊到各行，生成 Shopify `line_items[].price`。
 */
async function buildDropshipLineItemsWithUnitPrices(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  variantLines: { shopifyVariantId: string; quantity: number }[]
): Promise<StripeMirroredLineItem[]> {
  const br = getStripeCentsBreakdown(session);
  const productCentsPool = br.productCents;
  if (variantLines.length === 0) return [];

  const cart = parseCartMetadata(session.metadata?.cart ?? "");

  if (cart.length === 0 || cart.length !== variantLines.length) {
    const totalUnits = variantLines.reduce((a, b) => a + b.quantity, 0);
    const perUnitCents = productCentsPool / Math.max(1, totalUnits);
    return variantLines.map((l) => ({
      shopifyVariantId: l.shopifyVariantId,
      quantity: l.quantity,
      unitPrice: (perUnitCents / 100).toFixed(2),
    }));
  }

  const { data: prows } = await supabase
    .from("products")
    .select("id, discount_price, original_price, specifications")
    .in(
      "id",
      cart.map((c) => c.id)
    );
  const pmap = new Map((prows ?? []).map((p) => [p.id, p]));
  const {
    getUnitPriceUsd,
    parseProductSpecifications,
    resolveVariantIdForCheckout,
  } = await import("@/lib/shopify/product-specifications");

  let sumUsd = 0;
  const lineCatalog: number[] = [];
  for (let i = 0; i < cart.length; i++) {
    const c = cart[i]!;
    const p = pmap.get(c.id);
    if (!p) {
      lineCatalog.push(0);
      continue;
    }
    const spec = parseProductSpecifications(p.specifications);
    const fallback = Number(p.discount_price ?? p.original_price ?? 0);
    const rid = spec?.shopify_variants.length
      ? resolveVariantIdForCheckout(spec, c.shopifyVariantId)
      : null;
    const unit = rid
      ? getUnitPriceUsd(spec, rid, fallback)
      : fallback;
    const u = unit * c.quantity;
    lineCatalog.push(u);
    sumUsd += u;
  }
  if (sumUsd <= 0) {
    const totalUnits = variantLines.reduce((a, b) => a + b.quantity, 0);
    const perUnitCents = productCentsPool / Math.max(1, totalUnits);
    return variantLines.map((l) => ({
      shopifyVariantId: l.shopifyVariantId,
      quantity: l.quantity,
      unitPrice: (perUnitCents / 100).toFixed(2),
    }));
  }

  let allocated = 0;
  const n = variantLines.length;
  const out: StripeMirroredLineItem[] = [];
  for (let i = 0; i < n; i++) {
    const li = variantLines[i]!;
    const isLast = i === n - 1;
    const lineCents = isLast
      ? productCentsPool - allocated
      : Math.round(
          (productCentsPool * (lineCatalog[i] ?? 0)) / sumUsd
        );
    if (!isLast) allocated += lineCents;
    const unitCents = lineCents / Math.max(1, li.quantity);
    out.push({
      shopifyVariantId: li.shopifyVariantId,
      quantity: li.quantity,
      unitPrice: (unitCents / 100).toFixed(2),
    });
  }
  return out;
}

/** Dropshipping：先写业务订单再调 Shopify；Shopify 失败时标记并始终 200 响应对齐 Stripe 重试策略。 */
async function handleDropshippingSession(
  eventSession: Stripe.Checkout.Session,
  supabase: SupabaseClient
): Promise<Response> {
  const stripe = getStripe();
  let session = eventSession;
  if (stripe) {
    try {
      session = await stripe.checkout.sessions.retrieve(eventSession.id, {
        expand: ["shipping_cost.shipping_rate"],
      });
    } catch (e) {
      console.warn(
        "[stripe webhook] sessions.retrieve(expand) failed, using event payload",
        e
      );
    }
  }

  const sessionId = session.id;
  const userId = session.metadata?.userId?.trim();

  const fromDropshipMeta = parseDropshipLineMetadata(
    session.metadata?.dropshipLines
  );
  const legacyVariant = session.metadata?.shopifyVariantId?.trim();
  const legacyQty = Math.max(0, Math.floor(Number(session.metadata?.quantity) || 0));

  let variantLines: { shopifyVariantId: string; quantity: number }[] = fromDropshipMeta;
  if (variantLines.length === 0 && legacyVariant && legacyQty > 0) {
    variantLines = [{ shopifyVariantId: legacyVariant, quantity: legacyQty }];
  }

  if (!userId) {
    console.error("[stripe webhook] dropshipping: missing userId", sessionId);
    return new Response("Bad dropshipping metadata", { status: 400 });
  }
  if (variantLines.length === 0) {
    console.error(
      "[stripe webhook] dropshipping: no variant lines (dropshipLines or shopifyVariantId+quantity)",
      sessionId
    );
    return new Response("Bad dropshipping metadata", { status: 400 });
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (existing) {
    return new Response("ok", { status: 200 });
  }

  const ensuredProfile = await ensureProfileRowForUser(supabase, userId);
  if (!ensuredProfile.ok) {
    console.error(
      "[stripe webhook] dropshipping: no profiles row",
      ensuredProfile.error,
      sessionId
    );
    return new Response("User profile missing", { status: 400 });
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
  const creditsUsed = Math.max(0, Math.floor(Number(session.metadata?.creditsToUse) || 0));

  /** 与购物车 metadata 对齐：写入 App 商品 id（uuid），便于订单展示；长度与 dropshipLines 一致时逐项合并变体 id */
  const cartForItems = parseCartMetadata(session.metadata?.cart ?? "");
  const itemsRow =
    cartForItems.length > 0 && cartForItems.length === variantLines.length
      ? cartForItems.map((c, i) => ({
          id: c.id,
          quantity: c.quantity,
          shopifyVariantId: variantLines[i]!.shopifyVariantId,
          orderType: "dropshipping",
        }))
      : variantLines.map((l) => ({
          id: l.shopifyVariantId,
          quantity: l.quantity,
          orderType: "dropshipping",
        }));

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
      credits_used: creditsUsed,
      status: "shopify_sync_failed",
      items: itemsRow,
      stripe_checkout_session_id: sessionId,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return new Response("ok", { status: 200 });
      }
      console.error(
        "[stripe webhook] dropshipping: insert (no email)",
        insErr.code,
        insErr.message,
        insErr.details,
        sessionId
      );
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
      credits_used: creditsUsed,
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
    console.error(
      "[stripe webhook] dropshipping: insert",
      insertError.code,
      insertError.message,
      insertError.details,
      sessionId
    );
    return new Response("Order insert failed", { status: 500 });
  }

  const orderId = row?.id as string;
  const paymentIntentId = getPaymentIntentId(session);
  const shippingAddress = mapStripeAddressToShopify(session);
  const billingAddress = mapStripeBillingToShopify(session);
  if (!shippingAddress) {
    console.warn(
      "[stripe webhook] dropshipping: no shipping/billing address on session; Spocket 可能需地址",
      sessionId
    );
  }

  const centBreakdown = getStripeCentsBreakdown(session);
  const lineItemsPriced = await buildDropshipLineItemsWithUnitPrices(
    supabase,
    session,
    variantLines
  );

  const shippingLines =
    centBreakdown.shippingCents > 0
      ? [
          {
            title: "Shipping (Stripe)",
            price: (centBreakdown.shippingCents / 100).toFixed(2),
            code: "stripe_shipping",
          },
        ]
      : undefined;

  const taxAmount =
    centBreakdown.taxCents > 0
      ? (centBreakdown.taxCents / 100).toFixed(2)
      : undefined;

  const namePhone = getCustomerNamePhoneForShopify(session, shippingAddress);
  const phone = namePhone.phone ?? shippingAddress?.phone ?? billingAddress?.phone;

  const cartParsedForTags = parseCartMetadata(session.metadata?.cart ?? "");
  const idsForTags = [...new Set(cartParsedForTags.map((c) => c.id))];
  let additionalMirrorTagsFromProducts = "";
  if (idsForTags.length > 0) {
    const { data: tagRows } = await supabase
      .from("products")
      .select("specifications")
      .in("id", idsForTags);
    additionalMirrorTagsFromProducts = mergeShopifyCommaTags(
      (tagRows ?? []).map((r) =>
        parseProductSpecifications(r.specifications)?.shopify_product_tags
      )
    );
  }

  try {
    const shopifyOrder = await createPaidOrderInShopify({
      stripeReference: {
        paymentIntentId,
        checkoutSessionId: sessionId,
      },
      email,
      lineItems: lineItemsPriced,
      totalAmount: amountNum.toFixed(2),
      currencyCode,
      shippingAddress,
      billingAddress: billingAddress ?? undefined,
      shippingLines,
      taxAmount,
      additionalMirrorTags: additionalMirrorTagsFromProducts || undefined,
      customer: {
        first_name: namePhone.first_name,
        last_name: namePhone.last_name,
        email,
        phone: phone ?? null,
      },
      noteAttributes: [
        { name: "platform_user_id", value: userId },
        { name: "app", value: "axelerate" },
        ...(centBreakdown.shippingCents
          ? [
              {
                name: "stripe_shipping_cents",
                value: String(centBreakdown.shippingCents),
              },
            ]
          : []),
        ...(centBreakdown.taxCents
          ? [
              { name: "stripe_tax_cents", value: String(centBreakdown.taxCents) },
            ]
          : []),
      ],
      sendReceipt: false,
    });
    console.info("[stripe webhook] Shopify order created (dropship card)", {
      sessionId,
      shopifyOrderId: shopifyOrder.orderId,
      shopifyOrderName: shopifyOrder.orderName,
    });

    if (creditsUsed > 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", userId)
        .single();
      if (prof) {
        const bal = Math.max(0, Number(prof.credit_balance ?? 0) - creditsUsed);
        const { error: upCr } = await supabase
          .from("profiles")
          .update({ credit_balance: bal, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (upCr) {
          console.error("[stripe webhook] dropshipping credit deduct", upCr, sessionId);
        }
      }
    }

    const cartForStock = parseCartMetadata(session.metadata?.cart ?? "");
    for (const line of cartForStock) {
      const { data: p } = await supabase
        .from("products")
        .select("stock_count, specifications")
        .eq("id", line.id)
        .single();
      if (
        p &&
        cartLineHasResolvableShopifyVariant({ specifications: p.specifications }, line)
      ) {
        continue;
      }
      if (p) {
        const newStock = Math.max(0, (p.stock_count ?? 0) - line.quantity);
        const { error: stErr } = await supabase
          .from("products")
          .update({ stock_count: newStock, updated_at: new Date().toISOString() })
          .eq("id", line.id);
        if (stErr) {
          console.error(
            "[stripe webhook] dropshipping local stock",
            stErr,
            line.id
          );
        }
      }
    }
  } catch (e) {
    console.error("[stripe webhook] createPaidOrderInShopify:", e, sessionId);
    await logShopifyOrderCreateFailure(supabase, e, {
      userId,
      orderId,
      checkoutSessionId: sessionId,
    });
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

  const fulfillEventTypes = new Set([
    "checkout.session.completed",
    /** 部分异步支付方式在 `completed` 时尚未 `paid`，成功付款后仅发此事件 */
    "checkout.session.async_payment_succeeded",
  ]);
  if (!fulfillEventTypes.has(event.type)) {
    return new Response("ok", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const supabase = createAdminClient();

  console.info("[stripe webhook] session event", {
    eventType: event.type,
    sessionId,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    purpose: session.metadata?.purpose ?? null,
    orderType: session.metadata?.orderType ?? null,
    hasDropshipLines: Boolean(session.metadata?.dropshipLines?.trim()),
  });

  /**
   * `checkout.session.completed` 在异步支付（及部分钱包）路径上可能早于扣款完成；
   * 未付清前不得写订单 —— 交给 `checkout.session.async_payment_succeeded`。
   */
  if (session.payment_status !== "paid") {
    console.info(
      "[stripe webhook] skip fulfillment — not paid yet (wait for async or retry)",
      { sessionId, eventType: event.type, payment_status: session.payment_status }
    );
    return new Response("ok", { status: 200 });
  }

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

  const shopProfileOk = await ensureProfileRowForUser(supabase, userId.trim());
  if (!shopProfileOk.ok) {
    console.error(
      "[stripe webhook] shop: no profiles row",
      shopProfileOk.error,
      sessionId
    );
    return new Response("User profile missing", { status: 400 });
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
  const metaCentsParsed = Number(String(expectedCents ?? "").trim());
  /** 创建 Session 时写入的预期美分；Stripe `amount_total` 为收款侧真值 */
  const metaUsdCentsLooksValid =
    expectedCents != null &&
    expectedCents !== "" &&
    Number.isFinite(metaCentsParsed) &&
    Math.floor(metaCentsParsed) === metaCentsParsed;

  const recomputedPaidCents = Math.round(pricing.amountToPayUsd * 100);
  const CENT_SLACK = 10;

  function centsClose(a: number, b: number): boolean {
    return Math.abs(a - b) <= CENT_SLACK;
  }

  const stripeAmountMatchesStoredMeta =
    metaUsdCentsLooksValid && centsClose(metaCentsParsed, paidCents);

  if (!centsClose(recomputedPaidCents, paidCents) && !stripeAmountMatchesStoredMeta) {
    console.error(
      "[stripe webhook] amount verification failed (catalog vs Stripe, and meta vs Stripe)",
      {
        sessionId,
        paidCents,
        recomputedPaidCents,
        metaCents: metaUsdCentsLooksValid ? metaCentsParsed : null,
        expectedCentsRaw: expectedCents,
      }
    );
    return new Response("Amount mismatch", { status: 400 });
  }

  if (
    recomputedPaidCents !== paidCents &&
    !centsClose(recomputedPaidCents, paidCents) &&
    stripeAmountMatchesStoredMeta
  ) {
    console.warn(
      "[stripe webhook] recomputed cents differ from Stripe; trusting Stripe metadata+amount_total",
      { paidCents, recomputedPaidCents, sessionId }
    );
  }

  /** 与 `handleDropshippingSession` 对齐：拉完整 Session，供 `syncMirroredWalletOrderToShopify` 使用。 */
  let sessionForFulfill: Stripe.Checkout.Session = session;
  if (stripe) {
    try {
      sessionForFulfill = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["shipping_cost.shipping_rate"],
      });
    } catch (e) {
      console.warn(
        "[stripe webhook] sessions.retrieve(expand) failed, using webhook payload for fulfill",
        e
      );
    }
  }

  const result = await fulfillPerksShopOrder(supabase, {
    userId,
    cartItems,
    deductCashFromBalance: 0,
    deductCredits: pricing.actualCreditsUsed,
    orderCashPaid: pricing.amountToPayUsd,
    stripeCheckoutSessionId: sessionId,
    stripeCheckoutSession: sessionForFulfill,
  });

  if (!result.success) {
    console.error("[stripe webhook] fulfill failed:", result.error, sessionId);
    return new Response(result.error, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
