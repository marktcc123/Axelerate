"use server";

import type Stripe from "stripe";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { verifyCartAndComputeUsdDue } from "@/lib/perks-checkout-pricing";
import { formatCartMetadataLine } from "@/lib/cart-metadata";
import { encodeDropshipLineMetadata } from "@/lib/shopify/dropship-from-product";
import { parseProductSpecifications, resolveVariantIdForCheckout } from "@/lib/shopify/product-specifications";
import type { CartLine } from "@/lib/perks-order-fulfill";

export async function createStripeCheckoutSession(
  cartItems: CartLine[],
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

  const cartMeta = cartItems
    .map((c) => formatCartMetadataLine(c.id, c.quantity, c.shopifyVariantId))
    .join(",");
  if (cartMeta.length > 450) {
    return { error: "Cart is too large for card checkout — remove some items." };
  }

  const productIdsForDropshipMeta = cartItems.map((c) => c.id);
  const { data: prodRowsForDs } = await supabase
    .from("products")
    .select("id, fulfillment_type, specifications")
    .in("id", productIdsForDropshipMeta);
  const pmapDs = new Map((prodRowsForDs ?? []).map((p) => [p.id, p]));
  const dropshipVariantLines: { shopifyVariantId: string; quantity: number }[] =
    [];
  for (const c of cartItems) {
    const row = pmapDs.get(c.id);
    if (!row || (row.fulfillment_type ?? "").toLowerCase() !== "dropshipping") {
      continue;
    }
    const spec = parseProductSpecifications(row.specifications);
    const vid = resolveVariantIdForCheckout(spec, c.shopifyVariantId ?? null);
    if (!vid) {
      return {
        error:
          "购物车含代发货商品但缺少 Shopify 变体 id。请同步商品（npm run sync:shopify-products）或仅使用纯代发车结账。",
      };
    }
    dropshipVariantLines.push({ shopifyVariantId: vid, quantity: c.quantity });
  }

  let dropshipLinesEncoded: string | null = null;
  if (dropshipVariantLines.length > 0) {
    try {
      const enc = encodeDropshipLineMetadata(dropshipVariantLines);
      if (enc.length > 450) {
        return {
          error:
            "购物车中代发货项过多（metadata 超长）。请分拆下单或仅用代发货结账。",
        };
      }
      dropshipLinesEncoded = enc;
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Invalid dropship line metadata.",
      };
    }
  }

  const needsAddressForMixedDropship = dropshipVariantLines.length > 0;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
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
      ...(dropshipLinesEncoded ? { dropshipLines: dropshipLinesEncoded } : {}),
    },
    client_reference_id: user.id,
    ...(needsAddressForMixedDropship
      ? {
          shipping_address_collection: {
            allowed_countries: getStripeCheckoutShippingCountries(),
          },
          phone_number_collection: { enabled: true },
        }
      : {}),
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return { error: "Could not start Stripe Checkout." };
  }
  return { url: session.url };
}

function getStripeCheckoutShippingCountries(): Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] {
  const raw = process.env.STRIPE_CHECKOUT_SHIPPING_COUNTRIES?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  }
  return [
    "US", "CA", "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "AU", "NZ",
    "SG", "JP", "KR", "HK", "MO", "TW", "TH", "MY", "PH", "VN", "IN", "AE", "SA",
    "BR", "MX", "AR", "CO", "CL", "PE",
  ] as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
}

/**
 * Perks 购物车**全部为** `fulfillment_type = dropshipping` 且 Stripe 用卡支付时使用。
 * 与 `orderType: dropshipping` + `dropshipLines` 配合 `checkout.session.completed` → 写 Shopify 订单（库存/客户/地址）。
 * 变体 ID 来自 `products.specifications.shopify_variants`（需已跑 `sync:shopify-products` 或 Webhook 同步过）。
 * 本地调试：需 `stripe listen --forward-to localhost:3000/api/webhooks/stripe`，且 Dashboard 的 webhook 不会打到 localhost。
 */
export async function createDropshippingStripeCheckoutSession(
  cartItems: CartLine[],
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

  const productIds = cartItems.map((c) => c.id);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, fulfillment_type, specifications")
    .in("id", productIds);

  if (prodErr || !products?.length) {
    return { error: "Failed to load products for dropshipping checkout." };
  }
  const productMap = new Map(products.map((p) => [p.id, p]));

  const lines: { shopifyVariantId: string; quantity: number }[] = [];
  for (const c of cartItems) {
    const p = productMap.get(c.id);
    if (!p) return { error: "Product not found." };
    if ((p.fulfillment_type ?? "").toLowerCase() !== "dropshipping") {
      return {
        error:
          "Cart contains non-dropshipping items. Use standard card checkout (internal fulfillment) or remove them.",
      };
    }
    const spec = parseProductSpecifications(p.specifications);
    const vid = resolveVariantIdForCheckout(spec, c.shopifyVariantId);
    if (!vid) {
      return {
        error:
          "A dropshipping product is missing a Shopify variant id. Run: npm run sync:shopify-products (or wait for product sync) then try again.",
      };
    }
    lines.push({ shopifyVariantId: vid, quantity: c.quantity });
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

  const cartMeta = cartItems
    .map((c) => formatCartMetadataLine(c.id, c.quantity, c.shopifyVariantId))
    .join(",");
  if (cartMeta.length > 450) {
    return { error: "Cart is too large for card checkout — remove some items." };
  }

  let dropshipLines: string;
  try {
    dropshipLines = encodeDropshipLineMetadata(lines);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid variant metadata." };
  }
  if (dropshipLines.length > 450) {
    return { error: "Dropship line metadata too long — try fewer line items." };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Axelerate Perks Shop (Dropship)",
            description: `${cartItems.length} line(s) — synced to Shopify`,
          },
          unit_amount: cents,
        },
        quantity: 1,
      },
    ],
    shipping_address_collection: {
      allowed_countries: getStripeCheckoutShippingCountries(),
    },
    phone_number_collection: { enabled: true },
    success_url: `${origin}/?tab=shop&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?tab=shop&checkout=cancelled`,
    metadata: {
      userId: user.id,
      orderType: "dropshipping",
      cart: cartMeta,
      dropshipLines,
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
