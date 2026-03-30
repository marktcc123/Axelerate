"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnPostgrestError } from "@/lib/orders-select";

export type OrderActionResult =
  | { success: true }
  | { success: false; error: string };

function normalizeStatus(s: string | null | undefined) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/**
 * 申请取消订单（需后台审批）。
 * 仅写入 cancel_request_status=pending + cancel_request_reason；不退款、不改为 cancelled。
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<OrderActionResult> {
  const trimmedReason = reason?.trim() ?? "";
  if (!orderId?.trim()) {
    return { success: false, error: "Order ID required" };
  }
  if (trimmedReason.length < 3) {
    return { success: false, error: "Please provide a cancellation reason (min 3 characters)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[cancelOrder] admin client:", e);
    return {
      success: false,
      error:
        "Server cannot reach database (missing SUPABASE_SERVICE_ROLE_KEY). Check Vercel/host env.",
    };
  }

  // orders 表仅 RLS SELECT，无用户 UPDATE；与 checkout 一致用 service_role 写库，此处已校验 user_id
  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("id, user_id, status, cancel_request_status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    console.error("[cancelOrder] fetch:", fetchError);
    if (isMissingColumnPostgrestError(fetchError)) {
      return {
        success: false,
        error:
          "Database missing cancel columns. Run migration: supabase/migrations/00023_orders_cancel_return_columns.sql",
      };
    }
    return { success: false, error: fetchError.message };
  }

  if (!order || (order as { user_id: string }).user_id !== user.id) {
    return { success: false, error: "Order not found" };
  }

  const status = normalizeStatus((order as { status: string }).status);
  const cr = normalizeStatus((order as { cancel_request_status?: string | null }).cancel_request_status);

  if (status === "cancelled" || status === "canceled") {
    return { success: false, error: "Order already cancelled." };
  }
  if (status === "shipped") {
    return { success: false, error: "Order already shipped." };
  }
  if (status === "delivered" || status === "completed") {
    return { success: false, error: "Order cannot be cancelled." };
  }
  if (status !== "processing") {
    return { success: false, error: "Only orders in processing can be cancelled." };
  }
  if (cr === "pending") {
    return { success: false, error: "A cancellation request is already pending review." };
  }

  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({
      cancel_request_status: "pending",
      cancel_request_reason: trimmedReason,
      admin_rejection_message: null,
    })
    .eq("id", orderId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateErr) {
    console.error("[cancelOrder] submit request:", updateErr);
    return {
      success: false,
      error:
        isMissingColumnPostgrestError(updateErr) ||
        updateErr.message.includes("column") ||
        updateErr.code === "42703"
          ? "Database missing cancel_request columns — apply migration 00023_orders_cancel_return_columns.sql in Supabase."
          : updateErr.message,
    };
  }

  if (!updated) {
    return { success: false, error: "Could not update order — please refresh and try again." };
  }

  revalidatePath("/my-orders");
  revalidatePath("/");
  return { success: true };
}

/**
 * 申请退货：仅允许 delivered，且 return_status 为 none / null。
 * 不退款，待 Admin 在 Dashboard 批准后再退款。
 */
export async function requestReturn(
  orderId: string,
  reason: string
): Promise<OrderActionResult> {
  const trimmedReason = reason?.trim() ?? "";
  if (!orderId?.trim()) {
    return { success: false, error: "Order ID required" };
  }
  if (trimmedReason.length < 3) {
    return { success: false, error: "Please describe the issue (min 3 characters)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error("[requestReturn] admin client:", e);
    return {
      success: false,
      error:
        "Server cannot reach database (missing SUPABASE_SERVICE_ROLE_KEY). Check Vercel/host env.",
    };
  }

  const { data: order, error: fetchError } = await admin
    .from("orders")
    .select("id, user_id, status, return_status")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    console.error("[requestReturn] fetch:", fetchError);
    if (isMissingColumnPostgrestError(fetchError)) {
      return {
        success: false,
        error:
          "Database missing return columns. Run migration: supabase/migrations/00023_orders_cancel_return_columns.sql",
      };
    }
    return { success: false, error: fetchError.message };
  }

  if (!order || order.user_id !== user.id) {
    return { success: false, error: "Order not found" };
  }

  const status = normalizeStatus(order.status as string);
  if (status !== "delivered" && status !== "completed" && status !== "paid") {
    return { success: false, error: "Returns are only available after delivery." };
  }

  const ret = normalizeStatus((order as { return_status?: string | null }).return_status);
  if (ret === "requested" || ret === "approved") {
    return { success: false, error: "A return request is already in progress." };
  }
  if (ret && ret !== "none" && ret !== "") {
    return { success: false, error: "Return status does not allow a new request." };
  }

  const { data: updated, error: updateErr } = await admin
    .from("orders")
    .update({
      return_status: "requested",
      return_reason: trimmedReason,
      admin_rejection_message: null,
    })
    .eq("id", orderId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateErr) {
    console.error("[requestReturn]", updateErr);
    return {
      success: false,
      error: isMissingColumnPostgrestError(updateErr)
        ? "Database missing return columns — apply migration 00023 in Supabase."
        : updateErr.message,
    };
  }

  if (!updated) {
    return { success: false, error: "Could not submit return — please refresh and try again." };
  }

  revalidatePath("/my-orders");
  revalidatePath("/");
  return { success: true };
}
