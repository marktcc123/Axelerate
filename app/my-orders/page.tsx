"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { Package, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ORDERS_COLUMNS_EXTENDED,
  ORDERS_COLUMNS_MIN,
  isMissingColumnPostgrestError,
} from "@/lib/orders-select";
import {
  OrderCard,
  type OrderCardOrder,
  type OrderCardProductInfo,
} from "@/components/order-card";

interface ProductInfo extends OrderCardProductInfo {}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Package className="h-12 w-12 text-gray-500" />
      </div>
      <h3 className="mb-2 text-lg font-black uppercase tracking-tight text-white">
        No orders yet
      </h3>
      <p className="mb-6 max-w-[260px] text-sm text-gray-400">
        Your orders will appear here after checkout.
      </p>
      <Link
        href="/?tab=shop"
        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--theme-primary)] bg-[var(--theme-primary)]/20 px-6 py-3 text-sm font-bold text-[var(--theme-primary)] shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.3)] transition-all hover:bg-[var(--theme-primary)]/30"
      >
        <Package className="h-4 w-4" />
        Shop Drops
      </Link>
    </div>
  );
}

export default function MyOrdersPage() {
  const { user } = useAppDataContext();
  const [orders, setOrders] = useState<OrderCardOrder[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;

    const supabase = createClient();
    setLoading(true);
    try {
      let ordersQuery = await supabase
        .from("orders")
        .select(ORDERS_COLUMNS_EXTENDED)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersQuery.error && isMissingColumnPostgrestError(ordersQuery.error)) {
        ordersQuery = await supabase
          .from("orders")
          .select(ORDERS_COLUMNS_MIN)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
      }

      if (ordersQuery.error) {
        console.error("[MyOrders] Orders fetch error:", ordersQuery.error);
        setOrders([]);
        setLoading(false);
        return;
      }

      const ordersList = (ordersQuery.data ?? []) as OrderCardOrder[];
      setOrders(ordersList);

      const productIds = new Set<string>();
      for (const order of ordersList) {
        for (const item of order.items ?? []) {
          if (item?.id) productIds.add(item.id);
        }
      }

      if (productIds.size === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, title, image_url, images")
        .in("id", Array.from(productIds));

      if (productsError) {
        console.error("[MyOrders] Products fetch error:", productsError);
      }
      setProducts((productsData ?? []) as ProductInfo[]);
    } catch (e) {
      console.error("[MyOrders] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  /** Supabase Realtime：orders 表需开启 replication；失败时仅依赖手动刷新 */
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadOrders();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[MyOrders] Realtime subscription unavailable (enable replication on `orders`).");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadOrders]);

  if (!user) {
    return (
      <div className="min-h-screen bg-black p-4 text-white md:p-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400">Please sign in to view your orders.</p>
          <Link href="/" className="mt-4 text-[var(--theme-primary)] hover:underline">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 text-white md:p-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="mb-6 text-2xl font-black uppercase tracking-tight text-white">My Orders</h1>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              productMap={productMap}
              onUpdated={() => void loadOrders()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
