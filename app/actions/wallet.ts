"use server";

import Decimal from "decimal.js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileRowForUser } from "@/lib/supabase/ensure-user-profile";

const MIN_WITHDRAWAL = 20;
const FEE_RATE = 0.03;
const FEE_MIN = 0.5;
const W9_THRESHOLD = 600;

export type WithdrawalResult =
  | { success: true; requiresW9?: boolean }
  | {
      success: false;
      error: string;
      code?: "REQUIRE_W9" | "W9_PENDING";
    };

/** 获取用户 2026 年度已提现总额（completed + pending） */
export async function getAnnualPayout(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const yearStart = "2026-01-01T00:00:00Z";
  const yearEnd = "2026-12-31T23:59:59Z";
  const { data } = await supabase
    .from("withdrawals")
    .select("amount")
    .eq("user_id", userId)
    .in("status", ["completed", "pending"])
    .gte("created_at", yearStart)
    .lte("created_at", yearEnd);

  const total = (data ?? []).reduce(
    (s, w) => s + Number(w.amount ?? 0),
    0
  );
  return total;
}

/**
 * 提现申请 - 硬核风控逻辑
 * 1. 门槛：最小 $20
 * 2. 手续费：3% 或 $0.50 取高者
 * 3. W-9 合规：年度超 $600 且未验证则拒绝 (REQUIRE_W9)
 * 4. 事务：验资 -> 扣款 -> 插入
 */
export async function requestWithdrawal(
  amount: number,
  method: string,
  accountInfo: string
): Promise<WithdrawalResult> {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.id) {
    return { success: false, error: "Please sign in." };
  }
  const userId = user.id;

  if (!method?.trim() || !accountInfo?.trim()) {
    return { success: false, error: "Invalid request" };
  }

  const amt = Number(amount);
  if (isNaN(amt) || amt < MIN_WITHDRAWAL) {
    return {
      success: false,
      error: "Minimum withdrawal amount is $20.00.",
    };
  }

  const amtD = new Decimal(amt);
  const feeD = Decimal.max(amtD.times(FEE_RATE), FEE_MIN);
  const fee = feeD.toDecimalPlaces(2).toNumber();
  const netAmount = amtD.minus(feeD).toDecimalPlaces(2).toNumber();

  const supabase = createAdminClient();

  const ensured = await ensureProfileRowForUser(supabase, userId);
  if (!ensured.ok) {
    console.error("[requestWithdrawal] ensure profile:", ensured.error);
    return {
      success: false,
      error:
        "Your profile could not be loaded. Try signing out and signing in again, or contact support.",
    };
  }

  // 1. 年度总额 + W-9 拦截
  const yearTotal = await getAnnualPayout(userId);
  const afterTotal = new Decimal(yearTotal).plus(amt).toNumber();
  const requiresW9 = afterTotal >= W9_THRESHOLD;

  // 勿与 is_w9_verified 同条 select：远端若未跑 00008 迁移，整句会失败并误报 “Invalid user”
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cash_balance")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[requestWithdrawal] profile select:", profileError);
    return {
      success: false,
      error: "Could not read your wallet. Please try again or contact support.",
    };
  }
  if (!profile) {
    console.error("[requestWithdrawal] no profile row after ensure, userId:", userId);
    return {
      success: false,
      error:
        "Your account profile is missing. Try signing out and signing in again, or contact support.",
    };
  }

  let isW9Verified = false;
  let w9SubmittedAt: string | null = null;
  const w9Res = await supabase
    .from("profiles")
    .select("is_w9_verified, w9_submitted_at")
    .eq("id", userId)
    .maybeSingle();
  if (!w9Res.error && w9Res.data) {
    const row = w9Res.data as {
      is_w9_verified?: boolean;
      w9_submitted_at?: string | null;
    };
    if (typeof row.is_w9_verified === "boolean") {
      isW9Verified = row.is_w9_verified === true;
    }
    if (typeof row.w9_submitted_at === "string" && row.w9_submitted_at) {
      w9SubmittedAt = row.w9_submitted_at;
    }
  }
  if (afterTotal >= W9_THRESHOLD && !isW9Verified) {
    if (w9SubmittedAt) {
      return {
        success: false,
        error:
          "Your W-9 was received and is awaiting verification. Withdrawals unlock after our team approves it (typically 1–2 business days).",
        code: "W9_PENDING",
      };
    }
    return {
      success: false,
      error:
        "Tax Compliance: W-9 form required. Please upload your W-9 to continue withdrawals.",
      code: "REQUIRE_W9",
    };
  }

  const cashBalance = Number(profile.cash_balance ?? 0);
  if (cashBalance < amt) {
    return { success: false, error: "Insufficient funds" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      cash_balance: cashBalance - amt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("[requestWithdrawal] Deduct error:", updateError);
    return { success: false, error: "Withdrawal failed" };
  }

  // 使用字符串写入 DECIMAL，避免 JS 浮点经 PostgREST 后触发 CHECK 或精度问题
  const amountStr = amtD.toDecimalPlaces(2).toFixed(2);
  const feeStr = feeD.toDecimalPlaces(2).toFixed(2);
  const netStr = amtD.minus(feeD).toDecimalPlaces(2).toFixed(2);

  const { error: insertError } = await supabase.from("withdrawals").insert({
    user_id: userId,
    amount: amountStr,
    fee: feeStr,
    net_amount: netStr,
    method: method.trim().slice(0, 32),
    account_info: accountInfo.trim(),
    status: "pending",
  });

  if (insertError) {
    console.error(
      "[requestWithdrawal] Insert error:",
      insertError.code,
      insertError.message,
      insertError.details,
      insertError.hint
    );
    // 已扣款，需回滚 - 返还余额
    await supabase
      .from("profiles")
      .update({
        cash_balance: cashBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    const detail = insertError.message?.trim() || "database error";
    if (insertError.code === "23514") {
      return {
        success: false,
        error:
          "Withdrawal could not be saved (amount validation). Try again or use a round dollar amount.",
      };
    }
    if (insertError.code === "23503") {
      return {
        success: false,
        error:
          "Withdrawal could not be saved (account link). Try signing out and back in, then retry.",
      };
    }
    return {
      success: false,
      error: `Withdrawal request failed: ${detail}`,
    };
  }

  return { success: true };
}

export interface WithdrawalRow {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  method: string;
  account_info: string;
  status: string;
  created_at: string;
  admin_message?: string | null;
}

/** Admin: 获取所有 pending 提现 */
export async function listPendingWithdrawals(): Promise<WithdrawalRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listPendingWithdrawals]", error);
    return [];
  }
  return (data ?? []) as WithdrawalRow[];
}

export type AdminWithdrawalResult =
  | { success: true }
  | { success: false; error: string };

/** Admin: 标记提现完成（线下已打款） */
export async function completeWithdrawal(
  withdrawalId: string
): Promise<AdminWithdrawalResult> {
  const supabase = createAdminClient();
  let { error } = await supabase
    .from("withdrawals")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", withdrawalId)
    .eq("status", "pending");

  if (error && /updated_at|schema cache/i.test(error.message)) {
    ({ error } = await supabase
      .from("withdrawals")
      .update({ status: "completed" })
      .eq("id", withdrawalId)
      .eq("status", "pending"));
  }

  if (error) {
    console.error("[completeWithdrawal]", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Admin: 拒绝提现，返还用户余额；可选留言给用户（展示在钱包活动） */
export async function rejectWithdrawal(
  withdrawalId: string,
  adminMessage?: string | null
): Promise<AdminWithdrawalResult> {
  const supabase = createAdminClient();
  const note = adminMessage?.trim() || null;

  const { data: w, error: fetchErr } = await supabase
    .from("withdrawals")
    .select("user_id, amount, status")
    .eq("id", withdrawalId)
    .single();

  if (fetchErr || !w || w.status !== "pending") {
    return { success: false, error: "Withdrawal not found or already processed" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("cash_balance")
    .eq("id", w.user_id)
    .single();

  const currentBalance = Number(profile?.cash_balance ?? 0);
  const { error: updateProfileErr } = await supabase
    .from("profiles")
    .update({
      cash_balance: currentBalance + Number(w.amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", w.user_id);

  if (updateProfileErr) {
    console.error("[rejectWithdrawal] Refund error:", updateProfileErr);
    return { success: false, error: "Refund failed" };
  }

  const u = new Date().toISOString();
  const attempts: Record<string, unknown>[] = [];
  if (note) {
    attempts.push({ status: "rejected", admin_message: note, updated_at: u });
    attempts.push({ status: "rejected", admin_message: note });
  } else {
    attempts.push({ status: "rejected", updated_at: u });
  }
  attempts.push({ status: "rejected" });

  let updateStatusErr: { message: string } | null = null;
  for (const payload of attempts) {
    const { error } = await supabase.from("withdrawals").update(payload).eq("id", withdrawalId);
    if (!error) {
      updateStatusErr = null;
      break;
    }
    updateStatusErr = error;
  }

  if (updateStatusErr) {
    console.error("[rejectWithdrawal] status update:", updateStatusErr);
    return {
      success: false,
      error: updateStatusErr.message || "Status update failed",
    };
  }
  return { success: true };
}
