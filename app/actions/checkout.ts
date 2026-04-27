"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillPerksShopOrder, type CartLine } from "@/lib/perks-order-fulfill";
import { verifyCartAndComputeUsdDue } from "@/lib/perks-checkout-pricing";

export type CheckoutResult =
  | { success: true }
  | { success: false; error: string };

/**
 * 服务端安全结账 - 绝不信任前端价格
 * 1. 验价：从 products 表重新查询真实价格与库存
 * 2. 防超卖：stock_count < quantity 则抛出
 * 3. 验资：profiles.cash_balance + credit_balance 抵扣
 * 4. 事务：扣款 + 扣积分 + 扣库存 + 插入 orders
 * 汇率：100 Credits = $1 USD
 */
export async function processCheckout(
  userId: string,
  cartItems: CartLine[],
  creditsToUse: number = 0
): Promise<CheckoutResult> {
  const supabase = createAdminClient();
  const pricing = await verifyCartAndComputeUsdDue(
    supabase,
    userId,
    cartItems,
    creditsToUse
  );
  if (!pricing.ok) {
    return { success: false, error: pricing.error };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cash_balance")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: "Invalid user" };
  }

  const cashBalance = Number(profile.cash_balance ?? 0);
  if (cashBalance < pricing.amountToPayUsd) {
    return { success: false, error: "Insufficient funds" };
  }

  return fulfillPerksShopOrder(supabase, {
    userId,
    cartItems,
    deductCashFromBalance: pricing.amountToPayUsd,
    deductCredits: pricing.actualCreditsUsed,
    orderCashPaid: pricing.amountToPayUsd,
    stripeCheckoutSessionId: null,
  });
}
