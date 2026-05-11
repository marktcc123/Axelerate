import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductRow } from "@/lib/shopify/wallet-dropship-order";
import {
  cartLineHasResolvableShopifyVariant,
  getVariantInventory,
  parseProductSpecifications,
  resolveVariantIdForCheckout,
} from "@/lib/shopify/product-specifications";
import type { CartLine, CheckoutFulfillResult } from "@/lib/perks-order-fulfill";

/**
 * 礼品领取人生成履约订单：不二次扣款 / 不改库存（付款方已买断），按需触发 Shopify 镜像。
 */
export async function createGiftRecipientPerksOrder(
  supabase: SupabaseClient,
  opts: {
    recipientUserId: string;
    cartItems: CartLine[];
    mirrorPaidShare: { cash: number; credits: number };
  }
): Promise<CheckoutFulfillResult> {
  const { recipientUserId, cartItems, mirrorPaidShare } = opts;

  if (!cartItems.length) {
    return { success: false, error: "Invalid gift items" };
  }

  const productIds = [...new Set(cartItems.map((c) => c.id))];
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select(
      "id, stock_count, fulfillment_type, specifications, discount_price, original_price"
    )
    .in("id", productIds);

  if (fetchError || !products?.length) {
    console.error("[createGiftRecipientPerksOrder] fetch products:", fetchError);
    return { success: false, error: "Failed to verify products" };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  const mirrorLines = cartItems.filter((item) => {
    const product = productMap.get(item.id);
    return product ? cartLineHasResolvableShopifyVariant(product, item) : false;
  });

  const orderLine: Record<string, unknown> = {
    user_id: recipientUserId,
    cash_paid: 0,
    credits_used: 0,
    status: "processing",
    items: cartItems.map((row) => ({ ...row, orderType: "gift_redemption" })),
  };

  const { data: insertedOrder, error: insertErr } = await supabase
    .from("orders")
    .insert(orderLine)
    .select("id")
    .single();

  if (insertErr || !insertedOrder?.id) {
    console.error("[createGiftRecipientPerksOrder] insert order:", insertErr);
    return { success: false, error: "Could not create your gift order" };
  }

  for (const item of cartItems) {
    await supabase.from("product_purchases").insert({
      user_id: recipientUserId,
      product_id: item.id,
      quantity: item.quantity,
    });
  }

  const mirrorProducts = (products ?? []).filter((p) =>
    mirrorLines.some((l) => l.id === p.id)
  );

  if (mirrorLines.length > 0) {
    try {
      const { syncMirroredWalletOrderToShopify } = await import(
        "@/lib/shopify/wallet-dropship-order"
      );
      await syncMirroredWalletOrderToShopify(supabase, {
        userId: recipientUserId,
        orderId: insertedOrder.id as string,
        cartItems: mirrorLines,
        orderCashPaid: mirrorPaidShare.cash,
        deductCredits: mirrorPaidShare.credits,
        products: mirrorProducts as ProductRow[],
        stripeCheckoutSession: null,
      });
    } catch (e) {
      console.error("[createGiftRecipientPerksOrder] shopify:", e);
    }
  }

  revalidatePath("/");
  revalidatePath("/my-orders");
  for (const item of cartItems) {
    revalidatePath(`/product/${item.id}`);
  }

  return {
    success: true,
    orderId: insertedOrder.id as string,
    mirrorPaidShare,
  };
}

/** 校验领取时库存仍可读（不向领取人扣减 DB 现货；镜像品由 Shopify 侧承担） */
export function assertGiftStillInStockSnapshot(
  cartItems: CartLine[],
  products: Array<{
    id: string;
    stock_count: number | null;
    specifications: unknown;
  }>
): { ok: true } | { ok: false; error: string } {
  const pmap = new Map(products.map((p) => [p.id, p]));
  for (const item of cartItems) {
    const product = pmap.get(item.id);
    if (!product) return { ok: false, error: "Product unavailable" };
    const spec = parseProductSpecifications(product.specifications);
    const vid = resolveVariantIdForCheckout(spec, item.shopifyVariantId ?? null);
    if (spec?.shopify_variants?.length && vid) {
      const inv = getVariantInventory(spec, vid);
      if (inv != null && inv < item.quantity) {
        return { ok: false, error: "Gift item just sold out — contact support." };
      }
      continue;
    }
    const stockLeft = product.stock_count ?? 0;
    if (stockLeft < item.quantity) {
      return { ok: false, error: "Gift item just sold out — contact support." };
    }
  }
  return { ok: true };
}
