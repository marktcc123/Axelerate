"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { insertUserWalletEvent } from "@/lib/wallet-events";
import type { School } from "@/lib/schools";
import { DEFAULT_SCHOOL_NAME } from "@/lib/schools";
import { ORDERS_COLUMNS_MIN, ORDERS_SELECT_WITH_PROFILE } from "@/lib/orders-select";
import type { OrderItemRaw } from "@/lib/types";

/** 获取当前登录用户 ID（审批人） */
async function getActorId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** 写入审计日志 */
async function insertAuditLog(
  entityType: string,
  entityId: string,
  action: string,
  actorId: string | null
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: actorId,
    });
  } catch (e) {
    console.error("[admin] insertAuditLog error:", e);
  }
}

// =============================================================================
// Admin Dashboard - Aggregated Data Fetch
// =============================================================================

export interface AuditEntry {
  id: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  actor?: { full_name?: string } | null;
}

export type PendingW9ReviewRow = {
  id: string;
  full_name: string | null;
  w9_submitted_at: string;
  w9_document_path: string | null;
};

export interface AdminDashboardData {
  /** 待发货（processing 且未处于取消申请审核中） */
  pendingOrders: any[];
  /** 用户申请取消、待审批（cancel_request_status = pending） */
  pendingCancelRequests: any[];
  /** 用户申请退货、待运营审批（return_status = requested） */
  pendingReturns: any[];
  orderProducts: any[];
  pendingEventApplications: any[];
  pendingWithdrawals: any[];
  /** 已上传 W-9 但未核验 is_w9_verified */
  pendingW9Reviews: PendingW9ReviewRow[];
  pendingUGC: any[];
  reviewedUGC: any[];
  ugcData: any[];
  pendingPhysical: any[];
  reviewedPhysical: any[];
  pendingEvents: any[];
  reviewedEvents: any[];
  auditLogByEntity: Record<string, AuditEntry[]>;
}

/** Fetch all pending dashboard data in parallel (bypasses RLS via Service Role) */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = createAdminClient();

  const [
    ordersRes,
    returnsRes,
    cancelsRes,
    eventsRes,
    withdrawalsRes,
    ugcRes,
    eventsAllRes,
    w9PendingRes,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDERS_SELECT_WITH_PROFILE)
      .eq("status", "processing")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select(ORDERS_SELECT_WITH_PROFILE)
      .eq("return_status", "requested")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select(ORDERS_SELECT_WITH_PROFILE)
      .eq("cancel_request_status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("event_applications")
      .select("*, event:events(*)")
      .in("status", ["pending", "applied"])
      .order("created_at", { ascending: false }),
    supabase
      .from("withdrawals")
      .select(
        "id, user_id, amount, fee, net_amount, method, account_info, status, created_at, profile:profiles!withdrawals_user_id_fkey(full_name, avatar_url, campus)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_gigs")
      .select("*, gig:gigs(*), user:profiles(*)")
      .order("applied_at", { ascending: false }),
    supabase
      .from("event_applications")
      .select("*, event:events(*), profile:profiles(*)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, w9_submitted_at, w9_document_path")
      .not("w9_submitted_at", "is", null)
      .eq("is_w9_verified", false)
      .order("w9_submitted_at", { ascending: false }),
  ]);

  // 联表 profile 或多余列失败时，降级为最小列集，避免 Dashboard 待发货列表整段为空
  let ordersForDashboard: any = ordersRes;
  if (returnsRes.error) {
    console.warn(
      "[admin] pending returns select failed (add return_status column or RLS):",
      returnsRes.error.message
    );
  }
  if (cancelsRes.error) {
    console.warn(
      "[admin] pending cancel requests select failed (add cancel_request_status column):",
      cancelsRes.error.message
    );
  }
  let withdrawalsForDashboard: typeof withdrawalsRes = withdrawalsRes;
  if (withdrawalsRes.error) {
    console.warn(
      "[admin] pending withdrawals select (with profile) failed, retry *:",
      withdrawalsRes.error.message
    );
    const withdrawalsFb = await supabase
      .from("withdrawals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!withdrawalsFb.error) {
      withdrawalsForDashboard = withdrawalsFb;
    }
  }
  if (w9PendingRes.error) {
    console.warn(
      "[admin] pending W-9 reviews select failed (run migration 00028_w9_storage_and_profiles.sql):",
      w9PendingRes.error.message
    );
  }

  if (ordersRes.error) {
    console.error(
      "[admin] pending orders select (with profile) failed:",
      ordersRes.error.message,
      ordersRes.error
    );
    const fallback = await supabase
      .from("orders")
      .select(ORDERS_COLUMNS_MIN)
      .eq("status", "processing")
      .order("created_at", { ascending: false });
    if (fallback.error) {
      console.error(
        "[admin] pending orders select (minimal) failed:",
        fallback.error.message,
        fallback.error
      );
    } else {
      ordersForDashboard = fallback;
    }
  }

  // --- DEBUG: UGC 防弹级排查 ---
  console.log("--- DEBUG: START FETCHING UGC ---");
  if (ugcRes.error) {
    console.error(
      "❌ SUPABASE UGC FETCH ERROR:",
      JSON.stringify(ugcRes.error, null, 2)
    );
  } else {
    console.log("✅ RAW UGC DATA COUNT:", ugcRes.data?.length ?? 0);
    if (ugcRes.data && ugcRes.data.length > 0) {
      console.log("🔍 FIRST GIG STRUCTURE:", ugcRes.data[0].gig);
      console.log("🔍 FIRST ITEM KEYS:", Object.keys(ugcRes.data[0]));
    }
  }

  // 极其宽容的 JS 过滤：兼容 type / category 两种列名，gig 可能是对象或数组
  const rawUgc = ugcRes.error ? [] : (ugcRes.data ?? []);
  const actualUgcPosts = rawUgc.filter((item: any) => {
    const gig = Array.isArray(item.gig) ? item.gig[0] : item.gig;
    if (!gig) return false;
    return gig.type === "ugc_post" || (gig as any).category === "ugc_post";
  });

  const pendingStatuses = ["pending", "submitted"];
  const pendingUGC = actualUgcPosts.filter((item: any) =>
    pendingStatuses.includes(item.status)
  );
  const reviewedUGC = actualUgcPosts.filter(
    (item: any) => !pendingStatuses.includes(item.status)
  );

  console.log("📊 FILTERED PENDING UGC COUNT:", pendingUGC.length);
  console.log("📊 ACTUAL UGC POSTS (type=ugc_post) COUNT:", actualUgcPosts.length);
  if (rawUgc.length > 0 && actualUgcPosts.length === 0) {
    console.warn(
      "⚠️ RAW has data but UGC filter excluded all — check gig.type / gig.category in FIRST GIG STRUCTURE above"
    );
  }

  const ugcData = actualUgcPosts;
  const awaitingReview = [...pendingUGC].sort((a: any, b: any) => {
    const order: Record<string, number> = { submitted: 0, pending: 1 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  // Fetch products for order items (items JSON: [{ id, quantity }])
  const rawOrdersAll = ordersForDashboard.data ?? [];
  const rawReturns = returnsRes.error ? [] : (returnsRes.data ?? []);
  const rawCancels = cancelsRes.error ? [] : (cancelsRes.data ?? []);
  /** 取消申请中的订单不显示在「待发货」列表，避免与取消审批区重复 */
  const rawOrders = rawOrdersAll.filter(
    (o: { cancel_request_status?: string | null }) =>
      String(o.cancel_request_status ?? "").toLowerCase() !== "pending"
  );
  const productIdSet = new Set<string>();
  for (const o of [...rawOrdersAll, ...rawReturns, ...rawCancels]) {
    const items = (o.items ?? []) as { id?: string; quantity?: number }[];
    for (const it of items) {
      if (it?.id) productIdSet.add(it.id);
    }
  }
  let orderProducts: any[] = [];
  if (productIdSet.size > 0) {
    const { data: productsData } = await supabase
      .from("products")
      .select("id, title, discount_price, original_price, category")
      .in("id", [...productIdSet]);
    orderProducts = productsData ?? [];
  }

  // Physical Gigs: user_gigs where gig.type === 'offline_event'
  const rawPhysical = ugcRes.error ? [] : (ugcRes.data ?? []);
  const actualPhysical = rawPhysical.filter((item: any) => {
    const gig = Array.isArray(item.gig) ? item.gig[0] : item.gig;
    return gig && (gig.type === "offline_event" || (gig as any).category === "offline_event");
  });
  const physicalPendingStatuses = ["pending", "submitted"];
  const pendingPhysical = actualPhysical.filter((item: any) =>
    physicalPendingStatuses.includes(item.status)
  );
  const reviewedPhysical = actualPhysical.filter(
    (item: any) => !physicalPendingStatuses.includes(item.status)
  );

  // Events: all event_applications, null status -> pending
  const rawEvents = eventsAllRes.error ? [] : (eventsAllRes.data ?? []);
  const eventPendingStatuses = ["pending", "applied", null, undefined];
  const pendingEvents = rawEvents.filter((item: any) => {
    const s = item.status;
    return s == null || eventPendingStatuses.includes(s);
  });
  const reviewedEvents = rawEvents.filter((item: any) => {
    const s = item.status;
    return s != null && !eventPendingStatuses.includes(s);
  });

  // 审计日志：收集所有实体 ID 并批量拉取
  const userGigIds = (ugcRes.data ?? []).map((r: any) => r.id);
  const eventAppIds = (eventsAllRes.data ?? []).map((r: any) => r.id);
  const orderIds = [...rawOrdersAll, ...rawReturns, ...rawCancels].map((o: any) => o.id);
  const auditLogByEntity: Record<string, AuditEntry[]> = {};
  try {
    if (userGigIds.length > 0 || eventAppIds.length > 0 || orderIds.length > 0) {
      const [ugcAudit, evAudit, ordAudit] = await Promise.all([
      userGigIds.length > 0
        ? supabase
            .from("audit_log")
            .select("id, entity_type, entity_id, action, actor_id, created_at")
            .eq("entity_type", "user_gig")
            .in("entity_id", userGigIds)
            .order("created_at", { ascending: true })
        : { data: [] },
      eventAppIds.length > 0
        ? supabase
            .from("audit_log")
            .select("id, entity_type, entity_id, action, actor_id, created_at")
            .eq("entity_type", "event_application")
            .in("entity_id", eventAppIds)
            .order("created_at", { ascending: true })
        : { data: [] },
      orderIds.length > 0
        ? supabase
            .from("audit_log")
            .select("id, entity_type, entity_id, action, actor_id, created_at")
            .eq("entity_type", "order")
            .in("entity_id", orderIds)
            .order("created_at", { ascending: true })
        : { data: [] },
    ]);
    const allAudit = [
      ...(ugcAudit.data ?? []),
      ...(evAudit.data ?? []),
      ...(ordAudit.data ?? []),
    ];
    const actorIds = [...new Set((allAudit as any[]).map((r) => r.actor_id).filter(Boolean))];
    const actorProfiles: Record<string, { full_name?: string }> = {};
    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      for (const a of actors ?? []) {
        actorProfiles[(a as any).id] = { full_name: (a as any).full_name };
      }
    }
    for (const row of allAudit) {
      const key = `${(row as any).entity_type}:${(row as any).entity_id}`;
      if (!auditLogByEntity[key]) auditLogByEntity[key] = [];
      auditLogByEntity[key].push({
        id: (row as any).id,
        entity_id: (row as any).entity_id,
        action: (row as any).action,
        actor_id: (row as any).actor_id,
        created_at: (row as any).created_at,
        actor: (row as any).actor_id ? actorProfiles[(row as any).actor_id] ?? null : null,
      });
    }
    }
  } catch (e) {
    console.error("[admin] audit_log fetch error:", e);
  }

  return {
    pendingOrders: rawOrders,
    pendingCancelRequests: rawCancels,
    pendingReturns: rawReturns,
    orderProducts,
    pendingEventApplications: eventsRes.data ?? [],
    pendingWithdrawals: withdrawalsForDashboard.error
      ? []
      : (withdrawalsForDashboard.data ?? []),
    pendingW9Reviews: w9PendingRes.error
      ? []
      : ((w9PendingRes.data ?? []) as PendingW9ReviewRow[]),
    pendingUGC: awaitingReview,
    reviewedUGC,
    ugcData,
    pendingPhysical,
    reviewedPhysical,
    pendingEvents,
    reviewedEvents,
    auditLogByEntity,
  };
}

// =============================================================================
// Analytics - Real Data Aggregation
// =============================================================================

/** Revenue 趋势图时间范围（按订单 created_at 按日汇总） */
export type AnalyticsRevenueTrendDays = 7 | 30 | 90;

export interface AnalyticsData {
  totalGmv: number;
  totalCreditsUsed: number;
  totalUsers: number;
  estimatedDau: number;
  pendingPayouts: number;
  estimatedCac: number | null; // null when no marketing spend data
  campusData: { name: string; value: number }[];
  /** 与 revenueTrendDays 一致的天数；cash / credits 均按日聚合，逻辑相同 */
  revenueTrend: { name: string; dateKey: string; cash: number; credits: number }[];
  revenueTrendDays: AnalyticsRevenueTrendDays;
}

function normalizeRevenueTrendDays(n: unknown): AnalyticsRevenueTrendDays {
  if (n === 30 || n === 90) return n;
  return 7;
}

export async function getAnalyticsData(
  revenueTrendDaysInput: AnalyticsRevenueTrendDays | number = 7
): Promise<AnalyticsData> {
  const revenueTrendDays = normalizeRevenueTrendDays(revenueTrendDaysInput);
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("[getAnalyticsData] createAdminClient failed:", e);
    const today = new Date();
    return {
      totalGmv: 0,
      totalCreditsUsed: 0,
      totalUsers: 0,
      estimatedDau: 0,
      pendingPayouts: 0,
      estimatedCac: null,
      campusData: [],
      revenueTrend: Array.from({ length: revenueTrendDays }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (revenueTrendDays - 1) + i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return {
          name: `${d.getMonth() + 1}/${d.getDate()}`,
          dateKey,
          cash: 0,
          credits: 0,
        };
      }),
      revenueTrendDays,
    };
  }

  // Fetch from orders table - explicit fields, exclude cancelled only (GMV includes all valid orders)
  const [ordersRes, profilesRes, withdrawalsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, cash_paid, credits_used, created_at, status")
      .neq("status", "cancelled"),
    supabase.from("profiles").select("id, campus"),
    supabase.from("withdrawals").select("amount").eq("status", "pending"),
  ]);

  if (ordersRes.error) {
    console.error("[getAnalyticsData] orders fetch error:", ordersRes.error);
  } else {
    console.log("[getAnalyticsData] orders from DB:", (ordersRes.data ?? []).length);
  }
  if (profilesRes.error) {
    console.error("[getAnalyticsData] profiles fetch error:", profilesRes.error);
  }

  const rawOrders = ordersRes.error ? [] : (ordersRes.data ?? []);
  const orders = rawOrders.filter(
    (o) => !["failed", "cancelled"].includes(String(o?.status ?? "").toLowerCase())
  );

  // Type-safe reduce: Number() guards against null/undefined/NaN
  const totalGmv = orders?.reduce((sum, order) => sum + (Number(order.cash_paid) || 0), 0) ?? 0;
  const totalCreditsUsed = orders?.reduce((sum, order) => sum + (Number(order.credits_used) || 0), 0) ?? 0;

  // Total users from profiles count
  const totalUsers = profilesRes.error ? 0 : (profilesRes.data ?? []).length;

  // DAU: estimate (15% of total users) - no activity tracking yet
  const estimatedDau = Math.floor(totalUsers * 0.15);

  // Pending payouts: sum withdrawal amounts with status=pending
  const pendingPayouts = (withdrawalsRes.error ? [] : (withdrawalsRes.data ?? [])).reduce(
    (sum, w) => sum + (Number((w as { amount?: number }).amount) || 0),
    0
  );

  // Campus distribution
  const profiles = profilesRes.error ? [] : (profilesRes.data ?? []);
  const campusCount = profiles.reduce(
    (acc: Record<string, number>, p) => {
      const school = (p as { campus?: string }).campus ?? "Unknown";
      acc[school] = (acc[school] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const campusData = Object.entries(campusCount).map(([name, value]) => ({
    name,
    value,
  }));

  // Revenue trend: group by created_at date, last 7 calendar days (parse ISO string correctly)
  const cashByDate: Record<string, number> = {};
  const creditsByDate: Record<string, number> = {};
  for (const o of orders) {
    const createdAt = o.created_at;
    if (!createdAt) continue;
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cash = Number(o.cash_paid) || 0;
    const credits = Number(o.credits_used) || 0;
    cashByDate[dateKey] = (cashByDate[dateKey] ?? 0) + cash;
    creditsByDate[dateKey] = (creditsByDate[dateKey] ?? 0) + credits;
  }
  const today = new Date();
  const revenueTrend = Array.from({ length: revenueTrendDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (revenueTrendDays - 1) + i);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      name: `${d.getMonth() + 1}/${d.getDate()}`,
      dateKey,
      cash: cashByDate[dateKey] ?? 0,
      credits: creditsByDate[dateKey] ?? 0,
    };
  });

  // CAC: requires marketing spend - not available, return null
  const estimatedCac: number | null = null;

  return {
    totalGmv,
    totalCreditsUsed,
    totalUsers,
    estimatedDau,
    pendingPayouts,
    estimatedCac,
    campusData,
    revenueTrend,
    revenueTrendDays,
  };
}

// =============================================================================
// Orders & Event Approvals (Admin Core Actions)
// =============================================================================

export type AdminActionResult = { success: true } | { success: false; error: string };

/** Fetch pending orders (status === 'processing') */
export async function getAdminPendingOrders() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_COLUMNS_MIN)
    .eq("status", "processing")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[admin] getPendingOrders error:", error);
    return [];
  }
  return data ?? [];
}

/** 拉取待审活动申请 (status === 'pending' 或 'applied') */
export async function getAdminPendingEventApplications() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_applications")
    .select("*, event:events(*)")
    .in("status", ["pending", "applied"])
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[admin] getPendingEventApplications error:", error);
    return [];
  }
  return data ?? [];
}

/** Mark order as shipped（仅更新 status，不读写 shipped_at） */
export async function markOrderShipped(orderId: string): Promise<AdminActionResult> {
  if (!orderId) return { success: false, error: "Order ID required" };
  const supabase = createAdminClient();
  const { data: pre, error: preErr } = await supabase
    .from("orders")
    .select("cancel_request_status")
    .eq("id", orderId)
    .maybeSingle();

  if (preErr) {
    console.error("[admin] markOrderShipped precheck:", preErr);
  } else if (
    pre &&
    String((pre as { cancel_request_status?: string | null }).cancel_request_status ?? "")
      .toLowerCase() === "pending"
  ) {
    return {
      success: false,
      error: "This order has a pending cancellation request. Approve or decline it before shipping.",
    };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "shipped" })
    .eq("id", orderId);
  if (error) {
    console.error("[admin] markOrderShipped error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("order", orderId, "shipped", actorId);
  revalidatePath("/");
  return { success: true };
}

/**
 * 批准取消申请：退款 + 恢复库存 + status=cancelled + cancel_request_status=approved
 */
export async function approveCancelRequest(orderId: string): Promise<AdminActionResult> {
  if (!orderId?.trim()) return { success: false, error: "Order ID required" };

  const admin = createAdminClient();
  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select(
      "id, user_id, status, items, cash_paid, credits_used, cancel_request_status, cancel_request_reason"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !order) return { success: false, error: "Order not found" };

  const cr = String((order as { cancel_request_status?: string | null }).cancel_request_status ?? "")
    .trim()
    .toLowerCase();
  if (cr !== "pending") {
    return { success: false, error: "No pending cancellation request for this order." };
  }

  const status = String((order as { status: string }).status ?? "")
    .trim()
    .toLowerCase();
  if (status !== "processing") {
    return { success: false, error: "Order is no longer in processing; cannot approve cancel." };
  }

  const userId = (order as { user_id: string }).user_id;
  const items = ((order as { items?: unknown }).items ?? []) as OrderItemRaw[];
  const cashPaid = Number((order as { cash_paid?: number }).cash_paid ?? 0);
  const creditsUsed = Number((order as { credits_used?: number }).credits_used ?? 0);
  const userReason = String((order as { cancel_request_reason?: string | null }).cancel_request_reason ?? "").trim();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("cash_balance, credit_balance")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return { success: false, error: "Could not load buyer profile for refund" };
  }

  const cashBalance = Number((profile as { cash_balance?: number }).cash_balance ?? 0);
  const creditBalance = Number((profile as { credit_balance?: number }).credit_balance ?? 0);

  if (cashPaid > 0 || creditsUsed > 0) {
    const { error: refundErr } = await admin
      .from("profiles")
      .update({
        cash_balance: cashBalance + cashPaid,
        credit_balance: creditBalance + creditsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (refundErr) {
      console.error("[approveCancelRequest] refund:", refundErr);
      return { success: false, error: refundErr.message };
    }
  }

  for (const line of items) {
    if (!line?.id || !line.quantity) continue;
    const { data: product, error: pErr } = await admin
      .from("products")
      .select("stock_count")
      .eq("id", line.id)
      .maybeSingle();

    if (pErr || !product) continue;

    const current = Number((product as { stock_count?: number }).stock_count ?? 0);
    const { error: stockErr } = await admin
      .from("products")
      .update({
        stock_count: current + line.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", line.id);

    if (stockErr) {
      console.error("[approveCancelRequest] stock:", stockErr);
      return { success: false, error: stockErr.message };
    }
  }

  const { error: updErr } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: userReason || null,
      cancel_request_status: "approved",
    })
    .eq("id", orderId)
    .eq("cancel_request_status", "pending");

  if (updErr) {
    console.error("[approveCancelRequest] update order:", updErr);
    return { success: false, error: updErr.message };
  }

  const actorId = await getActorId();
  await insertAuditLog("order", orderId, "cancel_approved", actorId);
  revalidatePath("/");
  revalidatePath("/my-orders");
  return { success: true };
}

/** 拒绝取消申请：不写 cancelled，不退款；向用户展示 admin_rejection_message */
export async function rejectCancelRequest(
  orderId: string,
  adminMessage: string
): Promise<AdminActionResult> {
  const msg = adminMessage?.trim() ?? "";
  if (!orderId?.trim()) return { success: false, error: "Order ID required" };
  if (msg.length < 3) {
    return { success: false, error: "Please provide a message for the customer (min 3 characters)." };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("orders")
    .select("cancel_request_status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !row) return { success: false, error: "Order not found" };
  if (
    String((row as { cancel_request_status?: string | null }).cancel_request_status ?? "")
      .toLowerCase() !== "pending"
  ) {
    return { success: false, error: "No pending cancellation request for this order." };
  }

  const { error } = await admin
    .from("orders")
    .update({
      cancel_request_status: "rejected",
      admin_rejection_message: msg,
    })
    .eq("id", orderId);

  if (error) {
    console.error("[rejectCancelRequest]", error);
    return { success: false, error: error.message };
  }

  const actorId = await getActorId();
  await insertAuditLog("order", orderId, "cancel_rejected", actorId);
  revalidatePath("/");
  revalidatePath("/my-orders");
  return { success: true };
}

/**
 * 批准退货：退回该订单的 cash_paid、credits_used 到买家 profile，并恢复库存；return_status → approved。
 * 仅在 return_status === 'requested' 时执行，可重复调用安全（已非 requested 则失败）。
 */
export async function approveOrderReturn(orderId: string): Promise<AdminActionResult> {
  if (!orderId?.trim()) return { success: false, error: "Order ID required" };

  const admin = createAdminClient();
  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("id, user_id, status, items, cash_paid, credits_used, return_status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !order) {
    return { success: false, error: "Order not found" };
  }

  const ret = String((order as { return_status?: string | null }).return_status ?? "")
    .trim()
    .toLowerCase();
  if (ret !== "requested") {
    return { success: false, error: "No pending return request for this order." };
  }

  const userId = (order as { user_id: string }).user_id;
  const items = ((order as { items?: unknown }).items ?? []) as OrderItemRaw[];
  const cashPaid = Number((order as { cash_paid?: number }).cash_paid ?? 0);
  const creditsUsed = Number((order as { credits_used?: number }).credits_used ?? 0);

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("cash_balance, credit_balance")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return { success: false, error: "Could not load buyer profile for refund" };
  }

  const cashBalance = Number((profile as { cash_balance?: number }).cash_balance ?? 0);
  const creditBalance = Number((profile as { credit_balance?: number }).credit_balance ?? 0);

  if (cashPaid > 0 || creditsUsed > 0) {
    const { error: refundErr } = await admin
      .from("profiles")
      .update({
        cash_balance: cashBalance + cashPaid,
        credit_balance: creditBalance + creditsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (refundErr) {
      console.error("[approveOrderReturn] refund profile:", refundErr);
      return { success: false, error: refundErr.message };
    }
  }

  for (const line of items) {
    if (!line?.id || !line.quantity) continue;
    const { data: product, error: pErr } = await admin
      .from("products")
      .select("stock_count")
      .eq("id", line.id)
      .maybeSingle();

    if (pErr || !product) continue;

    const current = Number((product as { stock_count?: number }).stock_count ?? 0);
    const { error: stockErr } = await admin
      .from("products")
      .update({
        stock_count: current + line.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", line.id);

    if (stockErr) {
      console.error("[approveOrderReturn] restore stock:", stockErr);
      return { success: false, error: stockErr.message };
    }
  }

  const { error: updErr } = await admin
    .from("orders")
    .update({
      return_status: "approved",
    })
    .eq("id", orderId)
    .eq("return_status", "requested");

  if (updErr) {
    console.error("[approveOrderReturn] update order:", updErr);
    return { success: false, error: updErr.message };
  }

  const actorId = await getActorId();
  await insertAuditLog("order", orderId, "return_approved", actorId);
  revalidatePath("/");
  revalidatePath("/my-orders");
  return { success: true };
}

/** 拒绝退货：不退款；admin_rejection_message 展示在用户 My Orders */
export async function rejectOrderReturn(
  orderId: string,
  adminMessage: string
): Promise<AdminActionResult> {
  const msg = adminMessage?.trim() ?? "";
  if (!orderId?.trim()) return { success: false, error: "Order ID required" };
  if (msg.length < 3) {
    return { success: false, error: "Please provide a message for the customer (min 3 characters)." };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("orders")
    .select("return_status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !row) return { success: false, error: "Order not found" };
  if (String((row as { return_status?: string | null }).return_status ?? "").toLowerCase() !== "requested") {
    return { success: false, error: "No pending return request for this order." };
  }

  const { error } = await admin
    .from("orders")
    .update({
      return_status: "rejected",
      admin_rejection_message: msg,
    })
    .eq("id", orderId);

  if (error) {
    console.error("[admin] rejectOrderReturn error:", error);
    return { success: false, error: error.message };
  }

  const actorId = await getActorId();
  await insertAuditLog("order", orderId, "return_rejected", actorId);
  revalidatePath("/");
  revalidatePath("/my-orders");
  return { success: true };
}

/** 批准活动申请 */
export async function approveEventApplication(appId: string): Promise<AdminActionResult> {
  if (!appId) return { success: false, error: "Application ID required" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("event_applications")
    .update({ status: "approved" })
    .eq("id", appId);
  if (error) {
    console.error("[admin] approveEventApplication error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("event_application", appId, "approved", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Approve UGC task (user_gigs) */
export async function approveUgcTask(userGigId: string): Promise<AdminActionResult> {
  if (!userGigId) return { success: false, error: "User Gig ID required" };
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({ status: "approved", approved_at: now, updated_at: now })
    .eq("id", userGigId);
  if (error) {
    console.error("[admin] approveUgcTask error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "approved", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Reject UGC task (user_gigs) - for pending or submitted */
export async function rejectUgcTask(userGigId: string): Promise<AdminActionResult> {
  if (!userGigId) return { success: false, error: "User Gig ID required" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({ status: "rejected" })
    .eq("id", userGigId);
  if (error) {
    console.error("[admin] rejectUgcTask error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "rejected", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Complete UGC task (user_gigs) - for submitted (CEO verified video) */
export async function completeUgcTask(userGigId: string): Promise<AdminActionResult> {
  if (!userGigId) return { success: false, error: "User Gig ID required" };
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", userGigId);
  if (error) {
    console.error("[admin] completeUgcTask error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "completed", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Approve Physical Gig (offline_event user_gigs) */
export async function approvePhysicalGig(userGigId: string): Promise<AdminActionResult> {
  if (!userGigId) return { success: false, error: "User Gig ID required" };
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({ status: "approved", approved_at: now, updated_at: now })
    .eq("id", userGigId);
  if (error) {
    console.error("[admin] approvePhysicalGig error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "approved", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Reject Physical Gig (offline_event user_gigs) */
export async function rejectPhysicalGig(userGigId: string): Promise<AdminActionResult> {
  if (!userGigId) return { success: false, error: "User Gig ID required" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({ status: "rejected" })
    .eq("id", userGigId);
  if (error) {
    console.error("[admin] rejectPhysicalGig error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "rejected", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Complete Physical Gig (mark as completed) */
export async function completePhysicalGig(userGigId: string): Promise<AdminActionResult> {
  if (!userGigId) return { success: false, error: "User Gig ID required" };
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_gigs")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", userGigId);
  if (error) {
    console.error("[admin] completePhysicalGig error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "completed", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Mark user_gig as paid - 财务打款闭环：更新状态 + 累加用户钱包 */
export async function markGigAsPaid(
  userGigId: string,
  userId: string,
  rewardCash: number,
  rewardCredits: number,
  rewardXp: number
): Promise<AdminActionResult> {
  if (!userGigId || !userId) {
    return { success: false, error: "User Gig ID and User ID required" };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // 1. 更新任务状态和 paid_at（安全锁：只有 completed 才能 paid）
  const { data: updatedRows, error: gigError } = await supabase
    .from("user_gigs")
    .update({ status: "paid", paid_at: now, updated_at: now })
    .eq("id", userGigId)
    .eq("status", "completed")
    .select("id");

  if (gigError) {
    console.error("[admin] markGigAsPaid gig update error:", gigError);
    return { success: false, error: "Failed to update gig status: " + gigError.message };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: "Gig not found or already paid." };
  }

  // 2. 读取用户当前钱包余额
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("cash_balance, credit_balance, xp")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[admin] markGigAsPaid profile fetch error:", profileError);
    return { success: false, error: "User profile not found." };
  }

  // 3. 将奖励安全累加到用户钱包
  const cashAdd = Number(rewardCash) || 0;
  const creditsAdd = Number(rewardCredits) || 0;
  const xpAdd = Number(rewardXp) || 0;

  const { error: walletError } = await supabase
    .from("profiles")
    .update({
      cash_balance: (Number(profile.cash_balance) || 0) + cashAdd,
      credit_balance: (Number(profile.credit_balance) || 0) + creditsAdd,
      xp: (Number(profile.xp) || 0) + xpAdd,
      updated_at: now,
    })
    .eq("id", userId);

  if (walletError) {
    console.error("[admin] markGigAsPaid wallet update error:", walletError);
    return { success: false, error: "Failed to update user wallet: " + walletError.message };
  }

  const { data: ug } = await supabase
    .from("user_gigs")
    .select("gig:gigs(title)")
    .eq("id", userGigId)
    .maybeSingle();
  const gigRel = ug?.gig as { title?: string } | { title?: string }[] | null | undefined;
  const g0 = Array.isArray(gigRel) ? gigRel[0] : gigRel;
  const gigTitle = g0?.title?.trim() || "Gig";

  await insertUserWalletEvent(supabase, {
    user_id: userId,
    category: "gig_payout",
    title: "Gig payout",
    detail: gigTitle,
    cash_delta: cashAdd > 0 ? cashAdd : null,
    credits_delta: creditsAdd > 0 ? creditsAdd : null,
    xp_delta: xpAdd > 0 ? xpAdd : null,
    ref_type: "user_gig",
    ref_id: userGigId,
  });

  const actorId = await getActorId();
  await insertAuditLog("user_gig", userGigId, "paid", actorId);
  revalidatePath("/");
  return { success: true };
}

/** Mark event application as attended (on-site check-in)；仅用 status=attended，与 DB enum application_status 对齐 */
export async function markEventAttended(appId: string): Promise<AdminActionResult> {
  if (!appId) return { success: false, error: "Application ID required" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("event_applications")
    .update({ status: "attended" })
    .eq("id", appId);
  if (error) {
    console.error("[admin] markEventAttended error:", error);
    return { success: false, error: error.message };
  }
  const actorId = await getActorId();
  await insertAuditLog("event_application", appId, "attended", actorId);
  revalidatePath("/");
  return { success: true };
}

export type AdminSchoolResult =
  | { success: true; data?: School }
  | { success: false; error: string };

/** 列出所有学校（Admin 用，service_role 绕过 RLS） */
export async function adminListSchools(): Promise<School[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .order("name");
  if (error) {
    console.error("[admin] listSchools error:", error);
    return [];
  }
  return (data ?? []) as School[];
}

/** 新增学校 */
export async function adminCreateSchool(
  name: string,
  primaryColor: string,
  secondaryColor: string,
  logoUrl: string
): Promise<AdminSchoolResult> {
  if (!name?.trim()) return { success: false, error: "Name is required" };
  const hexRe = /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;
  const p = (primaryColor?.trim() || "#EC4899").startsWith("#") ? (primaryColor?.trim() || "#EC4899") : `#${primaryColor?.trim() || "EC4899"}`;
  const s = (secondaryColor?.trim() || "#831843").startsWith("#") ? (secondaryColor?.trim() || "#831843") : `#${secondaryColor?.trim() || "831843"}`;
  if (!hexRe.test(p)) return { success: false, error: "Invalid primary_color HEX" };
  if (!hexRe.test(s)) return { success: false, error: "Invalid secondary_color HEX" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .insert({
      name: name.trim(),
      primary_color: p,
      secondary_color: s,
      logo_url: logoUrl?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[admin] createSchool error:", error);
    return { success: false, error: error.message };
  }
  return { success: true, data: data as School };
}

/** 更新学校 */
export async function adminUpdateSchool(
  id: string,
  name: string,
  primaryColor: string,
  secondaryColor: string,
  logoUrl: string
): Promise<AdminSchoolResult> {
  if (!id || !name?.trim()) return { success: false, error: "ID and name required" };
  const hexRe = /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;
  const p = primaryColor?.trim() ? (primaryColor.startsWith("#") ? primaryColor : `#${primaryColor}`) : "#EC4899";
  const s = secondaryColor?.trim() ? (secondaryColor.startsWith("#") ? secondaryColor : `#${secondaryColor}`) : "#831843";
  if (!hexRe.test(p)) return { success: false, error: "Invalid primary_color HEX" };
  if (!hexRe.test(s)) return { success: false, error: "Invalid secondary_color HEX" };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("schools")
    .update({
      name: name.trim(),
      primary_color: p,
      secondary_color: s,
      logo_url: logoUrl?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin] updateSchool error:", error);
    return { success: false, error: error.message };
  }
  return { success: true, data: data as School };
}

/** 删除学校 */
export async function adminDeleteSchool(id: string, name?: string): Promise<AdminSchoolResult> {
  if (!id) return { success: false, error: "ID required" };
  if (name === DEFAULT_SCHOOL_NAME) {
    return { success: false, error: "Cannot delete Default (Axelerate)" };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) {
    console.error("[admin] deleteSchool error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

const W9_STORAGE_BUCKET = "w9-forms";

/** 管理台：临时下载链接（1 小时） */
export async function adminGetW9SignedUrl(
  userId: string
): Promise<{ url: string } | { error: string }> {
  const uid = userId?.trim();
  if (!uid) return { error: "Missing user id" };

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("profiles")
    .select("w9_document_path")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.error("[admin] adminGetW9SignedUrl profile:", error);
    return { error: error.message };
  }
  const path = row?.w9_document_path?.trim();
  if (!path) {
    return { error: "No W-9 file on record for this user." };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(W9_STORAGE_BUCKET)
    .createSignedUrl(path, 3600);

  if (signErr || !signed?.signedUrl) {
    return { error: signErr?.message ?? "Could not create download link." };
  }
  return { url: signed.signedUrl };
}

/** 管理台：标记 W-9 已通过核验，用户可继续提现 */
export async function adminApproveProfileW9(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const uid = userId?.trim();
  if (!uid) return { success: false, error: "Missing user id" };

  const supabase = createAdminClient();
  const actorId = await getActorId();
  const { error } = await supabase
    .from("profiles")
    .update({
      is_w9_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", uid);

  if (error) {
    console.error("[admin] adminApproveProfileW9:", error);
    return { success: false, error: error.message };
  }

  await insertAuditLog("profile", uid, "w9_verified", actorId);
  revalidatePath("/");
  return { success: true };
}
