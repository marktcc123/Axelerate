"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { ShoppingCart, Package, Zap, Star, Truck, Lock, BellRing, Check } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Product, ProductReview } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { useAppDataContext } from "@/lib/context/app-data-context";
import { joinWaitlist } from "@/app/actions/shop";
import { buildReviewerBadge, firstNameFromFullName } from "@/lib/schools";
import { ProductVariantPicker } from "@/components/product-variant-picker";
import {
  findVariantInSpecifications,
  getPreferredDefaultVariantId,
  getUnitPriceUsd,
  getVariantInventory,
  parseProductSpecifications,
} from "@/lib/shopify/product-specifications";
import { buildOptionGroups } from "@/lib/shopify/variant-ui";
import { ProductImageLightbox } from "@/components/product-image-lightbox";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={
            i <= full
              ? "fill-amber-400 text-amber-400"
              : i === full + 1 && hasHalf
                ? "fill-amber-400/50 text-amber-400"
                : "text-gray-600"
          }
        />
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isWaitlisting, setIsWaitlisting] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [imageLightboxStartIndex, setImageLightboxStartIndex] = useState(0);

  const addItem = useCartStore((s) => s.addItem);
  const { user, profile } = useAppDataContext();

  const fetchData = useCallback(() => {
    if (!productId) return;

    const supabase = createClient();

    Promise.all([
      supabase
        .from("products")
        .select("*, brand:brands(*)")
        .eq("id", productId)
        .single(),
      supabase
        .from("product_reviews")
        .select("*, profile:profiles(full_name, avatar_url, campus)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false }),
    ]).then(([productRes, reviewsRes]) => {
      setLoading(false);
      if (productRes.error) {
        setError(productRes.error.message);
        setProduct(null);
        return;
      }
      setProduct(productRes.data as Product);
      const revs = (reviewsRes.data ?? []) as (ProductReview & {
        profile?: {
          full_name: string | null;
          avatar_url: string | null;
          campus?: string | null;
        } | null;
      })[];
      setReviews(
        revs.map((r) => ({
          ...r,
          profile: r.profile ?? undefined,
        }))
      );
    });
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    fetchData();
  }, [productId, fetchData]);

  // 权限校验：仅真实购买过该商品的用户可评论
  useEffect(() => {
    if (!user?.id || !productId) {
      setCanReview(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from("product_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", productId)
      .limit(1)
      .then(({ data }) => {
        setCanReview(!!data && data.length > 0);
      });
  }, [user?.id, productId]);

  // 查询当前用户是否已在等候名单
  useEffect(() => {
    if (!user?.id || !productId) {
      setIsOnWaitlist(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from("product_waitlist")
      .select("id")
      .eq("product_id", productId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsOnWaitlist(!!data);
      });
  }, [user?.id, productId]);

  const spec = useMemo(
    () => parseProductSpecifications(product?.specifications ?? null),
    [product?.specifications]
  );

  useEffect(() => {
    if (!product) return;
    const s = parseProductSpecifications(product.specifications);
    setSelectedVariantId(getPreferredDefaultVariantId(s));
    setQuantity(1);
  }, [product?.id, product?.specifications]);

  /** 有可渲染的选项维度即显示（含仅 title、无 option1/2/3 时的「Style」回退） */
  const showVariantPicker = useMemo(() => {
    if (!spec) return false;
    return buildOptionGroups(spec).length > 0;
  }, [spec]);

  const priceUsd = useMemo(() => {
    if (!product) return 0;
    const fallback = Number(product.discount_price ?? product.original_price ?? 0);
    if (!spec || !selectedVariantId) return fallback;
    return getUnitPriceUsd(spec, selectedVariantId, fallback);
  }, [product, spec, selectedVariantId]);

  const variantInventory = useMemo(() => {
    if (!spec || !selectedVariantId) return null;
    return getVariantInventory(spec, selectedVariantId);
  }, [spec, selectedVariantId]);

  useEffect(() => {
    if (!product) return;
    const max =
      variantInventory != null
        ? Math.max(1, variantInventory)
        : Math.max(1, product.stock_count);
    setQuantity((q) => Math.min(Math.max(1, q), max));
  }, [product?.id, variantInventory, product?.stock_count]);

  const { avgRating, reviewCount } = useMemo(() => {
    if (reviews.length === 0)
      return { avgRating: 0, reviewCount: 0 };
    const sum = reviews.reduce((a, r) => a + r.rating, 0);
    return {
      avgRating: Math.round((sum / reviews.length) * 10) / 10,
      reviewCount: reviews.length,
    };
  }, [reviews]);

  const images = useMemo(() => {
    const imgs = product?.images ?? [];
    if (imgs.length > 0) return imgs;
    if (product?.image_url) return [product.image_url];
    return [];
  }, [product]);

  const mainImage = images[selectedImageIndex] ?? images[0];

  const openImageLightbox = useCallback(
    (index: number) => {
      if (images.length === 0) return;
      const i = Math.max(0, Math.min(index, images.length - 1));
      setImageLightboxStartIndex(i);
      setSelectedImageIndex(i);
      setImageLightboxOpen(true);
    },
    [images.length]
  );

  const mobileSwipeStartRef = useRef({ x: 0, y: 0 });
  const mobileSkipLightboxClickRef = useRef(false);

  const onMobileGalleryTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (images.length <= 1) return;
      const t = e.touches[0];
      mobileSwipeStartRef.current = { x: t.clientX, y: t.clientY };
    },
    [images.length]
  );

  const onMobileGalleryTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (images.length <= 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - mobileSwipeStartRef.current.x;
      const dy = t.clientY - mobileSwipeStartRef.current.y;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.1) return;
      if (dx < 0) {
        setSelectedImageIndex((i) => (i + 1) % images.length);
      } else {
        setSelectedImageIndex(
          (i) => (i - 1 + images.length) % images.length
        );
      }
      mobileSkipLightboxClickRef.current = true;
      window.setTimeout(() => {
        mobileSkipLightboxClickRef.current = false;
      }, 400);
    },
    [images.length]
  );

  const handleAddToCart = () => {
    if (!product) return;
    const v =
      selectedVariantId ||
      (spec ? getPreferredDefaultVariantId(spec) : null);
    const vLabel =
      v && spec ? findVariantInSpecifications(spec, v)?.title?.trim() || null : null;
    addItem(product, quantity, {
      shopifyVariantId: v,
      variantLabel: vLabel,
    });
    toast.success("Added to cart!", { description: product.title });
  };

  const handleJoinWaitlist = async () => {
    if (!productId || isWaitlisting) return;
    if (!user?.id) {
      toast.error("Please log in first.");
      return;
    }
    setIsWaitlisting(true);
    const result = await joinWaitlist(productId);
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

  const handleSubmitReview = async () => {
    if (rating === 0 || !comment.trim()) return;

    // 从 useAppDataContext 获取当前登录用户，需确保 Auth 已正确配置
    const currentUserId = user?.id;
    if (!currentUserId) {
      toast.error("Please sign in to submit a review");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const badge = buildReviewerBadge(profile?.full_name ?? null, profile?.campus ?? null);

    const { error } = await supabase.from("product_reviews").insert({
      product_id: productId,
      user_id: currentUserId,
      rating,
      comment: comment.trim(),
      reviewer_badge: badge,
    });

    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setRating(0);
    setHoverRating(0);
    setComment("");
    toast.success("Review submitted successfully!");
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-4 text-white md:p-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="min-h-[min(70vh,420px)] md:hidden">
            <div className="h-full animate-pulse rounded-2xl border border-white/5 bg-white/5" />
          </div>
          <div className="hidden grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border border-white/5 md:grid">
            <div className="aspect-[4/5] animate-pulse bg-white/5" />
            <div className="aspect-[4/5] animate-pulse bg-white/5" />
            <div className="aspect-[4/5] animate-pulse bg-white/5" />
            <div className="aspect-[4/5] animate-pulse bg-white/5" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-10 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="h-7 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-px w-full bg-white/10" />
            <div className="h-32 w-full animate-pulse rounded-xl bg-white/5" />
            <div className="h-12 w-full max-w-sm animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-black text-white p-4 md:p-8">
        <div className="max-w-6xl mx-auto text-center py-16">
          <h1 className="text-2xl font-black text-white mb-4">
            Product not found
          </h1>
          <p className="text-gray-400 mb-6">
            {error ?? "This product may have been removed."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--theme-primary)] px-6 py-3 font-bold text-white hover:opacity-90 transition-opacity"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const category = product.category ?? "Product";
  const brandLink =
    product.brand_link_url ?? (product.brand ? "/" : undefined);
  const rawSpec = product.specifications;
  const specTableEntries: [string, string][] =
    !rawSpec || typeof rawSpec !== "object" || Array.isArray(rawSpec)
      ? []
      : Object.entries(rawSpec as Record<string, unknown>)
          .filter(([k]) => k !== "shopify_variants" && k !== "shopify_options")
          .map(([k, v]) => {
            if (v == null) return [k, "—"] as [string, string];
            if (typeof v === "object") return [k, JSON.stringify(v)] as [string, string];
            return [k, String(v)] as [string, string];
          });
  const maxQty =
    variantInventory != null
      ? Math.max(1, variantInventory)
      : Math.max(1, product.stock_count);
  const isSoldOut =
    variantInventory != null ? variantInventory <= 0 : product.stock_count <= 0;
  const features = product.features ?? [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Breadcrumbs */}
        <nav className="text-sm text-gray-400 mb-6">
          <Link
            href="/feed"
            className="hover:text-[var(--theme-primary)] transition-colors hover:underline"
          >
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/shop"
            className="hover:text-[var(--theme-primary)] transition-colors hover:underline"
          >
            Shop
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-400">{category}</span>
          <span className="mx-2">/</span>
          <span className="text-gray-200 truncate max-w-[200px] inline-block align-bottom">
            {product.title}
          </span>
        </nav>

        {/* 左：手机单图+圆点；桌面两列网格栅格（与参考图一致） */}
        <div className="grid max-w-7xl mx-auto grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="w-full min-w-0">
            {/* 手机 & 小屏：主图 + 圆点切图 */}
            <div className="md:hidden">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c]">
                <div
                  className="relative flex min-h-[min(70vw,360px)] w-full touch-pan-y select-none items-center justify-center p-4"
                  onTouchStart={onMobileGalleryTouchStart}
                  onTouchEnd={onMobileGalleryTouchEnd}
                >
                  <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/80 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
                    STUDENT EXCLUSIVE
                  </div>
                  {mainImage ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (mobileSkipLightboxClickRef.current) return;
                        openImageLightbox(selectedImageIndex);
                      }}
                      className="group relative flex w-full max-w-full cursor-zoom-in items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                      aria-label="View larger image"
                    >
                      <img
                        src={mainImage}
                        alt={product.title}
                        className="max-h-[min(64vh,480px)] w-full max-w-full object-contain transition-opacity group-active:opacity-90"
                      />
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Package className="h-16 w-16" />
                      <span className="text-sm">No image</span>
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="flex justify-center gap-1.5 border-t border-white/10 py-3">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`View image ${i + 1}`}
                        onClick={() => setSelectedImageIndex(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          selectedImageIndex === i
                            ? "w-6 bg-zinc-200"
                            : "w-1.5 bg-zinc-600"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 桌面：两列图库，可向下延伸滚动 */}
            <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] md:block">
              {images.length === 0 ? (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-zinc-500">
                  <Package className="h-16 w-16" />
                  <span className="text-sm">No image</span>
                </div>
              ) : (
                <div
                  className={cn(
                    "grid gap-0.5",
                    images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  )}
                >
                  {images.map((url, i) => (
                    <div
                      key={`${url}-${i}`}
                      className="relative aspect-[3/4] min-h-[180px] w-full overflow-hidden bg-[#111] lg:min-h-[220px] lg:aspect-[4/5]"
                    >
                      {i === 0 && (
                        <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-white/10 bg-black/75 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
                          STUDENT EXCLUSIVE
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => openImageLightbox(i)}
                        className="group relative h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
                        aria-label={`View image ${i + 1} larger`}
                      >
                        <img
                          src={url}
                          alt={i === 0 ? product.title : `Product image ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] group-active:scale-100"
                          sizes="(min-width: 1024px) 40vw, 100vw"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右：产品信息与购买（单列自上而下，与参考图一致） */}
          <div className="flex w-full min-w-0 flex-col lg:sticky lg:top-4 lg:max-w-lg lg:justify-self-end">
            {product.brand && (
              <Link
                href={brandLink ?? "/"}
                className="mb-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200 hover:underline"
              >
                Visit the {product.brand.name} Store
              </Link>
            )}

            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              {product.title}
            </h1>
            <p className="mt-2 text-lg font-normal tabular-nums text-zinc-400">
              ${Number(priceUsd).toFixed(2)}
            </p>
            {product.price_credits > 0 && (
              <p className="mt-1 text-sm text-amber-400/90">
                <Zap size={14} className="mr-0.5 inline fill-amber-400" />
                Or redeem for {product.price_credits} Pts
              </p>
            )}

            <hr className="my-5 border-0 border-t border-white/10" />

            {showVariantPicker && spec && selectedVariantId && (
              <div className="mb-5">
                <ProductVariantPicker
                  spec={spec}
                  selectedVariantId={selectedVariantId}
                  onSelectVariant={(id) => setSelectedVariantId(id)}
                  variant="storefront"
                />
              </div>
            )}

            {(() => {
              const stockMsg =
                variantInventory != null ? variantInventory : product.stock_count;
              return (
                <>
                  {!isSoldOut && stockMsg > 0 && stockMsg < 15 && (
                    <p className="mb-3 text-sm font-medium text-rose-400/95">
                      Only {stockMsg} left in stock
                    </p>
                  )}
                  {isSoldOut && (
                    <p className="mb-3 text-sm font-medium text-rose-400/90">Out of stock</p>
                  )}
                </>
              );
            })()}

            <p className="mb-5 flex items-center gap-1.5 text-sm text-emerald-400/90">
              <Truck className="h-4 w-4 shrink-0" />
              FREE Delivery for Axelerate Partners
            </p>

            <div className="mb-4 flex max-w-sm flex-wrap items-center gap-3">
              <span className="text-sm text-zinc-500">Quantity</span>
              <div className="inline-flex items-center overflow-hidden rounded-lg border border-white/10 bg-zinc-900/80">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  −
                </button>
                <span className="min-w-[2.5rem] px-1 py-2 text-center text-sm font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                  className="px-3 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  +
                </button>
              </div>
            </div>

            {!isSoldOut ? (
              <button
                type="button"
                onClick={handleAddToCart}
                className="mb-3 w-full max-w-sm rounded-xl bg-[var(--theme-primary)] py-3.5 text-sm font-bold uppercase tracking-wide text-black transition-opacity hover:opacity-90"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Add to cart
                </span>
              </button>
            ) : (
              <div className="mb-3 flex w-full max-w-sm flex-col gap-2">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-zinc-600 bg-zinc-800 py-3.5 text-sm font-bold uppercase tracking-wide text-zinc-300"
                >
                  Sold out
                </button>
                {isOnWaitlist ? (
                  <p className="flex items-center justify-center gap-1.5 text-sm text-emerald-400/90">
                    <Check className="h-4 w-4" /> You&apos;re on the waitlist
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleJoinWaitlist}
                    disabled={isWaitlisting}
                    className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <BellRing className="h-4 w-4" />
                      {isWaitlisting ? "Adding…" : "Notify me when available"}
                    </span>
                  </button>
                )}
              </div>
            )}

            <p className="mb-8 text-center text-xs text-zinc-500 sm:text-left">
              Lowest price guaranteed for Axelerate students.
            </p>

            {(reviewCount > 0 || avgRating > 0) && (
              <div className="mb-4 flex items-center gap-2">
                <StarRating rating={avgRating} />
                <span className="text-sm text-zinc-500">
                  {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
                </span>
              </div>
            )}

            {product.description && (
              <p className="mb-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                {product.description}
              </p>
            )}

            {features.length > 0 && (
              <ul className="mb-6 space-y-2 text-sm text-zinc-300 sm:text-base">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--theme-primary)]">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {product.long_description_html && (
              <div
                className={cn(
                  "prose prose-invert max-w-none border-t border-white/5 pt-6 text-zinc-300",
                  "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-white",
                  "prose-h1:text-2xl md:prose-h1:text-3xl prose-h1:mb-3 prose-h1:mt-0 prose-h1:font-bold",
                  "prose-h2:text-base md:prose-h2:text-lg prose-h2:mb-2 prose-h2:mt-8 prose-h2:font-semibold prose-h2:text-zinc-100",
                  "prose-h3:text-sm prose-h3:font-semibold prose-h3:text-zinc-200",
                  "prose-p:text-sm md:prose-p:text-base prose-p:leading-relaxed prose-p:text-zinc-400",
                  "prose-strong:font-semibold prose-strong:text-zinc-200 prose-li:text-sm md:prose-li:text-base",
                  "[&_ul]:list-disc [&_ul]:pl-4 [&_li]:marker:text-zinc-600",
                  "[&_img]:max-w-full [&_img]:rounded-lg"
                )}
                dangerouslySetInnerHTML={{
                  __html: product.long_description_html,
                }}
              />
            )}
          </div>
        </div>

        {/* Bottom: Specs & Reviews (另起一行) */}
        <div className="mt-16 w-full space-y-12">
          {/* Specifications */}
          {specTableEntries.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                Technical Specifications
              </h2>
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {specTableEntries.map(([key, value]) => (
                      <tr
                        key={key}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="py-3 px-4 text-gray-400 font-medium w-1/3">
                          {key}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Customer Reviews */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">
              Customer Reviews
            </h2>

            {/* Write a Review Section - 仅真实购买用户可见 */}
            {canReview ? (
              <div className="mb-8 rounded-xl border border-white/10 bg-[#111] p-6">
                <h3 className="mb-4 text-xl font-bold text-white">
                  Write a Review
                </h3>

                <div className="mb-4">
                  <span className="mb-2 block text-sm text-gray-400">
                    Your rating
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating || rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="transition-colors"
                        >
                          <Star
                            size={24}
                            className={
                              active
                                ? "fill-amber-400 text-amber-400"
                                : "text-gray-600"
                            }
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What do you think about this product? Share your experience with other students..."
                    className="min-h-[100px] w-full rounded-lg border border-white/10 bg-[#0a0a0a] p-3 text-white placeholder:text-gray-500 focus:border-[var(--theme-primary)] focus:outline-none"
                    rows={4}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSubmitReview}
                    disabled={
                      rating === 0 ||
                      !comment.trim() ||
                      isSubmitting
                    }
                    className="rounded-lg bg-[var(--theme-primary)] px-6 py-2.5 font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-8 flex items-center gap-4 rounded-xl border border-white/5 bg-[#111] p-6">
                <div className="rounded-full bg-gray-800/50 p-3 text-gray-400">
                  <Lock size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white">
                    Verified Buyers Only
                  </h4>
                  <p className="mt-1 text-sm text-gray-500">
                    You must purchase this item to leave a review. Your voice
                    matters when it&apos;s backed by real experience.
                  </p>
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No reviews yet. Be the first to review!
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10 flex items-center justify-center">
                        {r.profile?.avatar_url ? (
                          <img
                            src={r.profile.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-gray-400">
                            {(r.profile?.full_name ?? "U").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">
                            {r.reviewer_badge?.trim() ||
                              buildReviewerBadge(
                                r.profile?.full_name,
                                r.profile?.campus ?? null
                              ) ||
                              firstNameFromFullName(r.profile?.full_name)}
                          </span>
                          <StarRating rating={r.rating} />
                          <span className="text-xs text-gray-500">
                            {r.created_at && formatDate(r.created_at)}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="text-sm text-gray-300">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {images.length > 0 && (
        <ProductImageLightbox
          open={imageLightboxOpen}
          onOpenChange={setImageLightboxOpen}
          images={images}
          startIndex={imageLightboxStartIndex}
          productTitle={product.title}
        />
      )}
    </div>
  );
}
