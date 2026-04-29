import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductRow } from "@/lib/shopify/wallet-dropship-order";
import {
  cartLineHasResolvableShopifyVariant,
  findVariantInSpecifications,
  getUnitPriceUsd,
  getVariantInventory,
  parseProductSpecifications,
  resolveVariantIdForCheckout,
} from "@/lib/shopify/product-specifications";
import { getDefaultShopifyVariantIdFromProduct } from "@/lib/shopify/dropship-from-product";
export type CheckoutFulfillResult =
  | { success: true }
  | { success: false; error: string };

export type CartLine = {
  id: string;
  quantity: number;
  /** Shopify Admin 变体数字 id 字符串；缺省则结账时取商品默认变体 */
  shopifyVariantId?: string;
};

/** 购物车目录价合计（USD），用于混合车在「可镜像 Shopify 行」与其它行间分摊实付。 */
function catalogUsdSubtotalForLines(
  lines: CartLine[],
  pmap: Map<
    string,
    {
      specifications: unknown;
      discount_price: number | null;
      original_price: number | null;
    }
  >
): number {
  let sum = 0;
  for (const c of lines) {
    const p = pmap.get(c.id);
    if (!p) continue;
    const spec = parseProductSpecifications(p.specifications);
    const vid =
      resolveVariantIdForCheckout(spec, c.shopifyVariantId ?? null) ??
      getDefaultShopifyVariantIdFromProduct(p.specifications);
    const fallback = Number(p.discount_price ?? p.original_price ?? 0);
    const unit = vid ? getUnitPriceUsd(spec, vid, fallback) : fallback;
    sum += unit * c.quantity;
  }
  return sum;
}

/**
 * 扣库存、写订单、记 product_purchases（余额结账与 Stripe webhook 共用）。
 * 调用前应由各入口完成验价；此处再次查库校验库存与余额。
 */
export async function fulfillPerksShopOrder(
  supabase: SupabaseClient,
  options: {
    userId: string;
    cartItems: CartLine[];
    deductCashFromBalance: number;
    deductCredits: number;
    orderCashPaid: number;
    stripeCheckoutSessionId?: string | null;
    /** Stripe 卡支付回填 Session，供 Shopify 镜像单使用收货信息与 session id（混合车）。 */
    stripeCheckoutSession?: Stripe.Checkout.Session | null;
  }
): Promise<CheckoutFulfillResult> {
  const {
    userId,
    cartItems,
    deductCashFromBalance,
    deductCredits,
    orderCashPaid,
    stripeCheckoutSessionId,
    stripeCheckoutSession,
  } = options;

  if (stripeCheckoutSessionId) {
    const { data: dup } = await supabase
      .from("orders")
      .select("id")
      .eq("stripe_checkout_session_id", stripeCheckoutSessionId)
      .maybeSingle();
    if (dup) return { success: true };
  }

  const productIds = cartItems.map((c) => c.id);
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select(
      "id, stock_count, fulfillment_type, specifications, discount_price, original_price"
    )
    .in("id", productIds);

  if (fetchError || !products) {
    console.error("[fulfillPerksShopOrder] fetch products:", fetchError);
    return { success: false, error: "Failed to verify inventory" };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  const mirrorLines = cartItems.filter((item) => {
    const product = productMap.get(item.id);
    return product ? cartLineHasResolvableShopifyVariant(product, item) : false;
  });

  const fullUsd = catalogUsdSubtotalForLines(cartItems, productMap);
  const mirrorUsd = catalogUsdSubtotalForLines(mirrorLines, productMap);
  const mirrorPaidShare =
    mirrorLines.length === 0
      ? { cash: 0, credits: 0 }
      : mirrorLines.length === cartItems.length
        ? { cash: orderCashPaid, credits: deductCredits }
        : (() => {
            let ratio =
              fullUsd > 0 && mirrorUsd > 0
                ? mirrorUsd / fullUsd
                : mirrorLines.length / Math.max(1, cartItems.length);
            if (ratio <= 0 || !Number.isFinite(ratio)) {
              ratio = mirrorLines.length / Math.max(1, cartItems.length);
            }
            const roundedCred = Math.round(deductCredits * ratio);
            const creditsShare =
              deductCredits <= 0
                ? 0
                : roundedCred > 0
                  ? roundedCred
                  : ratio > 0 && deductCredits > 0
                    ? Math.min(1, deductCredits)
                    : 0;
            return {
              cash: Number((orderCashPaid * ratio).toFixed(2)),
              credits: creditsShare,
            };
          })();
  for (const item of cartItems) {
    const product = productMap.get(item.id);
    if (!product) {
      return { success: false, error: "Product not found." };
    }
    const spec = parseProductSpecifications(product.specifications);
    const vid = resolveVariantIdForCheckout(spec, item.shopifyVariantId ?? null);
    if (spec?.shopify_variants?.length && vid) {
      const vrow = findVariantInSpecifications(spec, vid);
      const inv = vrow ? getVariantInventory(spec, vid) : null;
      if (inv != null) {
        if (inv < item.quantity) {
          return { success: false, error: "Out of stock" };
        }
        continue;
      }
      const stockLeft = product.stock_count ?? 0;
      if (stockLeft < item.quantity) {
        return { success: false, error: "Out of stock" };
      }
      continue;
    }
    const stockLeft = product.stock_count ?? 0;
    if (stockLeft < item.quantity) {
      return { success: false, error: "Out of stock" };
    }
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cash_balance, credit_balance")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Invalid user" };
  }

  const cashBalance = Number(profile.cash_balance ?? 0);
  const creditBalance = Number(profile.credit_balance ?? 0);

  if (creditBalance < deductCredits) {
    return { success: false, error: "Insufficient credits" };
  }
  if (deductCashFromBalance > 0 && cashBalance < deductCashFromBalance) {
    return { success: false, error: "Insufficient funds" };
  }

  try {
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        cash_balance: cashBalance - deductCashFromBalance,
        credit_balance: creditBalance - deductCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateProfileError) {
      console.error("[fulfillPerksShopOrder] profile update:", updateProfileError);
      return { success: false, error: "Checkout failed" };
    }

    for (const item of cartItems) {
      const product = productMap.get(item.id)!;
      if (cartLineHasResolvableShopifyVariant(product, item)) {
        continue;
      }
      const newStock = Math.max(0, (product.stock_count ?? 0) - item.quantity);
      const { error: updateStockError } = await supabase
        .from("products")
        .update({
          stock_count: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateStockError) {
        console.error("[fulfillPerksShopOrder] stock update:", updateStockError);
        return { success: false, error: "Inventory update failed" };
      }
    }
    const orderLine: Record<string, unknown> = {
      user_id: userId,
      cash_paid: orderCashPaid,
      credits_used: deductCredits,
      status: "processing",
      items: cartItems,
    };
    if (stripeCheckoutSessionId) {
      orderLine.stripe_checkout_session_id = stripeCheckoutSessionId;
    }

    const { data: insertedOrder, error: insertOrderError } = await supabase
      .from("orders")
      .insert(orderLine)
      .select("id")
      .single();

    if (insertOrderError) {
      if (
        insertOrderError.code === "23505" &&
        String(insertOrderError.message).includes("stripe_checkout_session_id")
      ) {
        return { success: true };
      }
      console.error("[fulfillPerksShopOrder] insert order:", insertOrderError);
      return { success: false, error: "Order creation failed" };
    }

    for (const item of cartItems) {
      await supabase.from("product_purchases").insert({
        user_id: userId,
        product_id: item.id,
        quantity: item.quantity,
      });
    }

    if (insertedOrder?.id) {
      const mirrorProducts = (products ?? []).filter((p) =>
        mirrorLines.some((l) => l.id === p.id)
      );
      if (mirrorLines.length > 0) {
        const { syncMirroredWalletOrderToShopify } = await import(
          "@/lib/shopify/wallet-dropship-order"
        );
        await syncMirroredWalletOrderToShopify(supabase, {
          userId,
          orderId: insertedOrder.id,
          cartItems: mirrorLines,
          orderCashPaid: mirrorPaidShare.cash,
          deductCredits: mirrorPaidShare.credits,
          products: mirrorProducts as ProductRow[],
          stripeCheckoutSession: stripeCheckoutSession ?? null,
        });
      }
    }
    revalidatePath("/");
    for (const item of cartItems) {
      revalidatePath(`/product/${item.id}`);
    }

    return { success: true };
  } catch (e) {
    console.error("[fulfillPerksShopOrder] error:", e);
    return { success: false, error: "Checkout failed" };
  }
}
