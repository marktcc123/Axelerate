import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "@/lib/perks-order-fulfill";
import { canAccessTier, resolveTierKey } from "@/lib/types";
import {
  findVariantInSpecifications,
  getUnitPriceUsd,
  getVariantInventory,
  parseProductSpecifications,
  resolveVariantIdForCheckout,
} from "@/lib/shopify/product-specifications";
import { parseCartMetadata as parseCartMetadataFromLib } from "@/lib/cart-metadata";

export type PricingResult =
  | { ok: false; error: string }
  | {
      ok: true;
      amountToPayUsd: number;
      actualCreditsUsed: number;
      totalAmountUsd: number;
    };

/**
 * 与 processCheckout / Stripe 共用：验价、库存、积分抵扣后的应付美金（不含余额是否足够）。
 */
export async function verifyCartAndComputeUsdDue(
  supabase: SupabaseClient,
  userId: string,
  cartItems: CartLine[],
  creditsToUse: number
): Promise<PricingResult> {
  if (!userId || cartItems.length === 0) {
    return { ok: false, error: "Invalid request" };
  }

  const productIds = cartItems.map((c) => c.id);

  const [{ data: products, error: fetchError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, discount_price, original_price, stock_count, specifications, min_tier_required, credit_cashback_percent"
        )
        .in("id", productIds),
      supabase
        .from("profiles")
        .select("credit_balance, tier")
        .eq("id", userId)
        .single(),
    ]);

  if (fetchError || !products) {
    return { ok: false, error: "Failed to verify products" };
  }

  if (profileError || !profile) {
    return { ok: false, error: "Invalid user" };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  const userTier = resolveTierKey(profile.tier);
  const creditBalance = Number(profile.credit_balance ?? 0);

  for (const item of cartItems) {
    const row = productMap.get(item.id);
    if (!row) {
      return { ok: false, error: "Product not found." };
    }
    const requiredTier = resolveTierKey(
      row.min_tier_required as string | undefined
    );
    if (!canAccessTier(userTier, requiredTier)) {
      return {
        ok: false,
        error:
          "Your current rank can't purchase one or more items in this cart — remove locked items or level up.",
      };
    }
  }

  let totalAmount = 0;
  for (const item of cartItems) {
    const product = productMap.get(item.id)!;

    const spec = parseProductSpecifications(product.specifications);
    const vid = resolveVariantIdForCheckout(spec, item.shopifyVariantId ?? null);

    if (spec?.shopify_variants?.length && vid) {
      const vrow = findVariantInSpecifications(spec, vid);
      const inv = vrow ? getVariantInventory(spec, vid) : null;
      if (inv != null) {
        if (inv <= 0) {
          return { ok: false, error: "Too late! This item is already sold out." };
        }
        if (inv < item.quantity) {
          return { ok: false, error: "Out of stock" };
        }
      } else {
        const stockLeft = product.stock_count ?? 0;
        if (stockLeft <= 0) {
          return { ok: false, error: "Too late! This item is already sold out." };
        }
        if (stockLeft < item.quantity) {
          return { ok: false, error: "Out of stock" };
        }
      }
      const fallbackUnit = Number(product.discount_price ?? product.original_price ?? 0);
      const unitPrice = getUnitPriceUsd(spec, vid, fallbackUnit);
      if (unitPrice <= 0) {
        return { ok: false, error: "Product has no cash price" };
      }
      totalAmount += unitPrice * item.quantity;
      continue;
    }

    const stockLeft = product.stock_count ?? 0;
    if (stockLeft <= 0) {
      return { ok: false, error: "Too late! This item is already sold out." };
    }
    if (stockLeft < item.quantity) {
      return { ok: false, error: "Out of stock" };
    }
    const unitPrice = product.discount_price ?? product.original_price ?? 0;
    if (Number(unitPrice) <= 0) {
      return { ok: false, error: "Product has no cash price" };
    }
    totalAmount += Number(unitPrice) * item.quantity;
  }

  const maxCreditsAllowed = Math.min(
    creditBalance,
    Math.floor(totalAmount * 100)
  );
  const actualCreditsUsed = Math.min(creditsToUse, maxCreditsAllowed);
  const creditsDiscountUsd = actualCreditsUsed / 100;
  const amountToPayUsd = Math.max(0, totalAmount - creditsDiscountUsd);

  if (creditBalance < actualCreditsUsed) {
    return { ok: false, error: "Insufficient credits" };
  }

  return {
    ok: true,
    amountToPayUsd,
    actualCreditsUsed,
    totalAmountUsd: totalAmount,
  };
}

export function parseCartMetadata(cartRaw: string): CartLine[] {
  return parseCartMetadataFromLib(cartRaw);
}
