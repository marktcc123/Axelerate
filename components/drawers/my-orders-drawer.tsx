"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  Copy,
  Sparkles,
  ShoppingBag,
  ChevronRight,
  Loader2,
  Ban,
  Gift,
} from "lucide-react";
import { cn, copyTextToClipboard } from "@/lib/utils";
import { useAppDataContext } from "@/lib/context/app-data-context";
import type { Order, Product, OrderItemRaw } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { OrderLifecycleActions } from "@/components/order-lifecycle-actions";
import { createClient } from "@/lib/supabase/client";

const DIGITAL_CATEGORIES = ["tech", "gaming", "Tech", "Gaming"];

function isDigitalProduct(product: Product | undefined): boolean {
  if (!product) return false;
  const cat = (product.category ?? "").toLowerCase();
  return DIGITAL_CATEGORIES.some((c) => cat.includes(c.toLowerCase()));
}

function generatePlaceholderCode(): string {
  return Array.from({ length: 16 }, () =>
    Math.random().toString(36).charAt(2)
  )
    .join("")
    .toUpperCase()
    .replace(/(.{4})/g, "$1-")
    .replace(/-$/, "");
}

interface ResolvedOrderItem {
  product: Product | null;
  quantity: number;
  itemRaw: OrderItemRaw;
}

function resolveOrderItems(
  order: Order,
  products: Product[]
): ResolvedOrderItem[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return (order.items ?? []).map((item) => ({
    product: productMap.get(item.id) ?? null,
    quantity: item.quantity,
    itemRaw: item,
  }));
}

function OrderTrackingTimeline({
  order,
  isPhysical,
}: {
  order: Order;
  isPhysical: boolean;
}) {
  const tracking = order.tracking_number ?? "";

  const [copied, setCopied] = useState(false);
  const copyTracking = () => {
    const text = tracking || "AXLR-XXXX-XXXX-XXXX";
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Tracking number copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // 强制转小写并去除空格，兼容历史脏数据（paid、PROCESSING、null 等）
  const rawStatus = String(order.status ?? "processing")
    .toLowerCase()
    .trim();

  if (rawStatus === "cancelled" || rawStatus === "canceled") {
    const reason = (order as { cancel_reason?: string | null }).cancel_reason?.trim();
    return (
      <div className="mb-4 rounded-2xl border-2 border-red-500/45 bg-red-500/5 p-4 shadow-sm dark:border-red-500/35 dark:bg-red-950/20">
        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500">
          <Ban className="h-4 w-4 shrink-0" />
          Cancelled
        </div>
        {reason ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground/80">Reason: </span>
            {reason}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">This order was cancelled.</p>
        )}
      </div>
    );
  }

  /** 是否已进入发货及之后阶段（仅依据 status，不使用 shipped_at） */
  const hasShipped =
    rawStatus === "shipped" ||
    rawStatus === "delivered" ||
    rawStatus === "completed" ||
    rawStatus === "paid";

  const steps: readonly string[] = ["processing", "shipped", "delivered"];
  let activeIndex = steps.indexOf(rawStatus);

  // 未知状态一律归为第一档（Processing），绝不静默隐藏
  if (activeIndex === -1) {
    if (rawStatus === "completed" || rawStatus === "paid") {
      activeIndex = 2;
    } else if (hasShipped) {
      activeIndex = 1;
    } else {
      activeIndex = 0; // 默认 Processing
    }
  }
  if (hasShipped && activeIndex < 1) activeIndex = 1;

  const stepConfig = [
    { key: "processing", label: "Processing", icon: Package },
    { key: "shipped", label: "Shipped", icon: Truck },
    { key: "delivered", label: "Delivered", icon: CheckCircle2 },
  ] as const;

  return (
    <div className="mb-4 rounded-2xl border-2 border-border bg-muted/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {isPhysical ? "Tracking" : "Order status"}
      </div>
      <div className="flex items-center justify-between gap-2">
        {stepConfig.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index <= activeIndex;
          const isCurrent = index === activeIndex;
          const isDelivered = index === 2 && activeIndex === 2;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      isCompleted ? "bg-[var(--theme-primary)]" : "bg-border dark:bg-white/10"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    isDelivered &&
                      "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]",
                    isCompleted &&
                      !isDelivered &&
                      "border-[var(--theme-primary)] bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] shadow-[0_0_15px_rgba(var(--theme-primary-rgb),0.5)]",
                    !isCompleted &&
                      "border-border bg-muted text-muted-foreground dark:border-white/20 dark:bg-white/5"
                  )}
                >
                  {isDelivered ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className={cn("h-4 w-4", isCurrent && "animate-pulse")} />
                  )}
                </div>
                {index < stepConfig.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 transition-colors",
                      isCompleted ? "bg-[var(--theme-primary)]" : "bg-border dark:bg-white/10"
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[10px] font-bold uppercase transition-colors",
                  isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {step.key === "shipped" && tracking && (
                <button
                  onClick={copyTracking}
                  className="mt-1 flex items-center gap-1 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2 py-1 text-[10px] font-mono text-brand-primary transition-all hover:bg-brand-primary/20"
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {tracking.slice(0, 12)}...
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  products,
  onRevealCode,
  onOrdersMutated,
  giftOutbound,
  isGiftRedemption,
}: {
  order: Order;
  products: Product[];
  onRevealCode: (orderId: string, code: string) => void;
  onOrdersMutated?: () => void;
  giftOutbound?: { token: string; claimed_at: string | null };
  isGiftRedemption?: boolean;
}) {
  const resolved = resolveOrderItems(order, products);
  // 空订单或无法解析时，默认视为实体订单，强制显示物流进度条（避免 [].every() 导致 allDigital=true 隐藏）
  const allDigital =
    resolved.length > 0 &&
    resolved.every((r) => isDigitalProduct(r.product ?? undefined));
  const isPhysical = !allDigital;

  const stLower = String(order.status ?? "processing").toLowerCase().trim();
  const isOrdCancelled = stLower === "cancelled" || stLower === "canceled";
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});

  const handleReveal = (orderId: string) => {
    const code = generatePlaceholderCode();
    setRevealedCodes((prev) => ({ ...prev, [orderId]: code }));
    onRevealCode(orderId, code);
  };

  const status = (order.status?.toLowerCase() ?? "processing").trim();
  const isCompleted = status === "completed";
  const returnSt = String((order as { return_status?: string | null }).return_status ?? "")
    .trim()
    .toLowerCase();
  const cancelReq = String(
    (order as { cancel_request_status?: string | null }).cancel_request_status ?? ""
  )
    .trim()
    .toLowerCase();
  const adminMsg = String(
    (order as { admin_rejection_message?: string | null }).admin_rejection_message ?? ""
  ).trim();

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="border-b border-border p-4 dark:border-white/10">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {(status === "cancelled" || status === "canceled") && (
            <span className="rounded-md border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-500">
              Cancelled
            </span>
          )}
          {returnSt === "requested" && (
            <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Return pending review
            </span>
          )}
          {returnSt === "approved" && (
            <span className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Return approved
            </span>
          )}
          {returnSt === "rejected" && (
            <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[9px] font-black uppercase text-muted-foreground">
              Return declined
            </span>
          )}
          {cancelReq === "pending" && (
            <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Cancel pending review
            </span>
          )}
          {cancelReq === "rejected" && (
            <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[9px] font-black uppercase text-muted-foreground">
              Cancel declined
            </span>
          )}
          {giftOutbound && (
            <span className="inline-flex items-center gap-1 rounded-md border border-fuchsia-500/45 bg-fuchsia-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-200">
              <Gift className="h-3 w-3 shrink-0" aria-hidden />
              Gift link {giftOutbound.claimed_at ? "· claimed" : "· pending"}
            </span>
          )}
          {isGiftRedemption ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/45 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
              Gift redeemed
            </span>
          ) : null}
        </div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Order #{order.id.slice(0, 8)}
          </span>
          <span className="text-xs font-bold text-foreground">
            {isGiftRedemption ?
              `$0.00`
            : `$${Number(order.cash_paid ?? order.total_amount).toFixed(2)}`}
          </span>
        </div>

        {giftOutbound ?
          <div className="mb-3 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-fuchsia-800 dark:text-fuchsia-200">
              Friend checks out via link (no duplicate charge).
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-2 dark:border-white/10">
              <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">
                {typeof window !== "undefined" ?
                  `${window.location.origin}/gift/${encodeURIComponent(giftOutbound.token)}`
                : `/gift/${giftOutbound.token}`}
              </span>
              <button
                type="button"
                onClick={async () => {
                  const url =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/gift/${encodeURIComponent(giftOutbound.token)}`
                      : "";
                  const ok = await copyTextToClipboard(url);
                  if (ok) toast.success("Gift link copied");
                  else {
                    toast.error(
                      "Copy blocked — paste manually or enable clipboard permission (HTTPS).",
                    );
                  }
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-fuchsia-900 dark:text-fuchsia-100"
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copy
              </button>
            </div>
          </div>
        : null}

        {isGiftRedemption ?
          <p className="mb-3 text-[11px] font-semibold leading-snug text-emerald-700 dark:text-emerald-300">
            Paid by your Axelerate friend — this $0 fulfillment order is tied to their gift checkout.
          </p>
        : null}

        <OrderTrackingTimeline order={order} isPhysical={isPhysical} />

        {adminMsg && (returnSt === "rejected" || cancelReq === "rejected") && (
          <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-snug text-foreground/90 dark:text-zinc-300">
            <span className="font-bold text-amber-700 dark:text-amber-400">Message from team: </span>
            {adminMsg}
          </p>
        )}

        <OrderLifecycleActions
          order={order}
          onUpdated={onOrdersMutated}
        />

        {allDigital && isCompleted && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">Completed</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-border p-4 dark:divide-white/5">
        {resolved.map(({ product, quantity, itemRaw }) => {
          const digital = isDigitalProduct(product || undefined);
          const code = revealedCodes[order.id];
          const showReveal = digital && isCompleted;
          return (
            <div
              key={itemRaw.id + quantity}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted dark:bg-white/5">
                {product?.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground dark:text-white">
                  {product?.title ?? "Unknown Product"}
                </p>
                <p className="text-xs text-muted-foreground">Qty: {quantity}</p>
                {showReveal && (
                  <div className="mt-2">
                    {code ? (
                      <div className="rounded-lg border border-brand-primary/30 bg-brand-primary/10 p-2 font-mono text-xs text-brand-primary">
                        {code}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleReveal(order.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary bg-brand-primary/20 px-3 py-1.5 text-xs font-bold text-brand-primary shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.3)] transition-all hover:bg-brand-primary/30 hover:shadow-[0_0_16px_rgba(var(--theme-primary-rgb),0.4)]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Reveal Code
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyOrders({ onShopDrops }: { onShopDrops: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-border bg-muted shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
        <Package className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-black uppercase tracking-tight text-foreground dark:text-white">
        Your stash is empty
      </h3>
      <p className="mb-6 max-w-[260px] text-sm text-muted-foreground">
        Go grab some exclusive gear.
      </p>
      <button
        onClick={onShopDrops}
        className="inline-flex items-center gap-2 rounded-2xl border border-brand-primary bg-brand-primary/20 px-6 py-3 text-sm font-bold text-brand-primary shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)] transition-all hover:bg-brand-primary/30 hover:shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.4)]"
      >
        <ShoppingBag className="h-4 w-4" />
        Shop Drops
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MyOrdersDrawer({
  open,
  onShopDrops,
}: {
  open?: boolean;
  onShopDrops?: () => void;
}) {
  const { user, orders, publicProducts, isLoadingPrivate, refetchPrivate } =
    useAppDataContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [giftOutboundByPurchase, setGiftOutboundByPurchase] = useState<
    Map<string, { token: string; claimed_at: string | null }>
  >(() => new Map());
  const [giftInboundOrderIds, setGiftInboundOrderIds] = useState<Set<string>>(
    () => new Set(),
  );

  const orderIdsKey = orders.map((o) => o.id).join("|");

  useEffect(() => {
    if ((open ?? true) && user?.id) {
      setIsRefreshing(true);
      refetchPrivate({ silent: true })
        .then(() => setIsRefreshing(false))
        .catch(() => setIsRefreshing(false));
    }
  }, [open, user?.id, refetchPrivate]);

  useEffect(() => {
    if (!user?.id || orders.length === 0) {
      setGiftOutboundByPurchase(new Map());
      setGiftInboundOrderIds(new Set());
      return;
    }

    const supabase = createClient();
    const ids = orders.map((o) => o.id);
    let cancelled = false;

    void (async () => {
      const [outRes, inRes] = await Promise.all([
        supabase.from("gift_claims").select("purchaser_order_id, token, claimed_at").in("purchaser_order_id", ids),
        supabase.from("gift_claims").select("recipient_order_id").in("recipient_order_id", ids),
      ]);

      if (cancelled) return;

      const nextOut = new Map<string, { token: string; claimed_at: string | null }>();
      for (const row of (outRes.data ?? []) as {
        purchaser_order_id: string;
        token: string;
        claimed_at: string | null;
      }[]) {
        nextOut.set(row.purchaser_order_id, {
          token: row.token,
          claimed_at: row.claimed_at,
        });
      }

      const nextIn = new Set<string>();
      for (const row of (inRes.data ?? []) as { recipient_order_id: string | null }[]) {
        if (row.recipient_order_id) nextIn.add(row.recipient_order_id);
      }

      setGiftOutboundByPurchase(nextOut);
      setGiftInboundOrderIds(nextIn);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, orders.length, orderIdsKey]);

  const handleRevealCode = (orderId: string, code: string) => {
    toast.success("Code revealed! Save it somewhere safe.");
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to view your orders</p>
      </div>
    );
  }

  if (isLoadingPrivate) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0 && !isRefreshing) {
    return <EmptyOrders onShopDrops={onShopDrops ?? (() => {})} />;
  }

  if (orders.length === 0 && isRefreshing) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? "s" : ""}
        </span>
        {isRefreshing && (
          <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
        )}
      </div>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          products={publicProducts}
          onRevealCode={handleRevealCode}
          giftOutbound={giftOutboundByPurchase.get(order.id)}
          isGiftRedemption={giftInboundOrderIds.has(order.id)}
          onOrdersMutated={() => void refetchPrivate({ silent: true })}
        />
      ))}
    </div>
  );
}
