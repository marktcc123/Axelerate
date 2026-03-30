"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JoinWaitlistResult =
  | { success: true }
  | { success: false; error: string };

/**
 * 加入商品等候名单 - 售罄时用户可订阅到货提醒
 */
export async function joinWaitlist(
  productId: string
): Promise<JoinWaitlistResult> {
  if (!productId?.trim()) {
    return { success: false, error: "Product ID required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please log in first." };
  }

  const { error } = await supabase.from("product_waitlist").insert({
    user_id: user.id,
    product_id: productId,
  });

  // 23505 = unique_violation，重复加入时温柔处理
  if (error && error.code !== "23505") {
    console.error("[joinWaitlist] error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/product/${productId}`);
  return { success: true };
}
