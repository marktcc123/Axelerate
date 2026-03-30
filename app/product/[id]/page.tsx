"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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

  const priceUsd = product?.discount_price ?? product?.original_price ?? 0;

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

  const handleAddToCart = () => {
    if (!product) return;
    addItem(product, quantity);
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
      <div className="min-h-screen bg-black text-white p-4 md:p-8">
        <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
          <div className="w-full md:w-2/5 bg-[#111] border border-white/5 rounded-2xl h-[400px] animate-pulse" />
          <div className="w-full md:w-2/5 flex flex-col gap-4">
            <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
            <div className="h-12 w-full bg-white/10 rounded animate-pulse" />
            <div className="h-12 w-32 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="w-full md:w-1/5 h-64 bg-white/5 rounded-xl animate-pulse" />
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

  const maxQty = Math.max(1, product.stock_count);
  const isSoldOut = product.stock_count <= 0;
  const category = product.category ?? "Product";
  const brandLink =
    product.brand_link_url ?? (product.brand ? "/" : undefined);
  const specs = (product.specifications ?? {}) as Record<string, string>;
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

        {/* Three-column layout */}
        <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
          {/* Left: Media Gallery (md:w-2/5) - 解决拥挤：增大主图区、留白 */}
          <div className="w-full md:w-2/5 shrink-0">
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#111]">
              <div className="relative flex min-h-[320px] w-full items-center justify-center p-6 md:min-h-[400px]">
                <div className="absolute top-4 right-4 z-10 rounded-full border border-white/10 bg-black px-3 py-1 text-xs font-bold text-white">
                  STUDENT EXCLUSIVE
                </div>
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={product.title}
                    className="max-h-[360px] max-w-full object-contain md:max-h-[420px]"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Package className="h-16 w-16" />
                    <span className="text-sm">No image</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-4 scrollbar-none">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImageIndex(i)}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                        selectedImageIndex === i
                          ? "border-[var(--theme-primary)]"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Middle: Core Content (md:w-2/5) */}
          <div className="w-full min-w-0 md:w-2/5 flex flex-col">
            {product.brand && (
              <Link
                href={brandLink ?? "/"}
                className="text-blue-400 hover:text-blue-300 text-sm font-medium mb-2 transition-colors hover:underline"
              >
                Visit the {product.brand.name} Store
              </Link>
            )}

            <h1 className="text-3xl font-black text-white mb-3 leading-tight">
              {product.title}
            </h1>

            {/* Rating */}
            {(reviewCount > 0 || avgRating > 0) && (
              <div className="flex items-center gap-2 mb-4">
                <StarRating rating={avgRating} />
                <span className="text-sm text-gray-400">
                  {avgRating.toFixed(1)} ({reviewCount} review
                  {reviewCount !== 1 ? "s" : ""})
                </span>
              </div>
            )}

            {/* Short description */}
            {product.description && (
              <p className="mb-4 text-sm leading-relaxed text-gray-400">
                {product.description}
              </p>
            )}

            {/* Bullet Points */}
            {features.length > 0 && (
              <ul className="space-y-2 mb-6 text-sm text-gray-300">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[var(--theme-primary)]">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {/* Long description HTML (A+ content) */}
            {product.long_description_html && (
              <div
                className="prose prose-invert prose-sm max-w-none text-gray-300 [&_img]:max-w-full [&_img]:rounded-lg"
                dangerouslySetInnerHTML={{
                  __html: product.long_description_html,
                }}
              />
            )}

          </div>

          {/* Right: Super Buy Box (md:w-1/5) */}
          <div className="w-full shrink-0 md:w-1/5">
            <div className="sticky top-4 rounded-xl border border-white/10 bg-[#0a0a0a] p-5">
              <div className="text-3xl font-black text-emerald-400 mb-1">
                ${Number(priceUsd).toFixed(2)}
              </div>
              <div className="text-amber-400 text-sm font-bold flex items-center gap-1 mb-4">
                <Zap size={14} className="fill-amber-400" /> Or redeem for{" "}
                {product.price_credits} Pts
              </div>

              {product.stock_count > 0 && product.stock_count < 15 && (
                <div className="text-red-400 font-bold text-sm mb-3">
                  Only {product.stock_count} left in stock - order soon.
                </div>
              )}
              {product.stock_count === 0 && (
                <div className="text-red-400 font-bold text-sm mb-3">
                  Currently out of stock.
                </div>
              )}

              <div className="text-emerald-400/90 text-sm flex items-center gap-1.5 mb-4">
                <Truck size={14} />
                FREE Delivery for Axelerate Partners
              </div>

              {/* Quantity */}
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-400">Quantity:</span>
                <div className="flex items-center rounded-lg border border-white/10 bg-[#111]">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-1 font-bold">{quantity}</span>
                  <button
                    onClick={() =>
                      setQuantity(Math.min(maxQty, quantity + 1))
                    }
                    className="px-3 py-1 text-gray-400 hover:text-white transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {!isSoldOut ? (
                <button
                  onClick={handleAddToCart}
                  className="w-full font-black py-3 rounded-lg flex justify-center items-center gap-2 transition-all bg-[var(--theme-primary)] text-black hover:opacity-90"
                >
                  <ShoppingCart size={18} /> ADD TO CART
                </button>
              ) : isOnWaitlist ? (
                <button
                  disabled
                  className="w-full font-black py-3 rounded-lg flex justify-center items-center gap-2 bg-zinc-800 text-emerald-400 border border-emerald-900/50 cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  YOU&apos;RE ON THE LIST
                </button>
              ) : (
                <button
                  onClick={handleJoinWaitlist}
                  disabled={isWaitlisting}
                  className="w-full font-black py-3 rounded-lg flex justify-center items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600 transition-all disabled:opacity-60"
                >
                  <BellRing className="w-4 h-4" />
                  {isWaitlisting ? "ADDING..." : "NOTIFY ME WHEN AVAILABLE"}
                </button>
              )}
              <p className="text-xs text-center text-gray-500 mt-3">
                Lowest Price Guaranteed for Axelerate Students.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Specs & Reviews (另起一行) */}
        <div className="mt-16 w-full space-y-12">
          {/* Specifications */}
          {Object.keys(specs).length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                Technical Specifications
              </h2>
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(specs).map(([key, value]) => (
                      <tr
                        key={key}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="py-3 px-4 text-gray-400 font-medium w-1/3">
                          {key}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {typeof value === "string" ? value : String(value)}
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
    </div>
  );
}
