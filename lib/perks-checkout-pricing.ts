import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "@/lib/perks-order-fulfill";

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
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("id, discount_price, original_price, stock_count")
    .in("id", productIds);

  if (fetchError || !products) {
    return { ok: false, error: "Failed to verify products" };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  for (const item of cartItems) {
    const product = productMap.get(item.id);
    if (!product) {
      return { ok: false, error: "Product not found." };
    }
    const stockLeft = product.stock_count ?? 0;
    if (stockLeft <= 0) {
      return { ok: false, error: "Too late! This item is already sold out." };
    }
    if (stockLeft < item.quantity) {
      return { ok: false, error: "Out of stock" };
    }
    const unitPrice = product.discount_price ?? product.original_price ?? 0;
    if (unitPrice <= 0) {
      return { ok: false, error: "Product has no cash price" };
    }
    totalAmount += Number(unitPrice) * item.quantity;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { ok: false, error: "Invalid user" };
  }

  const creditBalance = Number(profile.credit_balance ?? 0);
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
  if (!cartRaw?.trim()) return [];
  return cartRaw.split(",").map((pair) => {
    const idx = pair.lastIndexOf(":");
    if (idx === -1) return { id: pair, quantity: 1 };
    const id = pair.slice(0, idx);
    const quantity = Math.max(1, Math.floor(Number(pair.slice(idx + 1)) || 1));
    return { id, quantity };
  });
}
