import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductRow } from "@/lib/shopify/wallet-dropship-order";
import {
  findVariantInSpecifications,
  getVariantInventory,
  parseProductSpecifications,
  resolveVariantIdForCheckout,
} from "@/lib/shopify/product-specifications";

export type CheckoutFulfillResult =
  | { success: true }
  | { success: false; error: string };

export type CartLine = {
  id: string;
  quantity: number;
  /** Shopify Admin 变体数字 id 字符串；缺省则结账时取商品默认变体 */
  shopifyVariantId?: string;
};

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
  }
): Promise<CheckoutFulfillResult> {
  const {
    userId,
    cartItems,
    deductCashFromBalance,
    deductCredits,
    orderCashPaid,
    stripeCheckoutSessionId,
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

  for (const item of cartItems) {
    const product = productMap.get(item.id);
    if (!product) {
      return { success: false, error: "Product not found." };
    }
    const isDropship =
      (product.fulfillment_type ?? "").toLowerCase() === "dropshipping";
    const spec = parseProductSpecifications(product.specifications);
    if (isDropship && spec?.shopify_variants.length) {
      const vid = resolveVariantIdForCheckout(spec, item.shopifyVariantId ?? null);
      if (!vid) {
        return { success: false, error: "Missing Shopify variant" };
      }
      const vrow = findVariantInSpecifications(spec, vid);
      const inv = vrow ? getVariantInventory(spec, vid) : null;
      if (inv != null) {
        if (inv < item.quantity) {
          return { success: false, error: "Out of stock" };
        }
        continue;
      }
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
      const isDropship =
        (product.fulfillment_type ?? "").toLowerCase() === "dropshipping";
      if (!isDropship) {
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
      const allDropship = cartItems.every((c) => {
        const p = productMap.get(c.id) as
          | (typeof products)[number]
          | undefined;
        return (
          p && (p.fulfillment_type ?? "").toLowerCase() === "dropshipping"
        );
      });
      if (allDropship) {
        const { syncDropshipWalletOrderToShopify } = await import(
          "@/lib/shopify/wallet-dropship-order"
        );
        await syncDropshipWalletOrderToShopify(supabase, {
          userId,
          orderId: insertedOrder.id,
          cartItems,
          orderCashPaid,
          deductCredits,
          products: (products ?? []) as ProductRow[],
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
