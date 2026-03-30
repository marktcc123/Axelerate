import type { SupabaseClient } from "@supabase/supabase-js";

export type InsertWalletEventInput = {
  user_id: string;
  category: string;
  title: string;
  detail?: string | null;
  cash_delta?: number | null;
  credits_delta?: number | null;
  xp_delta?: number | null;
  ref_type?: string | null;
  ref_id?: string | null;
  admin_note?: string | null;
};

/** 仅服务端用 service_role 调用 */
export async function insertUserWalletEvent(
  supabase: SupabaseClient,
  input: InsertWalletEventInput
): Promise<void> {
  const { error } = await supabase.from("user_wallet_events").insert({
    user_id: input.user_id,
    category: input.category,
    title: input.title,
    detail: input.detail ?? null,
    cash_delta: input.cash_delta ?? null,
    credits_delta: input.credits_delta ?? null,
    xp_delta: input.xp_delta ?? null,
    ref_type: input.ref_type ?? null,
    ref_id: input.ref_id ?? null,
    admin_note: input.admin_note ?? null,
  });
  if (error) {
    console.error("[insertUserWalletEvent]", error);
  }
}
