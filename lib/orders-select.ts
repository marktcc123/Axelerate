/**
 * orders 表查询列（显式列出，避免请求不存在的列导致整条查询失败）
 *
 * ORDERS_COLUMNS_MIN：仅各环境都有的核心列（旧库安全）
 * ORDERS_COLUMNS_EXTENDED：含物流与售后列；若迁移未加齐，客户端会回退到 MIN
 */
export const ORDERS_COLUMNS_MIN =
  "id, user_id, status, items, created_at, cash_paid, credits_used";

export const ORDERS_COLUMNS_EXTENDED = `${ORDERS_COLUMNS_MIN}, tracking_number, cancel_reason, return_status, return_reason, cancel_request_status, cancel_request_reason, admin_rejection_message`;

/** Admin 联表买家（含账户里保存的收货地址 shipping_address） */
export const ORDERS_SELECT_WITH_PROFILE = `${ORDERS_COLUMNS_EXTENDED}, profile:profiles(id, full_name, avatar_url, shipping_address)`;

/** Postgrest：列不存在（PostgreSQL 42703） */
export function isMissingColumnPostgrestError(err: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!err) return false;
  if (err.code === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("column") && m.includes("does not exist");
}
