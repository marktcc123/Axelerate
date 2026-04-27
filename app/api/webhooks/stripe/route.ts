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
import { logShopifyOrderCreateFailure } from "@/lib/supabase/error-logs";
import {
  parseCartMetadata,
  verifyCartAndComputeUsdDue,
} from "@/lib/perks-checkout-pricing";
import { parseDropshipLineMetadata } from "@/lib/shopify/dropship-from-product";
import type { StripeMirroredLineItem } from "@/lib/shopify/api";

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

/**
 * 优先用 Checkout 的 shipping_details；无物理发货/仅账单地址时用 customer_details.address（Stripe 常见）。
 * Shopify 的 shipping_address 供 Spocket 等 dropship 用，尽量填全。
 */
function mapStripeAddressToShopify(
  session: Stripe.Checkout.Session
): CreatePaidOrderInShopifyInput["shippingAddress"] | undefined {
  const s = (session as SessionWithShipping).shipping_details;
  const shipA = s?.address;
  if (shipA?.line1) {
    const name = s?.name?.trim() || "Customer";
    const [first, ...rest] = name.split(/\s+/);
    return {
      first_name: first || "Customer",
      last_name: rest.join(" ") || "-",
      address1: shipA.line1 || "",
      city: shipA.city || "",
      province: shipA.state || "",
      country: shipA.country || "",
      zip: shipA.postal_code || "",
      phone: s?.phone || undefined,
    };
  }
  const cd = session.customer_details;
  const ca = cd?.address;
  if (cd && ca?.line1) {
    const name = cd.name?.trim() || "Customer";
    const [first, ...rest] = name.split(/\s+/);
    return {
      first_name: first || "Customer",
      last_name: rest.join(" ") || "-",
      address1: ca.line1 || "",
      city: ca.city || "",
      province: ca.state || "",
      country: ca.country || "",
      zip: ca.postal_code || "",
      phone: (cd as { phone?: string | null }).phone ?? s?.phone ?? undefined,
    };
  }
  return undefined;
}

/**
 * 账单 / 常出现在 `customer_details`（与 shipping_details 可并存于物理发货单）。
 */
function mapStripeBillingToShopify(
  session: Stripe.Checkout.Session
): CreatePaidOrderInShopifyInput["billingAddress"] | undefined {
  const cd = session.customer_details;
  if (!cd) return undefined;
  const ca = cd.address;
  if (!ca?.line1) return undefined;
  const name = cd.name?.trim() || "Customer";
  const [first, ...rest] = name.split(/\s+/);
  return {
    first_name: first || "Customer",
    last_name: rest.join(" ") || "-",
    address1: ca.line1 || "",
    city: ca.city || "",
    province: ca.state || "",
    country: ca.country || "",
    zip: ca.postal_code || "",
    phone: (cd as { phone?: string | null }).phone ?? undefined,
  };
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
 * 取用于 Shopify Customer/行的姓名与电话；优先收货运收货人，其次 Stripe 客户资料。
 */
function getCustomerNamePhoneForShopify(
  session: Stripe.Checkout.Session,
  shipping: CreatePaidOrderInShopifyInput["shippingAddress"]
): { first_name: string; last_name: string; phone: string | undefined } {
  const s = (session as SessionWithShipping).shipping_details;
  if (s?.name?.trim() || s?.phone) {
    const name = s.name?.trim() || "Customer";
    const [first, ...rest] = name.split(/\s+/);
    return {
      first_name: first || "Customer",
      last_name: rest.join(" ") || "-",
      phone: s.phone ?? undefined,
    };
  }
  const cd = session.customer_details;
  if (cd && cd.name?.trim()) {
    const name = cd.name.trim();
    const [first, ...rest] = name.split(/\s+/);
    return {
      first_name: first || "Customer",
      last_name: rest.join(" ") || "-",
      phone: (cd as { phone?: string | null }).phone ?? undefined,
    };
  }
  if (shipping) {
    return {
      first_name: shipping.first_name,
      last_name: shipping.last_name,
      phone: shipping.phone,
    };
  }
  return { first_name: "Customer", last_name: "-", phone: undefined };
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
  const itemsRow = variantLines.map((l) => ({
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
      credits_used: creditsUsed,
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
        .select("stock_count")
        .eq("id", line.id)
        .single();
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

  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const supabase = createAdminClient();

  console.info("[stripe webhook] checkout.session.completed", {
    sessionId,
    purpose: session.metadata?.purpose ?? null,
    orderType: session.metadata?.orderType ?? null,
    hasDropshipLines: Boolean(session.metadata?.dropshipLines?.trim()),
  });

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
