import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "@/lib/perks-order-fulfill";
import {
  mapStripeAddressToShopify,
  mapStripeBillingToShopify,
  getCustomerNamePhoneForStripeShopify as getStripeNamePhoneForShopify,
} from "@/lib/stripe/checkout-session-shopify-maps";
import {
  createPaidOrderInShopify,
  isShopifyAdminConfiguredForMirroring,
  type StripeMirroredLineItem,
} from "@/lib/shopify/api";
import {
  getUnitPriceUsd,
  mergeShopifyCommaTags,
  parseProductSpecifications,
  resolveVariantIdForCheckout,
} from "@/lib/shopify/product-specifications";
import { getDefaultShopifyVariantIdFromProduct } from "@/lib/shopify/dropship-from-product";
import { insertErrorLog } from "@/lib/supabase/error-logs";
import type { Profile } from "@/lib/types";

export type ProductRow = {
  id: string;
  fulfillment_type: string | null;
  specifications: unknown;
  discount_price: number | null;
  original_price: number | null;
};

/**
 * 将 `profiles.shipping_address` 映射为 Shopify 地址；缺字段时用占位符。
 */
function mapProfileToShopifyAddress(
  profile: Pick<Profile, "full_name" | "phone" | "shipping_address">
): {
  shipping: import("@/lib/shopify/api").ShopifyAddressInput;
  firstName: string;
  lastName: string;
} {
  const raw = profile.shipping_address;
  const name = (profile.full_name ?? "Customer").trim() || "Customer";
  const [first, ...rest] = name.split(/\s+/);
  const firstName = first || "Customer";
  const lastName = rest.length > 0 ? rest.join(" ") : "-";

  if (raw && typeof raw === "object" && "address_line1" in raw) {
    const a = raw as {
      address_line1?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    };
    return {
      firstName,
      lastName,
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address1: a.address_line1 || "—",
        city: a.city || "—",
        province: a.state || "—",
        country: (raw as { country?: string }).country || "US",
        zip: a.zip_code || "—",
        phone: profile.phone ?? undefined,
      },
    };
  }

  return {
    firstName,
    lastName,
    shipping: {
      first_name: firstName,
      last_name: lastName,
      address1: "— (fill in profile / settings shipping)",
      city: "—",
      province: "—",
      country: "US",
      zip: "—",
      phone: profile.phone ?? undefined,
    },
  };
}

/** 任一含 Shopify 变体的行：**余额 / Stripe** 结账后在 Admin 镜像建单（由 Shopify 扣库存）；商品后台 `tags` 并入镜像单 `tags`。 */
export async function syncMirroredWalletOrderToShopify(
  supabase: SupabaseClient,
  input: {
    userId: string;
    orderId: string;
    cartItems: CartLine[];
    orderCashPaid: number;
    deductCredits: number;
    products: ProductRow[];
    stripeCheckoutSession?: Stripe.Checkout.Session | null;
  }
): Promise<void> {
  const {
    userId,
    orderId,
    cartItems,
    orderCashPaid,
    deductCredits,
    products,
    stripeCheckoutSession,
  } = input;
  if (cartItems.length === 0) return;

  const pmap = new Map(products.map((p) => [p.id, p]));
  const lineVariants: { shopifyVariantId: string; quantity: number }[] = [];
  const lineCatalog: number[] = [];
  let sumCatalogUsd = 0;

  for (const c of cartItems) {
    const p = pmap.get(c.id);
    if (!p) {
      await insertErrorLog(supabase, {
        source: "shopify_order_mirror",
        message: "Product row missing for Shopify mirror",
        context: { productId: c.id, orderId },
        userId,
        orderId,
      });
      await supabase
        .from("orders")
        .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return;
    }
    const spec = parseProductSpecifications(p.specifications);
    const vid =
      resolveVariantIdForCheckout(spec, c.shopifyVariantId ?? null) ??
      getDefaultShopifyVariantIdFromProduct(p.specifications);
    if (!vid) {
      await insertErrorLog(supabase, {
        source: "shopify_order_mirror",
        message: "Missing shopify_variants in product specifications",
        context: { productId: p.id, orderId },
        userId,
        orderId,
      });
      await supabase
        .from("orders")
        .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return;
    }
    lineVariants.push({ shopifyVariantId: vid, quantity: c.quantity });
    const fallback = Number(p.discount_price ?? p.original_price ?? 0);
    const unitUsd = getUnitPriceUsd(spec, vid, fallback);
    const lineAmt = unitUsd * c.quantity;
    lineCatalog.push(lineAmt);
    sumCatalogUsd += lineAmt;
  }

  const additionalMirrorTags = mergeShopifyCommaTags(
    cartItems
      .map((c) => {
        const p = pmap.get(c.id);
        if (!p) return "";
        const spec = parseProductSpecifications(p.specifications);
        return spec?.shopify_product_tags ?? "";
      })
      .filter(Boolean)
  );

  const { data: auth } = await supabase.auth.admin.getUserById(userId);

  let email =
    stripeCheckoutSession?.customer_details?.email?.trim() ??
    auth?.user?.email?.trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, shipping_address")
    .eq("id", userId)
    .single();

  const prof = (profile ?? {}) as Pick<
    Profile,
    "full_name" | "phone" | "shipping_address"
  >;
  const fromProfile = mapProfileToShopifyAddress(prof);
  let shipping = fromProfile.shipping;
  let firstName = fromProfile.firstName;
  let lastName = fromProfile.lastName;

  if (stripeCheckoutSession) {
    const shipAd = mapStripeAddressToShopify(stripeCheckoutSession);
    const billAd = mapStripeBillingToShopify(stripeCheckoutSession);
    const np = getStripeNamePhoneForShopify(
      stripeCheckoutSession,
      shipAd ?? billAd ?? undefined
    );
    firstName = np.first_name;
    lastName = np.last_name;
    shipping =
      shipAd ??
      billAd ?? {
        first_name: np.first_name,
        last_name: np.last_name,
        address1: "—",
        city: "—",
        province: "—",
        country: "US",
        zip: "—",
        phone: np.phone,
      };
    email =
      email ??
      stripeCheckoutSession.customer_email?.trim() ??
      auth?.user?.email?.trim();
  }

  const emailResolved = email?.trim();
  if (!emailResolved) {
    await insertErrorLog(supabase, {
      source: "shopify_order_mirror",
      message:
        "No usable email for Shopify order mirror (Stripe session + Auth both empty)",
      context: { orderId },
      userId,
      orderId,
    });
    await supabase
      .from("orders")
      .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return;
  }

  const paidUsdMirror = orderCashPaid + deductCredits / 100;
  let mirrorUsd = paidUsdMirror;
  let totalCents = Math.max(0, Math.round(mirrorUsd * 100));

  if (totalCents < 1 && sumCatalogUsd >= 0.01) {
    mirrorUsd = sumCatalogUsd;
    totalCents = Math.max(1, Math.round(mirrorUsd * 100));
    await insertErrorLog(supabase, {
      source: "shopify_order_mirror",
      message:
        "Mirror USD rounded to zero; fallback to catalog subtotal for Shopify",
      context: {
        orderId,
        paidUsdMirror,
        deductCreditsPts: deductCredits,
        sumCatalogUsd,
        centsAfterFallback: totalCents,
      },
      userId,
      orderId,
    });
  }

  if (lineVariants.length > 0 && totalCents < 1) {
    await insertErrorLog(supabase, {
      source: "shopify_order_mirror",
      message: "Mirror order total remains zero cents; cannot POST Shopify order",
      context: { orderId, paidUsdMirror, sumCatalogUsd },
      userId,
      orderId,
    });
    await supabase
      .from("orders")
      .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return;
  }

  let lineItems: StripeMirroredLineItem[] = [];
  if (sumCatalogUsd <= 0) {
    const u = lineVariants.reduce((a, b) => a + b.quantity, 0);
    const per = (totalCents / 100) / Math.max(1, u);
    lineItems = lineVariants.map((l) => ({
      ...l,
      unitPrice: per.toFixed(2),
    }));
  } else {
    let allocated = 0;
    const n = lineVariants.length;
    for (let i = 0; i < n; i++) {
      const li = lineVariants[i]!;
      const isLast = i === n - 1;
      const lineCents = isLast
        ? totalCents - allocated
        : Math.round((totalCents * (lineCatalog[i] ?? 0)) / sumCatalogUsd);
      if (!isLast) allocated += lineCents;
      const u = (lineCents / 100) / Math.max(1, li.quantity);
      lineItems.push({
        shopifyVariantId: li.shopifyVariantId,
        quantity: li.quantity,
        unitPrice: u.toFixed(2),
      });
    }
  }

  const stripeRef = stripeCheckoutSession
    ? {
        checkoutSessionId: stripeCheckoutSession.id,
        paymentIntentId:
          typeof stripeCheckoutSession.payment_intent === "string"
            ? stripeCheckoutSession.payment_intent
            : stripeCheckoutSession.payment_intent?.id ?? undefined,
      }
    : { checkoutSessionId: `wallet:${orderId}` };

  const billingAddress =
    stripeCheckoutSession ?
      mapStripeBillingToShopify(stripeCheckoutSession) ?? { ...shipping }
    : { ...shipping };

  const stripeNamePhone =
    stripeCheckoutSession ?
      getStripeNamePhoneForShopify(stripeCheckoutSession, shipping)
    : null;
  const stripePhoneFromDetails =
    typeof stripeCheckoutSession?.customer_details?.phone === "string"
      ? stripeCheckoutSession.customer_details.phone.trim()
      : undefined;
  const customerPhone =
    stripeNamePhone?.phone ?? stripePhoneFromDetails ?? prof.phone ?? undefined;

  if (!isShopifyAdminConfiguredForMirroring()) {
    await insertErrorLog(supabase, {
      source: "shopify_order_mirror",
      message:
        "Shopify Admin not configured: set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN on the server, then redeploy.",
      context: { orderId },
      userId,
      orderId,
    });
    await supabase
      .from("orders")
      .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return;
  }

  try {
    await createPaidOrderInShopify({
      stripeReference: stripeRef,
      email: emailResolved,
      lineItems,
      totalAmount: mirrorUsd.toFixed(2),
      currencyCode: "USD",
      paymentSource: stripeCheckoutSession ? "stripe" : "wallet",
      transactionGateway: stripeCheckoutSession ? "Stripe" : "Axelerate",
      shippingAddress: shipping,
      billingAddress,
      additionalMirrorTags: additionalMirrorTags || undefined,
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: emailResolved,
        phone: customerPhone ?? null,
      },
      noteAttributes: [
        { name: "platform_user_id", value: userId },
        { name: "supabase_order_id", value: orderId },
        { name: "app", value: "axelerate" },
        { name: "mirror_cash_usd", value: String(orderCashPaid) },
        { name: "mirror_credits_pts", value: String(deductCredits) },
        {
          name: "checkout_channel",
          value: stripeCheckoutSession ? "stripe_card_mirrored" : "wallet_mirrored",
        },
      ],
      sendReceipt: false,
    });
  } catch (e) {
    const err = e as { message?: string };
    console.error("[shopify-order-mirror] createPaidOrderInShopify", e, orderId);
    await insertErrorLog(supabase, {
      source: "shopify_order_mirror",
      message: err.message ?? String(e),
      context: { stack: e instanceof Error ? e.stack : undefined },
      userId,
      orderId,
    });
    await supabase
      .from("orders")
      .update({ status: "shopify_sync_failed", updated_at: new Date().toISOString() })
      .eq("id", orderId);
  }
}

/** @deprecated 使用 `syncMirroredWalletOrderToShopify` */
export const syncDropshipWalletOrderToShopify = syncMirroredWalletOrderToShopify;
