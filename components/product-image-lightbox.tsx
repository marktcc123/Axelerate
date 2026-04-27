"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  /** 打开时显示的索引 */
  startIndex: number;
  productTitle: string;
};

export function ProductImageLightbox({
  open,
  onOpenChange,
  images,
  startIndex,
  productTitle,
}: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      const i = Math.max(0, Math.min(startIndex, images.length - 1));
      setIndex(Number.isFinite(i) ? i : 0);
    }
  }, [open, startIndex, images.length]);

  const go = useCallback(
    (delta: number) => {
      if (images.length === 0) return;
      setIndex((i) => {
        const n = images.length;
        return (i + delta + n) % n;
      });
    },
    [images.length]
  );

  useEffect(() => {
    if (!open || images.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length, go]);

  const src = images[index];
  const hasNav = images.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "fixed inset-0 left-0 top-0 z-[100] flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-0 overflow-hidden rounded-none border-0 bg-black/95 p-0 shadow-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "[&>button]:z-[120] [&>button]:inline-flex [&>button]:h-10 [&>button]:w-10 [&>button]:shrink-0 [&>button]:items-center [&>button]:justify-center [&>button]:p-0 [&>button]:leading-none [&>button]:rounded-full [&>button]:border-0 [&>button]:bg-white/10 [&>button]:text-zinc-100 [&>button]:hover:bg-white/20"
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {productTitle} — Image {index + 1} of {images.length || 1}
        </DialogTitle>

        <div className="relative flex h-full w-full flex-1 items-center justify-center px-4 pb-16 pt-14 sm:px-12">
          {src ? (
            <img
              src={src}
              alt={`${productTitle} — ${index + 1}`}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          ) : null}

          {hasNav && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:left-4 sm:h-12 sm:w-12"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:right-4 sm:h-12 sm:w-12"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
            </>
          )}
        </div>

        {hasNav && (
          <div className="absolute bottom-6 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium tabular-nums text-zinc-300">
              {index + 1} / {images.length}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
