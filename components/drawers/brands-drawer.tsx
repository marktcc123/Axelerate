"use client";

import { X, Briefcase, ArrowUpRight } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import type { Brand, Gig } from "@/lib/types";

interface BrandsDrawerProps {
  brands: Brand[];
  gigs: Gig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrandClick: (brand: Brand) => void;
}

export function BrandsDrawer({
  brands,
  gigs,
  open,
  onOpenChange,
  onBrandClick,
}: BrandsDrawerProps) {
  const getActiveGigsCount = (brandId: string) =>
    gigs.filter((g) => g.brand_id === brandId && g.status === "active").length;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] border-t-2 border-border bg-card text-card-foreground dark:border-white/10 dark:bg-zinc-950 [&>div:first-child]:bg-border dark:[&>div:first-child]:bg-white/20">
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between border-b border-border py-3 dark:border-white/10">
            <DrawerTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Partner Brands
            </DrawerTitle>
            <DrawerClose className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-foreground shadow-sm dark:border-transparent dark:bg-white/10">
              <X className="h-4 w-4" />
            </DrawerClose>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {brands.map((brand) => {
              const activeGigsCount = getActiveGigsCount(brand.id);
              return (
                <div
                  key={brand.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onBrandClick(brand);
                    onOpenChange(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onBrandClick(brand);
                      onOpenChange(false);
                    }
                  }}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm transition-all hover:border-[var(--theme-primary)]/50 hover:shadow-md dark:border-white/10 dark:bg-zinc-950 dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                >
                  {/* 1. 品牌顶部横幅 (Banner) */}
                  <div className="relative h-16 w-full border-b border-border bg-gradient-to-r from-muted via-background to-muted dark:from-gray-900 dark:via-black dark:to-gray-900 dark:border-white/5" />

                  {/* 2. 品牌主体信息区 */}
                  <div className="relative flex flex-1 flex-col p-5 pt-0">
                    {/* 悬浮 Logo (向上偏移，跨越 Banner 和主体) */}
                    <div className="relative z-10 -mt-7 mb-3 h-14 w-14 overflow-hidden rounded-full border-4 border-card bg-background shadow-lg dark:border-zinc-950 dark:bg-black">
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-black text-foreground dark:bg-zinc-800 dark:text-white">
                          {initials(brand.name)}
                        </div>
                      )}
                    </div>

                    {/* 品牌名称与分类标签 */}
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="text-lg font-black text-foreground transition-colors group-hover:text-[var(--theme-primary)] dark:text-white">
                        {brand.name}
                      </h3>
                      {brand.category && (
                        <span className="rounded border-2 border-border bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:border-white/10 dark:bg-white/5">
                          {brand.category}
                        </span>
                      )}
                    </div>

                    {/* 品牌详细介绍 (最多显示两行，超出省略) */}
                    <p className="mb-4 flex-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {brand.description ||
                        "Exclusive partner brand on Axelerate. Explore student-only deals and high-reward gigs."}
                    </p>

                    {/* 底部数据展示与行动点 */}
                    <div className="mt-auto flex items-center justify-between border-t border-border pt-4 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 rounded-md bg-[var(--theme-primary)]/10 px-2.5 py-1 text-xs font-bold text-[var(--theme-primary)]">
                          <Briefcase size={12} /> {activeGigsCount} Active Gigs
                        </span>
                      </div>
                      <ArrowUpRight
                        size={18}
                        className="text-muted-foreground transition-colors group-hover:text-[var(--theme-primary)]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
