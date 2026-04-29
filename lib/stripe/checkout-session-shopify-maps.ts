import type Stripe from "stripe";
import type { CreatePaidOrderInShopifyInput } from "@/lib/shopify/api";

type ShippingDetailBlock = {
  name?: string | null;
  phone?: string | null;
  address?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  } | null;
};

type SessionWithShipping = Stripe.Checkout.Session & {
  shipping_details?: ShippingDetailBlock | null;
  /** Stripe API 新版本：收货仅在 `collected_information`（Webhook 快照里常见） */
  collected_information?: { shipping_details?: ShippingDetailBlock | null } | null;
};

/**
 * Stripe Checkout → Shopify `shipping_address`（dropship / 镜像订单用）。
 */
function mapShippingDetailBlockToShopify(sh: ShippingDetailBlock | null | undefined) {
  const shipA = sh?.address;
  if (!shipA?.line1) return undefined;
  const name = sh?.name?.trim() || "Customer";
  const [first, ...rest] = name.split(/\s+/);
  return {
    first_name: first || "Customer",
    last_name: rest.join(" ") || "-",
    address1: shipA.line1 || "",
    city: shipA.city || "",
    province: shipA.state || "",
    country: shipA.country || "",
    zip: shipA.postal_code || "",
    phone: sh?.phone?.trim() || undefined,
  };
}

export function mapStripeAddressToShopify(
  session: Stripe.Checkout.Session
): CreatePaidOrderInShopifyInput["shippingAddress"] | undefined {
  const sess = session as SessionWithShipping;
  const fromTop =
    mapShippingDetailBlockToShopify(sess.shipping_details) ??
    mapShippingDetailBlockToShopify(
      sess.collected_information?.shipping_details ?? undefined
    );
  if (fromTop) return fromTop;

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
      phone:
        (cd as { phone?: string | null }).phone ??
        sess.shipping_details?.phone ??
        sess.collected_information?.shipping_details?.phone ??
        undefined,
    };
  }
  return undefined;
}

export function mapStripeBillingToShopify(
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

/** 收件人姓名/电话；优先 Stripe 收货信息。 */
export function getCustomerNamePhoneForStripeShopify(
  session: Stripe.Checkout.Session,
  shipping?: CreatePaidOrderInShopifyInput["shippingAddress"]
): { first_name: string; last_name: string; phone: string | undefined } {
  const sess = session as SessionWithShipping;
  const blocks = [
    sess.shipping_details,
    sess.collected_information?.shipping_details,
  ].filter(Boolean) as ShippingDetailBlock[];
  for (const s of blocks) {
    if (s?.name?.trim() || s?.phone?.trim()) {
      const name = (s!.name ?? "Customer").trim();
      const [first, ...rest] = name.split(/\s+/);
      return {
        first_name: first || "Customer",
        last_name: rest.join(" ") || "-",
        phone: s!.phone ?? undefined,
      };
    }
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
