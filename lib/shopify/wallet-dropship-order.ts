import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "@/lib/perks-order-fulfill";
import {
  createPaidOrderInShopify,
  type StripeMirroredLineItem,
} from "@/lib/shopify/api";
import {
  getUnitPriceUsd,
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

/**
 * 余额结账且全部为 dropshipping 时，在 `fulfillPerksShopOrder` 内调用：写 Shopify 已支付订单、客户、地址、扣 Shopify 可售量。
 */
export async function syncDropshipWalletOrderToShopify(
  supabase: SupabaseClient,
  input: {
    userId: string;
    orderId: string;
    cartItems: CartLine[];
    orderCashPaid: number;
    deductCredits: number;
    products: ProductRow[];
  }
): Promise<void> {
  const { userId, orderId, cartItems, orderCashPaid, deductCredits, products } =
    input;
  if (cartItems.length === 0) return;

  const pmap = new Map(products.map((p) => [p.id, p]));
  const lineVariants: { shopifyVariantId: string; quantity: number }[] = [];
  for (const c of cartItems) {
    const p = pmap.get(c.id);
    if (!p) return;
    if ((p.fulfillment_type ?? "").toLowerCase() !== "dropshipping") {
      return;
    }
    const spec = parseProductSpecifications(p.specifications);
    const vid =
      resolveVariantIdForCheckout(spec, c.shopifyVariantId) ??
      getDefaultShopifyVariantIdFromProduct(p.specifications);
    if (!vid) {
      await insertErrorLog(supabase, {
        source: "shopify_wallet_dropship",
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
  }
  if (lineVariants.length !== cartItems.length) return;

  const { data: auth } = await supabase.auth.admin.getUserById(userId);
  const email = auth.user?.email?.trim();
  if (!email) {
    await insertErrorLog(supabase, {
      source: "shopify_wallet_dropship",
      message: "User has no email; cannot create Shopify order",
      context: { orderId },
      userId,
      orderId,
    });
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, shipping_address")
    .eq("id", userId)
    .single();

  const prof = (profile ?? {}) as Pick<
    Profile,
    "full_name" | "phone" | "shipping_address"
  >;
  const { shipping, firstName, lastName } = mapProfileToShopifyAddress(prof);

  const totalUsd = orderCashPaid + deductCredits / 100;
  const totalCents = Math.max(0, Math.round(totalUsd * 100));
  if (totalCents < 1) return;

  let sumCatalogUsd = 0;
  const lineCatalog: number[] = [];
  for (const c of cartItems) {
    const p = pmap.get(c.id)!;
    const spec = parseProductSpecifications(p.specifications);
    const rid = resolveVariantIdForCheckout(spec, c.shopifyVariantId) ?? null;
    const fallback = Number(p.discount_price ?? p.original_price ?? 0);
    const unit = rid
      ? getUnitPriceUsd(spec, rid, fallback)
      : fallback;
    const t = unit * c.quantity;
    lineCatalog.push(t);
    sumCatalogUsd += t;
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
        : Math.round(
            (totalCents * (lineCatalog[i] ?? 0)) / sumCatalogUsd
          );
      if (!isLast) allocated += lineCents;
      const u = (lineCents / 100) / Math.max(1, li.quantity);
      lineItems.push({
        shopifyVariantId: li.shopifyVariantId,
        quantity: li.quantity,
        unitPrice: u.toFixed(2),
      });
    }
  }

  try {
    await createPaidOrderInShopify({
      stripeReference: {
        checkoutSessionId: `wallet:${orderId}`,
      },
      email,
      lineItems,
      totalAmount: totalUsd.toFixed(2),
      currencyCode: "USD",
      paymentSource: "wallet",
      transactionGateway: "Axelerate",
      shippingAddress: shipping,
      billingAddress: { ...shipping },
      customer: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: prof.phone,
      },
      noteAttributes: [
        { name: "platform_user_id", value: userId },
        { name: "supabase_order_id", value: orderId },
        { name: "app", value: "axelerate" },
        { name: "wallet_cash_usd", value: String(orderCashPaid) },
        { name: "wallet_credits_points", value: String(deductCredits) },
      ],
      sendReceipt: false,
    });
  } catch (e) {
    const err = e as { message?: string };
    console.error("[wallet-dropship] createPaidOrderInShopify", e, orderId);
    await insertErrorLog(supabase, {
      source: "shopify_wallet_dropship",
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
