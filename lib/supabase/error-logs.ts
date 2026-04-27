import type { SupabaseClient } from "@supabase/supabase-js";

export type ErrorLogInput = {
  source: string;
  message: string;
  context?: Record<string, unknown> | null;
  userId?: string | null;
  orderId?: string | null;
  stripeCheckoutSessionId?: string | null;
};

/**
 * 将集成错误写入 `error_logs`（需已执行 migration 00043；使用 service_role 客户端）。
 * 写库失败时仅打 console，避免与主错误链互相影响。
 */
export async function insertErrorLog(
  supabase: SupabaseClient,
  input: ErrorLogInput
): Promise<void> {
  const { error } = await supabase.from("error_logs").insert({
    source: input.source,
    message: input.message,
    context: input.context ?? null,
    user_id: input.userId ?? null,
    order_id: input.orderId ?? null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
  });
  if (error) {
    console.error("[error_logs] insert failed", error, input);
  }
}

function serializeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

export async function logShopifyOrderCreateFailure(
  supabase: SupabaseClient,
  err: unknown,
  meta: {
    userId: string;
    orderId: string;
    checkoutSessionId: string;
  }
): Promise<void> {
  const s = serializeError(err);
  await insertErrorLog(supabase, {
    source: "shopify_order_create",
    message: s.message,
    context: { stack: s.stack, name: err instanceof Error ? err.name : "unknown" },
    userId: meta.userId,
    orderId: meta.orderId,
    stripeCheckoutSessionId: meta.checkoutSessionId,
  });
}
