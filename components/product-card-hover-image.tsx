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
  /** 多图时悬停自动切换间隔（ms） */
  intervalMs?: number;
  /** 若为 boolean：由父级（如仅在图片区域的 hover）驱动轮播与缩放；不传则沿用层内鼠标进入/离开 */
  interactionActive?: boolean;
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
  interactionActive,
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

  const controlled = interactionActive !== undefined;

  useEffect(() => {
    if (!controlled) return;
    clearTimer();
    if (!interactionActive || urls.length <= 1) {
      setIdx(0);
      return;
    }
    setIdx(0);
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % urls.length);
    }, intervalMs);
    return clearTimer;
  }, [controlled, interactionActive, urls.length, intervalMs, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const idlePointerHandlers = controlled
    ? {}
    : { onMouseEnter: onEnter, onMouseLeave: onLeave };

  const imgZoomClass =
    controlled ? (interactionActive ? "scale-110" : "") : "group-hover:scale-110";

  if (urls.length === 0) {
    return (
      <div
        className={cn("relative h-full min-h-[9rem] w-full overflow-hidden", className)}
        {...idlePointerHandlers}
      >
        <div className="flex h-full w-full items-center justify-center bg-muted dark:bg-zinc-800">
          <Package className="h-10 w-10 text-muted-foreground" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full min-h-0 w-full overflow-hidden", className)} {...idlePointerHandlers}>
      <img
        src={urls[idx] ?? urls[0]}
        alt={product.title}
        className={cn(
          "absolute inset-0 size-full object-cover transition-transform duration-500 ease-out will-change-transform",
          imgZoomClass || undefined,
          imgClassName
        )}
        draggable={false}
      />
      {children}
    </div>
  );
}
