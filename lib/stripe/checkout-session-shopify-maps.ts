import type Stripe from "stripe";
import type { CreatePaidOrderInShopifyInput } from "@/lib/shopify/api";

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
 * Stripe Checkout → Shopify `shipping_address`（dropship / 镜像订单用）。
 */
export function mapStripeAddressToShopify(
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
