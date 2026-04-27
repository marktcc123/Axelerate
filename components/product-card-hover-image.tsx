"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

function galleryUrls(product: Product): string[] {
  const raw = (product.images ?? []).filter(
    (u): u is string => typeof u === "string" && u.length > 0
  );
  const list =
    raw.length > 0
      ? raw
      : product.image_url
        ? [product.image_url]
        : [];
  return [...new Set(list)];
}

type Props = {
  product: Product;
  className?: string;
  imgClassName?: string;
  /** 多图时悬停自动切换间隔，默认 1.4s */
  intervalMs?: number;
  children?: React.ReactNode;
};

/**
 * 商品卡主图：多图时鼠标悬停区域自动轮播，离开时回到首张。
 */
export function ProductCardHoverImage({
  product,
  className,
  imgClassName = "h-full w-full object-cover",
  intervalMs = 800,
  children,
}: Props) {
  const urls = useMemo(
    () => galleryUrls(product),
    [product.id, product.image_url, product.images]
  );
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    clearTimer();
    if (urls.length <= 1) return;
    setIdx(0);
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % urls.length);
    }, intervalMs);
  }, [urls.length, intervalMs, clearTimer]);

  const onLeave = useCallback(() => {
    clearTimer();
    setIdx(0);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  if (urls.length === 0) {
    return (
      <div
        className={cn("relative overflow-hidden", className)}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div className="flex h-full w-full items-center justify-center bg-muted dark:bg-zinc-800">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <img
        src={urls[idx] ?? urls[0]}
        alt={product.title}
        className={cn(
          "object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-110",
          imgClassName
        )}
        draggable={false}
      />
      {children}
    </div>
  );
}
