"use client";

import { useState } from "react";
import { Package, Truck, CheckCircle, Copy, Ban } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OrderLifecycleActions } from "@/components/order-lifecycle-actions";

export interface OrderCardProductInfo {
  id: string;
  title: string;
  image_url: string | null;
  images?: string[] | null;
}

export interface OrderCardOrder {
  id: string;
  user_id: string;
  total_amount?: number;
  cash_paid?: number;
  credits_used?: number;
  items: { id: string; quantity: number; price?: number }[];
  status: string;
  tracking_number?: string | null;
  cancel_reason?: string | null;
  cancel_request_status?: string | null;
  cancel_request_reason?: string | null;
  admin_rejection_message?: string | null;
  return_status?: string | null;
  return_reason?: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function normalize(s: string | null | undefined) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function OrderTimeline({
  status,
  cancelReason,
}: {
  status: string;
  cancelReason?: string | null;
}) {
  const current = normalize(status);
  if (current === "cancelled" || current === "canceled") {
    const reason = cancelReason?.trim();
    return (
      <div className="rounded-xl border-2 border-red-500/40 bg-red-500/5 py-4 shadow-sm dark:border-red-500/30">
        <div className="flex items-center justify-center gap-2">
          <Ban className="h-5 w-5 text-red-400" />
          <span className="text-xs font-black uppercase tracking-widest text-red-400">
            Order cancelled
          </span>
        </div>
        {reason ? (
          <p className="mt-2 px-4 text-center text-[11px] text-gray-400">
            <span className="font-bold text-gray-300">Reason: </span>
            {reason}
          </p>
        ) : null}
      </div>
    );
  }

  const steps = ["processing", "shipped", "delivered"] as const;
  let idx = steps.indexOf(current as (typeof steps)[number]);
  if (idx === -1) {
    if (current === "completed" || current === "paid") idx = 2;
    else idx = 0;
  }
  const finalIndex =
    current === "completed" || current === "paid" ? 2 : idx;

  return (
    <div className="relative flex w-full items-center justify-between px-4 py-6">
      <div className="absolute left-8 right-8 top-1/2 z-0 h-[2px] -translate-y-1/2 bg-white/10" />
      <div
        className="absolute left-8 top-1/2 z-0 h-[2px] -translate-y-1/2 bg-[var(--theme-primary)] shadow-[0_0_10px_var(--theme-primary)] transition-all duration-500"
        style={{
          width: `${(finalIndex / (steps.length - 1)) * 100}%`,
          maxWidth: "calc(100% - 4rem)",
        }}
      />
      {steps.map((step, index) => {
        const isCompleted = index <= finalIndex;
        const isCurrent = index === finalIndex;
        let Icon = Package;
        if (step === "shipped") Icon = Truck;
        if (step === "delivered") Icon = CheckCircle;
        return (
          <div key={step} className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-[#0a0a0a] transition-all duration-500",
                isCompleted
                  ? "border-[var(--theme-primary)] text-[var(--theme-primary)] shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.4)]"
                  : "border-white/20 text-gray-500"
              )}
            >
              <Icon size={18} className={isCurrent ? "animate-pulse" : ""} />
            </div>
            <span
              className={cn(
                "text-[10px] font-black uppercase tracking-wider transition-colors",
                isCompleted ? "text-white" : "text-gray-600"
              )}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function OrderCard({
  order,
  productMap,
  onUpdated,
}: {
  order: OrderCardOrder;
  productMap: Map<string, OrderCardProductInfo>;
  onUpdated?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const tracking = order.tracking_number ?? "";
  const status = normalize(order.status);
  const isCancelled = status === "cancelled" || status === "canceled";
  const returnSt = normalize(order.return_status);
  const cancelReq = normalize(order.cancel_request_status);

  const copyTracking = () => {
    if (!tracking) return;
    void navigator.clipboard.writeText(tracking);
    setCopied(true);
    toast.success("Tracking number copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "relative mb-6 overflow-hidden rounded-2xl border-2 border-white/10 bg-[#0a0a0a] shadow-[4px_4px_0_rgba(255,255,255,0.06)]",
        isCancelled && "opacity-75"
      )}
    >
      {isCancelled && (
        <div
          className="pointer-events-none absolute right-6 top-1/2 z-20 -translate-y-1/2 rotate-[-12deg] select-none rounded-lg border-4 border-red-500/80 px-3 py-1 text-lg font-black uppercase tracking-widest text-red-500/90"
          aria-hidden
        >
          Canceled
        </div>
      )}

      <div className="border-b border-white/10 p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {cancelReq === "pending" && (
            <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-400">
              Cancel pending review
            </span>
          )}
          {cancelReq === "rejected" && (
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase text-gray-400">
              Cancel declined
            </span>
          )}
          {returnSt === "requested" && (
            <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-400">
              Return pending review
            </span>
          )}
          {returnSt === "approved" && (
            <span className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">
              Return approved
            </span>
          )}
          {returnSt === "rejected" && (
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase text-gray-400">
              Return declined
            </span>
          )}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-[var(--theme-primary)]">
              #{order.id.substring(0, 8)}
            </span>
            <span className="text-xs text-gray-500">{formatDate(order.created_at)}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-2xl font-black text-white">
            ${Number(order.cash_paid ?? order.total_amount ?? 0).toFixed(2)}
          </div>
          {order.credits_used != null && order.credits_used > 0 && (
            <span className="text-sm text-amber-400">+{order.credits_used} Pts Used</span>
          )}
        </div>

        <OrderTimeline status={order.status} cancelReason={order.cancel_reason} />

        {tracking && !isCancelled && (
          <button
            type="button"
            onClick={copyTracking}
            className="mt-2 flex items-center gap-2 rounded-lg border-2 border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-gray-400 shadow-sm transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {tracking}
          </button>
        )}

        <OrderLifecycleActions order={order} onUpdated={onUpdated} />
      </div>

      <div className="divide-y divide-white/5 p-4">
        {(order.items ?? []).map((item) => {
          const product = productMap.get(item.id);
          const thumb = product?.images?.[0] ?? product?.image_url ?? null;
          return (
            <div
              key={`${item.id}-${item.quantity}`}
              className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-white/10 bg-white/5 shadow-sm">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-6 w-6 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">
                  {product?.title ?? "Unknown Product"}
                </p>
                <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
