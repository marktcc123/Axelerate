"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useTransition, useRef, useCallback } from "react";
import {
  ShoppingBag,
  Lock,
  Flame,
  CheckCircle2,
  Package,
  X,
  Gift,
  Link2,
  QrCode,
  AlertTriangle,
  Zap,
  Trash2,
  Loader,
  BellRing,
  Check,
  CreditCard,
  Wallet,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { useAppDataContext } from "@/lib/context/app-data-context";
import {
  canAccessTier,
  TIER_CONFIG,
  getNextTierXp,
} from "@/lib/types";
import type { Product, UserTier } from "@/lib/types";
import { TierBadge } from "./tier-badge";
import { Skeleton } from "./ui/skeleton";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import Confetti from "react-confetti";
import { processCheckout } from "@/app/actions/checkout";
import {
  createStripeCheckoutSession,
  isStripePaymentsEnabled,
} from "@/app/actions/stripe-checkout";
import { joinWaitlist } from "@/app/actions/shop";
import { useCartStore } from "@/store/cart-store";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";

const CATEGORIES = ["All", "Beauty", "Food", "Apparel", "Drops"] as const;
type CategoryTab = (typeof CATEGORIES)[number];

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

function DropZoneBanner({
  products,
  onAddToCart,
  userTier,
}: {
  products: Product[];
  onAddToCart: (p: Product) => void;
  userTier: UserTier;
}) {
  const dropProducts = products.filter(
    (p) => p.is_drop === true || p.drop_time != null
  );
  const nextDrop = dropProducts[0] ?? null;
  const time = useCountdown(nextDrop?.drop_time ?? null);
  const topDrop = dropProducts.find((p) => p.is_drop === true || p.drop_time) ?? nextDrop;

  if (dropProducts.length === 0) return null;

  const accessible = topDrop ? canAccessTier(userTier, topDrop.min_tier_required) : false;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-brand-primary/30 bg-card shadow-md backdrop-blur-sm dark:bg-zinc-900/80">
      <div className="flex items-center gap-2 bg-gradient-to-r from-brand-primary to-purple-600 px-4 py-2.5">
        <Flame className="h-4 w-4 text-white" />
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-white">
          Friday Night Drop
        </span>
      </div>

      <div className="p-4">
        <p className="mb-4 text-xs text-muted-foreground">
          Exclusive streetwear + beauty items. Limited quantity.
        </p>

        <div className="mb-4 flex justify-center gap-3">
          {[
            { label: "Days", value: time.d },
            { label: "Hrs", value: time.h },
            { label: "Min", value: time.m },
            { label: "Sec", value: time.s },
          ].map((unit) => (
            <div key={unit.label} className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-border bg-muted font-mono text-lg font-black text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white">
                {String(unit.value).padStart(2, "0")}
              </div>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {unit.label}
              </span>
            </div>
          ))}
        </div>

        {topDrop && (
          <div className="flex items-center gap-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
            <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-muted/50 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
              {topDrop.image_url ? (
                <img
                  src={topDrop.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-foreground dark:text-white">
                {topDrop.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {topDrop.brand?.name ?? "—"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-black text-brand-primary">
                  ${Number(topDrop.discount_price ?? topDrop.original_price ?? topDrop.price_credits)}
                </span>
                {topDrop.original_price != null && topDrop.original_price > 0 && (
                  <span className="text-sm text-muted-foreground line-through">
                    ${topDrop.original_price}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (accessible && topDrop.stock_count > 0) {
                  onAddToCart(topDrop);
                }
              }}
              disabled={!accessible || topDrop.stock_count === 0}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95",
                accessible && topDrop.stock_count > 0
                  ? "bg-brand-primary text-white shadow-[0_0_20px_rgba(var(--theme-primary-rgb),0.4)] hover:bg-brand-primary"
                  : "border-2 border-border bg-muted text-muted-foreground dark:border-transparent dark:bg-white/5"
              )}
            >
              {topDrop.stock_count === 0 ? "Sold Out" : "Grab It"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartDrawer({
  cart,
  open,
  onOpenChange,
  onRemove,
  onUpdateQuantity,
  profile,
  userId,
  onCheckoutSuccess,
  refetchPrivate,
  stripeEnabled,
}: {
  cart: { product: Product; qty: number }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  profile: { cash_balance: number; credit_balance?: number } | null;
  userId: string | null;
  onCheckoutSuccess: () => void;
  refetchPrivate: () => Promise<void>;
  stripeEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showConfetti, setShowConfetti] = useState(false);
  const [creditsToUse, setCreditsToUse] = useState(0);
  const [payMethod, setPayMethod] = useState<"balance" | "card">("balance");

  const userBalance = profile?.cash_balance ?? 0;
  const userCredits = profile?.credit_balance ?? 0;

  const subtotal = useMemo(
    () =>
      cart.reduce((acc, { product, qty }) => {
        const price =
          product.discount_price ?? product.original_price ?? 0;
        return acc + Number(price) * qty;
      }, 0),
    [cart]
  );

  const maxCreditsAllowed = Math.min(
    userCredits,
    Math.floor(subtotal * 100)
  );

  const creditsDiscount = creditsToUse / 100;
  const finalTotal = Math.max(0, subtotal - creditsDiscount);

  const canPayBalance =
    Boolean(userId) && userCredits >= creditsToUse && finalTotal <= userBalance;
  const canPayCard =
    Boolean(userId) && stripeEnabled && userCredits >= creditsToUse && finalTotal > 0;

  useEffect(() => {
    setCreditsToUse((prev) => Math.min(prev, maxCreditsAllowed));
  }, [maxCreditsAllowed, cart.length]);

  useEffect(() => {
    if (!open) return;
    if (finalTotal <= 0) {
      setPayMethod("balance");
      return;
    }
    if (stripeEnabled && finalTotal > userBalance) {
      setPayMethod("card");
    } else {
      setPayMethod("balance");
    }
  }, [open, finalTotal, userBalance, stripeEnabled]);

  const handleCheckout = () => {
    if (!userId || cart.length === 0) {
      toast.error("Please sign in to checkout");
      return;
    }
    if (userBalance < finalTotal) {
      toast.error("Insufficient Cash Balance.");
      return;
    }
    if (userCredits < creditsToUse) {
      toast.error("Insufficient Credits.");
      return;
    }
    startTransition(async () => {
      const cartItems = cart.map((c) => ({
        id: c.product.id,
        quantity: c.qty,
      }));
      const result = await processCheckout(userId, cartItems, creditsToUse);
      if (result.success) {
        setCreditsToUse(0);
        onCheckoutSuccess();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
        toast.success("Payment successful! Order confirmed.");
        onOpenChange(false);
        await refetchPrivate();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleStripeCheckout = () => {
    if (!userId || cart.length === 0) {
      toast.error("Please sign in to checkout");
      return;
    }
    if (userCredits < creditsToUse) {
      toast.error("Insufficient Credits.");
      return;
    }
    if (finalTotal <= 0) {
      toast.error("No card payment needed for this total.");
      return;
    }
    startTransition(async () => {
      const cartItems = cart.map((c) => ({
        id: c.product.id,
        quantity: c.qty,
      }));
      const result = await createStripeCheckoutSession(cartItems, creditsToUse);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      window.location.href = result.url;
    });
  };

  return (
    <>
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          <Confetti
            width={typeof window !== "undefined" ? window.innerWidth : 400}
            height={typeof window !== "undefined" ? window.innerHeight : 600}
            recycle={false}
            numberOfPieces={400}
          />
        </div>
      )}
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-muted dark:[&>div:first-child]:bg-white/20">
          <div className="flex flex-col px-4 pb-8">
            <div className="flex items-center justify-between border-b border-border py-3 dark:border-white/10">
              <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Your Stash
              </DrawerTitle>
            <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-foreground shadow-sm dark:border-transparent dark:bg-white/10">
              <X className="h-4 w-4" />
            </DrawerClose>
          </div>

          <div className="py-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBag className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Your cart is empty
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(({ product, qty }) => {
                  const price =
                    product.discount_price ??
                    product.original_price ??
                    0;
                  return (
                    <div
                      key={product.id}
                      className="rounded-xl border-2 border-border bg-muted/40 p-3 shadow-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted dark:bg-white/5">
                          {product.image_url ? (
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
                            {product.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.brand?.name ?? "—"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-black text-brand-primary">
                          ${(Number(price) * qty).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center rounded-md border-2 border-border bg-muted dark:border-white/10 dark:bg-zinc-900">
                          <button
                            onClick={() =>
                              onUpdateQuantity(product.id, qty - 1)
                            }
                            className="px-2 py-1 text-muted-foreground transition-colors hover:text-foreground dark:hover:text-white"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-sm font-bold text-foreground dark:text-white">
                            {qty}
                          </span>
                          <button
                            onClick={() =>
                              onUpdateQuantity(product.id, qty + 1)
                            }
                            className="px-2 py-1 text-muted-foreground transition-colors hover:text-foreground dark:hover:text-white"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => onRemove(product.id)}
                          className="text-muted-foreground transition-colors hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="mt-4 space-y-4 border-t border-border pt-4 dark:border-white/10">
              <div className="flex items-center justify-between rounded-xl border-2 border-border bg-card p-4 shadow-sm dark:border-white/5 dark:bg-zinc-950">
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Available Balance
                  </div>
                  <div className="text-xl font-black text-emerald-400">
                    ${Number(userBalance).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Available Credits
                  </div>
                  <div className="flex items-center justify-end gap-1 text-xl font-black text-amber-400">
                    <Zap size={16} className="fill-amber-400" /> {userCredits} Pts
                  </div>
                </div>
              </div>

              {maxCreditsAllowed > 0 && (
                <div className="rounded-xl border-2 border-border bg-muted/50 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-foreground/90 dark:text-zinc-300">
                      Use Credits to save (100 Pts = $1)
                    </span>
                    <span className="font-bold text-amber-400">
                      -
                      {(creditsToUse / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max={maxCreditsAllowed}
                      step="100"
                      value={creditsToUse}
                      onChange={(e) =>
                        setCreditsToUse(Number(e.target.value))
                      }
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-amber-500 dark:bg-zinc-800 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:appearance-none"
                    />
                    <button
                      onClick={() => setCreditsToUse(maxCreditsAllowed)}
                      className="whitespace-nowrap rounded bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/30"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="mt-2 text-right text-xs text-muted-foreground">
                    {creditsToUse} Pts selected
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold text-foreground dark:text-white">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                {creditsToUse > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount (Credits)</span>
                    <span className="font-bold text-amber-400">
                      -${creditsDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base">
                  <span className="font-bold text-foreground dark:text-white">Final Total</span>
                  <span className="font-black text-foreground dark:text-white">
                    ${finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {stripeEnabled && finalTotal > 0 && (
                <div className="space-y-2">
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Choose how to pay
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayMethod("balance")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs font-bold uppercase tracking-wide transition-all",
                        payMethod === "balance"
                          ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/15 text-foreground dark:text-white"
                          : "border-border bg-muted/40 text-muted-foreground dark:border-white/10 dark:bg-white/5",
                        !canPayBalance && payMethod !== "balance" && "opacity-60"
                      )}
                    >
                      <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                      Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod("card")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-xs font-bold uppercase tracking-wide transition-all",
                        payMethod === "card"
                          ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/15 text-foreground dark:text-white"
                          : "border-border bg-muted/40 text-muted-foreground dark:border-white/10 dark:bg-white/5"
                      )}
                    >
                      <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
                      Card
                    </button>
                  </div>
                  {!canPayBalance && finalTotal > userBalance && (
                    <p className="text-center text-[11px] text-muted-foreground">
                      Balance too low — use card or{" "}
                      <span className="font-semibold text-foreground">add funds</span> in Wallet.
                    </p>
                  )}
                </div>
              )}

              {(!stripeEnabled || finalTotal <= 0 || payMethod === "balance") && (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isPending || !canPayBalance}
                  className={cn(
                    "btn-primary-glow flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-[var(--theme-primary)] py-4 text-lg font-black text-black shadow-md shadow-[0_0_30px_rgba(var(--theme-primary-rgb),0.4)] transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
                  {isPending ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    "Pay with wallet balance"
                  )}
                </button>
              )}
              {stripeEnabled && finalTotal > 0 && payMethod === "card" && (
                <button
                  type="button"
                  onClick={handleStripeCheckout}
                  disabled={isPending || !canPayCard}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card py-4 text-sm font-black uppercase tracking-wider text-foreground shadow-sm transition-all hover:bg-muted/60 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
                  Pay with Stripe
                </button>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Lowest Price Guaranteed for Axelerate Students.
              </p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
}

function UnlockDrawer({
  product,
  userTier,
  userId,
  open,
  onOpenChange,
  onAddToCart,
}: {
  product: Product;
  userTier: UserTier;
  userId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (p: Product) => void;
}) {
  const isUnlockable = canAccessTier(userTier, product.min_tier_required);
  const isSoldOut = product.stock_count <= 0;
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isWaitlisting, setIsWaitlisting] = useState(false);

  useEffect(() => {
    if (!open || !userId || !product.id) {
      setIsOnWaitlist(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from("product_waitlist")
      .select("id")
      .eq("product_id", product.id)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setIsOnWaitlist(!!data));
  }, [open, userId, product.id]);

  const handleAdd = () => {
    onAddToCart(product);
    onOpenChange(false);
  };

  const handleJoinWaitlist = async () => {
    if (!product.id || isWaitlisting) return;
    if (!userId) {
      toast.error("Please log in first.");
      return;
    }
    setIsWaitlisting(true);
    const result = await joinWaitlist(product.id);
    setIsWaitlisting(false);
    if (result.success) {
      setIsOnWaitlist(true);
      toast.success("You're on the list!", {
        description: "We'll notify you when this item is back in stock.",
      });
    } else {
      toast.error(result.error);
    }
  };

  const salePrice =
    product.discount_price ?? product.original_price ?? product.price_credits;
  const originalPrice = product.original_price ?? product.price_credits;
  const discount =
    originalPrice > 0
      ? `${Math.round(((originalPrice - Number(salePrice)) / originalPrice) * 100)}% OFF`
      : "";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-muted dark:[&>div:first-child]:bg-white/20">
        <div className="relative px-6 pb-8">
          <DrawerClose className="absolute right-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-foreground shadow-sm dark:border-transparent dark:bg-white/10">
            <X className="h-4 w-4" />
          </DrawerClose>

          <DrawerHeader className="p-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted/50 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <DrawerTitle className="text-base font-black text-foreground dark:text-white">
                  {product.title}
                </DrawerTitle>
                <p className="text-xs text-muted-foreground">
                  {product.brand?.name ?? "—"}
                </p>
              </div>
            </div>
          </DrawerHeader>

          <div className="mb-4 rounded-xl border-2 border-border bg-muted/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Exclusive Price
              </span>
              {discount && (
                <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[10px] font-black text-brand-primary">
                  🔥 {discount}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-brand-primary">
                ${Number(salePrice)}
              </span>
              {originalPrice > 0 && (
                <span className="text-lg text-muted-foreground line-through">
                  ${originalPrice}
                </span>
              )}
            </div>
          </div>

          {!isUnlockable ? (
            <div className="mb-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-bold text-foreground dark:text-white">
                  Reach {TIER_CONFIG[product.min_tier_required].label} to unlock
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-brand-primary/30 bg-brand-primary/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-bold text-brand-primary">
                  Unlocked! Add to your stash.
                </span>
              </div>
            </div>
          )}

          {!isUnlockable ? (
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border-2 border-border bg-muted py-4 text-sm font-black uppercase tracking-wider text-muted-foreground dark:border-white/10 dark:bg-white/5"
            >
              <Lock className="h-4 w-4" />
              Locked
            </button>
          ) : !isSoldOut ? (
            <button
              onClick={handleAdd}
              className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border py-4 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98] bg-brand-primary"
            >
              <ShoppingBag className="h-4 w-4" />
              Add to Cart
            </button>
          ) : isOnWaitlist ? (
            <button
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border-2 border-emerald-900/50 bg-muted py-4 text-sm font-black uppercase tracking-wider text-emerald-600 dark:bg-zinc-800 dark:text-emerald-400"
            >
              <Check className="h-4 w-4" />
              YOU&apos;RE ON THE LIST
            </button>
          ) : (
            <button
              onClick={handleJoinWaitlist}
              disabled={isWaitlisting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-muted py-4 text-sm font-black uppercase tracking-wider text-foreground transition-all hover:bg-muted/80 active:scale-[0.98] disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              <BellRing className="h-4 w-4" />
              {isWaitlisting ? "ADDING..." : "NOTIFY ME WHEN AVAILABLE"}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function GiftDrawer({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sent, setSent] = useState(false);
  const salePrice =
    product.discount_price ?? product.original_price ?? product.price_credits;

  const handleSend = () => {
    setSent(true);
    toast.success("Gift link created!", {
      description: "Share with your friend to claim.",
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-muted dark:[&>div:first-child]:bg-white/20">
        <div className="relative px-6 pb-8">
          <DrawerClose className="absolute right-4 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-foreground shadow-sm dark:border-transparent dark:bg-white/10">
            <X className="h-4 w-4" />
          </DrawerClose>

          <DrawerHeader className="p-0">
            <div className="mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5 text-brand-primary" />
              <DrawerTitle className="text-lg font-black text-foreground dark:text-white">
                Send as Gift
              </DrawerTitle>
            </div>
          </DrawerHeader>

          {!sent ? (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-xl border-2 border-border bg-muted/40 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted dark:bg-white/5">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground dark:text-white">{product.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.brand?.name ?? "—"} - ${Number(salePrice)}
                  </p>
                </div>
              </div>

              <p className="mb-4 text-xs text-muted-foreground">
                Use your points balance to buy this item and generate a shareable
                link or QR code for a friend to claim.
              </p>

              <button
                onClick={handleSend}
                className="btn-primary-glow flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-brand-primary py-4 text-sm font-black uppercase tracking-wider text-white transition-all active:scale-[0.98]"
              >
                <Gift className="h-4 w-4" />
                Send Gift ({Number(salePrice) * 10} pts)
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10">
                <CheckCircle2 className="h-8 w-8 text-brand-primary" />
              </div>
              <h4 className="mb-1 text-base font-black text-foreground dark:text-white">
                Gift Ready!
              </h4>
              <p className="mb-6 text-xs text-muted-foreground">
                Share this link with your friend to claim their gift.
              </p>

              <div className="mb-4 flex w-full items-center gap-2 rounded-xl border-2 border-border bg-muted/40 px-3 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs font-mono text-foreground dark:text-white">
                  axelerate.app/gift/a8f3k2...
                </span>
                <button
                  onClick={() => toast.success("Link copied!")}
                  className="shrink-0 rounded-lg border-2 border-border bg-brand-primary px-3 py-1 text-[10px] font-bold text-white"
                >
                  Copy
                </button>
              </div>

              <button className="flex items-center gap-2 rounded-xl border-2 border-border bg-muted/40 px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:text-white">
                <QrCode className="h-4 w-4" />
                Show QR Code
              </button>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type AvailabilityFilter = "all" | "in_stock" | "sold_out" | "low_stock";
type TierAccessFilter = "all" | "unlocked" | "locked";

function FilterChipGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full border-2 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider transition-colors",
            value === opt.value
              ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted dark:border-white/10 dark:bg-white/5"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ShopFiltersDrawer({
  open,
  onOpenChange,
  brandOptions,
  selectedBrandIds,
  onToggleBrand,
  onClearBrands,
  onSelectAllBrands,
  availability,
  onAvailabilityChange,
  tierAccess,
  onTierAccessChange,
  featuredOnly,
  onFeaturedOnlyChange,
  onResetAll,
  activeCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandOptions: { id: string; name: string }[];
  selectedBrandIds: string[];
  onToggleBrand: (id: string) => void;
  onClearBrands: () => void;
  onSelectAllBrands: () => void;
  availability: AvailabilityFilter;
  onAvailabilityChange: (v: AvailabilityFilter) => void;
  tierAccess: TierAccessFilter;
  onTierAccessChange: (v: TierAccessFilter) => void;
  featuredOnly: boolean;
  onFeaturedOnlyChange: (v: boolean) => void;
  onResetAll: () => void;
  activeCount: number;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-muted dark:[&>div:first-child]:bg-white/20">
        <div className="flex max-h-[calc(88vh-2rem)] flex-col px-4 pb-8 pt-2">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3 dark:border-white/10">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-brand-primary" />
              <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-foreground dark:text-white">
                Filters
              </DrawerTitle>
              {activeCount > 0 && (
                <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-primary">
                  {activeCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetAll}
                className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Reset all
              </button>
              <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted dark:border-transparent dark:bg-white/10">
                <X className="h-4 w-4" />
              </DrawerClose>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1 scrollbar-visible">
            <section>
              <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Brand
              </h3>
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={onSelectAllBrands}
                  className="rounded-lg border-2 border-border bg-muted/40 px-2 py-1 font-mono text-[9px] font-bold uppercase text-foreground dark:border-white/10"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={onClearBrands}
                  className="rounded-lg border-2 border-border bg-muted/40 px-2 py-1 font-mono text-[9px] font-bold uppercase text-muted-foreground dark:border-white/10"
                >
                  Clear brands
                </button>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border-2 border-border bg-muted/20 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                {brandOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No brands in catalog</p>
                ) : (
                  brandOptions.map((b) => {
                    const checked = selectedBrandIds.includes(b.id);
                    return (
                      <div key={b.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`shop-brand-${b.id}`}
                          checked={checked}
                          onCheckedChange={() => onToggleBrand(b.id)}
                        />
                        <Label
                          htmlFor={`shop-brand-${b.id}`}
                          className="flex-1 cursor-pointer truncate text-sm font-medium text-foreground dark:text-white"
                        >
                          {b.name}
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Availability
              </h3>
              <FilterChipGroup
                value={availability}
                onChange={onAvailabilityChange}
                options={[
                  { value: "all", label: "All" },
                  { value: "in_stock", label: "In stock" },
                  { value: "sold_out", label: "Sold out" },
                  { value: "low_stock", label: "Low stock" },
                ]}
              />
              <p className="mt-2 text-[10px] text-muted-foreground">
                Low stock: fewer than 15 units left.
              </p>
            </section>

            <section>
              <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Your tier
              </h3>
              <FilterChipGroup
                value={tierAccess}
                onChange={onTierAccessChange}
                options={[
                  { value: "all", label: "All items" },
                  { value: "unlocked", label: "Redeemable now" },
                  { value: "locked", label: "Locked for me" },
                ]}
              />
              <p className="mt-2 text-[10px] text-muted-foreground">
                Based on your current rank vs. each item&apos;s minimum tier.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-3 rounded-xl border-2 border-border bg-muted/20 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <Checkbox
                  id="shop-featured-only"
                  checked={featuredOnly}
                  onCheckedChange={(c) => onFeaturedOnlyChange(c === true)}
                />
                <Label
                  htmlFor="shop-featured-only"
                  className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground dark:text-white"
                >
                  <Star className="h-4 w-4 text-brand-primary" />
                  Featured picks only
                </Label>
              </div>
            </section>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-4 w-full rounded-2xl border-2 border-border bg-brand-primary py-3 font-mono text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-sm dark:border-white/10"
          >
            Show results
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function PerksShop() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<CategoryTab>("All");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [tierAccess, setTierAccess] = useState<TierAccessFilter>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [unlockPopupProduct, setUnlockPopupProduct] = useState<Product | null>(null);
  const [unlockDrawerOpen, setUnlockDrawerOpen] = useState(false);
  const [giftModalProduct, setGiftModalProduct] = useState<Product | null>(null);
  const [giftDrawerOpen, setGiftDrawerOpen] = useState(false);

  const { user, profile, publicProducts, isLoadingPublic, refetchPrivate } =
    useAppDataContext();
  const userTier = profile?.tier ?? "guest";
  const nextTierXp = getNextTierXp(userTier);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const checkoutToastHandled = useRef(false);

  useEffect(() => {
    void isStripePaymentsEnabled().then(setStripeEnabled);
  }, []);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success" && checkout !== "cancelled") return;
    if (checkoutToastHandled.current) return;
    checkoutToastHandled.current = true;
    if (checkout === "success") {
      toast.success("Payment received! Your order is processing.");
      clearCart();
      void refetchPrivate();
    } else {
      toast.message("Card checkout was cancelled.");
    }
    router.replace("/?tab=shop", { scroll: false });
  }, [searchParams, router, refetchPrivate, clearCart]);

  const brandOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of publicProducts) {
      if (!map.has(p.brand_id)) {
        const name = p.brand?.name?.trim() || "Partner brand";
        map.set(p.brand_id, name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [publicProducts]);

  const filteredProducts = useMemo(() => {
    return publicProducts.filter((p) => {
      if (selectedCategory === "Drops") {
        if (!(p.is_drop === true || p.drop_time != null)) return false;
      } else if (selectedCategory !== "All") {
        const cat = (p.category ?? "Beauty").toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }

      if (selectedBrandIds.length > 0 && !selectedBrandIds.includes(p.brand_id)) {
        return false;
      }

      if (availability === "in_stock" && p.stock_count <= 0) return false;
      if (availability === "sold_out" && p.stock_count !== 0) return false;
      if (
        availability === "low_stock" &&
        !(p.stock_count > 0 && p.stock_count < 15)
      ) {
        return false;
      }

      const tierOk = canAccessTier(userTier, p.min_tier_required);
      if (tierAccess === "unlocked" && !tierOk) return false;
      if (tierAccess === "locked" && tierOk) return false;

      if (featuredOnly && p.is_featured !== true) return false;

      return true;
    });
  }, [
    publicProducts,
    selectedCategory,
    selectedBrandIds,
    availability,
    tierAccess,
    featuredOnly,
    userTier,
  ]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selectedBrandIds.length > 0) n += 1;
    if (availability !== "all") n += 1;
    if (tierAccess !== "all") n += 1;
    if (featuredOnly) n += 1;
    return n;
  }, [selectedBrandIds.length, availability, tierAccess, featuredOnly]);

  const resetShopFilters = useCallback(() => {
    setSelectedBrandIds([]);
    setAvailability("all");
    setTierAccess("all");
    setFeaturedOnly(false);
  }, []);

  const toggleBrandFilter = useCallback((id: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const addToCart = (product: Product) => {
    addItem(product, 1);
    toast.success("Added to your stash!", {
      description: product.title,
    });
  };

  const cartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cart = cartItems.map((i) => ({ product: i.product, qty: i.quantity }));

  if (isLoadingPublic) {
    return (
      <div className="pb-4">
        <header className="mb-6 px-1">
          <Skeleton className="mb-1 h-5 w-32" />
          <Skeleton className="mb-1 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </header>
        <Skeleton className="mb-6 h-20 w-full rounded-2xl" />
        <Skeleton className="mb-6 h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-6 px-1">
        <div className="mb-1 flex items-center gap-2">
          <Flame className="h-5 w-5 text-brand-primary" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-primary">
            Exclusive Rewards
          </span>
        </div>
        <h1 className="font-display text-3xl tracking-tight text-foreground dark:text-white">
          Perks Shop
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Earn it. Unlock it. Flex it.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border-2 border-border bg-muted/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your Rank
          </span>
          <TierBadge tier={userTier} size="sm" />
        </div>
        <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-border dark:bg-white/10">
          <div
            className="h-full rounded-full bg-brand-primary transition-all"
            style={{
              width: `${Math.min(100, ((profile?.xp ?? 0) / Math.max(1, nextTierXp)) * 100)}%`,
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{profile?.xp ?? 0} XP</span>
          <span>
            {nextTierXp} XP to {TIER_CONFIG[userTier].label}
          </span>
        </div>
      </div>

      <DropZoneBanner
        products={publicProducts}
        onAddToCart={addToCart}
        userTier={userTier}
      />

      <div className="-mx-5 mb-5 overflow-x-auto px-5 scrollbar-none">
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                selectedCategory === cat
                  ? "border-2 border-border bg-brand-primary text-white shadow-sm"
                  : "border-2 border-transparent bg-muted/60 text-muted-foreground hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10",
                cat === "Drops" &&
                  selectedCategory !== cat &&
                  "border border-brand-primary/30 text-brand-primary"
              )}
            >
              {cat === "Drops" && <Flame className="h-3 w-3" />}
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
            activeFilterCount > 0
              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
              : "border-border bg-muted/60 text-muted-foreground hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1.5 text-[10px] font-black text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
        <p className="font-mono text-[10px] text-muted-foreground">
          {filteredProducts.length} of {publicProducts.length} items
        </p>
      </div>

      <ShopFiltersDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        brandOptions={brandOptions}
        selectedBrandIds={selectedBrandIds}
        onToggleBrand={toggleBrandFilter}
        onClearBrands={() => setSelectedBrandIds([])}
        onSelectAllBrands={() =>
          setSelectedBrandIds(brandOptions.map((b) => b.id))
        }
        availability={availability}
        onAvailabilityChange={setAvailability}
        tierAccess={tierAccess}
        onTierAccessChange={setTierAccess}
        featuredOnly={featuredOnly}
        onFeaturedOnlyChange={setFeaturedOnly}
        onResetAll={resetShopFilters}
        activeCount={activeFilterCount}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product, i) => {
          const accessible = canAccessTier(userTier, product.min_tier_required);
          const isSoldOut = product.stock_count === 0;
          const isDrop = product.is_drop === true || product.drop_time != null;

          const salePrice =
            product.discount_price ??
            product.original_price ??
            product.price_credits;
          const originalPrice = product.original_price ?? product.price_credits;
          const discountPct =
            originalPrice > 0
              ? Math.round(
                  ((originalPrice - Number(salePrice)) / originalPrice) * 100
                )
              : 0;

          return (
            <div
              key={product.id}
              className="animate-slide-up group relative overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm transition-all duration-300 hover:border-brand-primary/30 hover:shadow-md dark:border-white/10 dark:bg-zinc-900/80 dark:hover:shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.1)]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {!accessible && (
                <button
                  onClick={() => {
                    setUnlockPopupProduct(product);
                    setUnlockDrawerOpen(true);
                  }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all hover:bg-black/60"
                >
                  <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-border bg-card px-3 py-2 text-center shadow-lg dark:border-white/10 dark:bg-zinc-900/90">
                    <Lock className="h-5 w-5 text-brand-primary" />
                    <span className="text-[10px] font-bold text-foreground dark:text-white">
                      Tap to Unlock
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {TIER_CONFIG[product.min_tier_required].label} required
                    </span>
                  </div>
                </button>
              )}

              {isDrop && !isSoldOut && (
                <div className="absolute left-2 top-2 z-[5] flex items-center gap-1 rounded-full bg-brand-primary px-2 py-0.5">
                  <Flame className="h-3 w-3 text-white" />
                  <span className="text-[9px] font-black uppercase text-white">
                    Drop
                  </span>
                </div>
              )}

              <Link
                href={"/product/" + product.id}
                className="block"
              >
                <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-t-2xl border-b border-border bg-muted/50 backdrop-blur-sm dark:border-white/5 dark:bg-white/5">
                  {product.stock_count <= 0 && (
                    <div className="absolute left-2 top-2 z-10 rounded px-2 py-1 bg-red-500/90 text-white text-[10px] font-bold tracking-wider backdrop-blur-sm">
                      SOLD OUT
                    </div>
                  )}
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
              </Link>

              <div className="p-3">
                <div className="mb-2 flex flex-wrap gap-1">
                  {discountPct > 0 && (
                    <span className="rounded-md bg-brand-primary/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary">
                      🔥 {discountPct}% OFF
                    </span>
                  )}
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground dark:border-white/10 dark:bg-white/10">
                    STUDENT EXCLUSIVE
                  </span>
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground dark:border-white/10 dark:bg-white/10">
                    LOWEST PRICE GUARANTEED
                  </span>
                </div>

                <h3 className="mb-0.5 text-xs font-bold leading-tight text-foreground dark:text-white">
                  <Link
                    href={"/product/" + product.id}
                    className="transition-colors hover:underline"
                  >
                    {product.title}
                  </Link>
                </h3>
                <p className="mb-2 text-[10px] text-muted-foreground">
                  {product.brand?.name ?? "—"}
                </p>

                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-xl font-black text-brand-primary drop-shadow-[0_0_12px_rgba(var(--theme-primary-rgb),0.5)]">
                    ${Number(salePrice)}
                  </span>
                  {originalPrice > 0 && (
                    <span className="text-sm text-muted-foreground line-through">
                      ${originalPrice}
                    </span>
                  )}
                </div>

                {!isSoldOut && (
                  <div className="mb-2">
                    {product.stock_count < 15 && product.stock_count > 0 ? (
                      <span className="flex items-center gap-1 animate-pulse text-[10px] font-bold text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        Only {product.stock_count} left!
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {product.stock_count} left
                      </span>
                    )}
                  </div>
                )}

                {accessible && !isSoldOut && (
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => addToCart(product)}
                      className="btn-primary-glow flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-brand-primary py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-primary active:scale-[0.95]"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      Add to Cart
                    </button>
                    <button
                      onClick={() => {
                        setGiftModalProduct(product);
                        setGiftDrawerOpen(true);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-transparent py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-all hover:border-brand-primary/30 dark:border-white/10 dark:text-white"
                    >
                      <Gift className="h-3.5 w-3.5" />
                      Gift
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-12 text-center dark:border-white/10">
          <Package className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-bold text-foreground dark:text-white">No items here</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {activeFilterCount > 0
              ? "Nothing matches these filters. Try resetting or broadening brand / tier / stock filters."
              : "Check back later for new drops"}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetShopFilters}
              className="mt-4 rounded-full border-2 border-border bg-muted px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-foreground dark:border-white/10"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Floating Cart Button */}
      <button
        onClick={() => setCartDrawerOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand-primary/30 bg-card shadow-md shadow-[0_0_24px_rgba(var(--theme-primary-rgb),0.2)] transition-all hover:scale-105 active:scale-95 dark:bg-zinc-900"
      >
        <ShoppingBag className="h-6 w-6 text-brand-primary" />
        {cartCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </button>

      <CartDrawer
        cart={cart}
        open={cartDrawerOpen}
        onOpenChange={setCartDrawerOpen}
        onRemove={removeItem}
        onUpdateQuantity={updateQuantity}
        profile={profile ? { cash_balance: profile.cash_balance, credit_balance: profile.credit_balance } : null}
        userId={user?.id ?? null}
        onCheckoutSuccess={clearCart}
        refetchPrivate={refetchPrivate}
        stripeEnabled={stripeEnabled}
      />

      {unlockPopupProduct && (
        <UnlockDrawer
          product={unlockPopupProduct}
          userTier={userTier}
          userId={user?.id}
          open={unlockDrawerOpen}
          onOpenChange={(o) => {
            setUnlockDrawerOpen(o);
            if (!o) setTimeout(() => setUnlockPopupProduct(null), 350);
          }}
          onAddToCart={addToCart}
        />
      )}
      {giftModalProduct && (
        <GiftDrawer
          product={giftModalProduct}
          open={giftDrawerOpen}
          onOpenChange={(o) => {
            setGiftDrawerOpen(o);
            if (!o) setTimeout(() => setGiftModalProduct(null), 350);
          }}
        />
      )}
    </div>
  );
}
