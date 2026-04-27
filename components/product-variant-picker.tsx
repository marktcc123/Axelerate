"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import type { ProductSpecificationsJson, ShopifyVariantSpec } from "@/lib/shopify/product-specifications";
import { findVariantInSpecifications } from "@/lib/shopify/product-specifications";
import {
  buildOptionGroups,
  findVariantByPartialSelection,
  findVariantByTitleLabel,
  optionLayoutClass,
  optionTitleStackLayoutClass,
  titleValueExists,
  valueIsPossible,
  variantInStock,
  type OptionGroup,
} from "@/lib/shopify/variant-ui";
import { cn } from "@/lib/utils";

function getDimValue(v: ShopifyVariantSpec, d: 0 | 1 | 2): string | null {
  const x = d === 0 ? v.option1 : d === 1 ? v.option2 : v.option3;
  if (!x?.trim()) return null;
  return x.trim();
}

/** 参考图：整颗按钮上斜向缺货带 */
function OosDiagonalBand() {
  return (
    <span
      className="pointer-events-none absolute inset-0 z-[1] opacity-80"
      aria-hidden
      style={{
        background:
          "linear-gradient(135deg, transparent 45%, rgba(161, 161, 170, 0.35) 45.5%, rgba(161, 161, 170, 0.35) 46.5%, transparent 47%)",
      }}
    />
  );
}

type Props = {
  spec: ProductSpecificationsJson;
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  /**
   * `storefront`：模仿参考 PDP — 单值选项为「Color: Sage」行内文案；多值 / Style 为全宽纵排、居中、细边未选 / 粗边选中、缺货斜线。
   */
  variant?: "default" | "storefront";
  dark?: boolean;
};

export function ProductVariantPicker({
  spec,
  selectedVariantId,
  onSelectVariant,
  variant = "storefront",
  dark = true,
}: Props) {
  const groups = useMemo(() => buildOptionGroups(spec), [spec]);

  const { inlineLines, choiceGroups } = useMemo(() => {
    const lines: { label: string; value: string }[] = [];
    const choices: OptionGroup[] = [];
    for (const g of groups) {
      if (variant === "storefront" && !g.matchByTitle && g.values.length === 1) {
        lines.push({ label: g.name, value: g.values[0]! });
      } else {
        choices.push(g);
      }
    }
    return { inlineLines: lines, choiceGroups: choices };
  }, [groups, variant]);

  const active = useMemo(
    () => findVariantInSpecifications(spec, selectedVariantId),
    [spec, selectedVariantId]
  );

  const pickByOptions = useCallback(
    (d: 0 | 1 | 2, value: string) => {
      const base = findVariantInSpecifications(spec, selectedVariantId);
      if (!base) {
        onSelectVariant(spec.shopify_variants[0]!.id);
        return;
      }
      const partial: Partial<Record<0 | 1 | 2, string>> = {};
      for (let j = 0; j < 3; j++) {
        if (j === d) (partial as Record<number, string>)[j] = value;
        else {
          const cur = getDimValue(base, j as 0 | 1 | 2);
          if (cur) (partial as Record<number, string>)[j] = cur;
        }
      }
      let next = findVariantByPartialSelection(spec, partial);
      if (!next) {
        const candidates = spec.shopify_variants.filter(
          (va) => getDimValue(va, d) === value.trim()
        );
        const inStock = candidates.find((va) => variantInStock(va));
        next = inStock ?? candidates[0] ?? null;
      } else {
        if (!variantInStock(next)) {
          const withSame = spec.shopify_variants.filter(
            (va) =>
              getDimValue(va, d) === value.trim() &&
              [0, 1, 2].every((j) => {
                if (j === d) return true;
                const want = getDimValue(next!, j as 0 | 1 | 2);
                if (!want) return true;
                return getDimValue(va, j as 0 | 1 | 2) === want;
              })
          );
          const alt = withSame.find((va) => variantInStock(va));
          if (alt) next = alt;
        }
      }
      if (next) onSelectVariant(next.id);
    },
    [onSelectVariant, spec, selectedVariantId]
  );

  const pickByTitle = useCallback(
    (label: string) => {
      const v = findVariantByTitleLabel(spec, label);
      if (v) onSelectVariant(v.id);
    },
    [onSelectVariant, spec]
  );

  if (groups.length === 0) return null;

  const isSf = variant === "storefront";

  return (
    <div className="space-y-5">
      {isSf && inlineLines.length > 0 && (
        <div className="space-y-1.5">
          {inlineLines.map((t) => (
            <p key={t.label} className="text-sm leading-relaxed text-zinc-300">
              <span
                className={cn("font-medium", dark ? "text-zinc-500" : "text-muted-foreground")}
              >
                {t.label}:
              </span>{" "}
              <span className="text-zinc-200">{t.value}</span>
            </p>
          ))}
        </div>
      )}

      {choiceGroups.map((g) => (
        <OptionGroupRow
          key={`${g.dimension}-${g.name}-${g.matchByTitle ? "t" : "o"}`}
          group={g}
          spec={spec}
          active={active}
          dark={dark}
          onPickOptions={(d, v) => pickByOptions(d, v)}
          onPickTitle={pickByTitle}
          storefront={isSf}
        />
      ))}
    </div>
  );
}

function OptionGroupRow({
  group,
  spec,
  active,
  dark,
  onPickOptions,
  onPickTitle,
  storefront,
}: {
  group: OptionGroup;
  spec: ProductSpecificationsJson;
  active: ShopifyVariantSpec | null;
  dark: boolean;
  onPickOptions: (d: 0 | 1 | 2, value: string) => void;
  onPickTitle: (label: string) => void;
  storefront: boolean;
}) {
  const d = group.dimension;
  const refV = active ?? spec.shopify_variants[0] ?? null;
  const selectedVal = active ? getDimValue(active, d) : null;
  const titleMode = group.matchByTitle === true;
  const useStack =
    titleMode || storefront
      ? true
      : group.values.length > 4;
  const layout = useStack
    ? optionTitleStackLayoutClass()
    : optionLayoutClass(group.values.length);
  const { container, item: itemClass } = layout;

  if (!refV) return null;

  const labelClass = cn(
    "mb-2 block text-left text-xs font-medium uppercase tracking-[0.12em]",
    dark ? "text-zinc-500" : "text-muted-foreground"
  );

  const buttonStorefront = (opts: {
    oos: boolean;
    isSelected: boolean;
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={opts.disabled}
      onClick={opts.onClick}
      className={cn(
        "group relative w-full min-h-[52px] overflow-hidden rounded-xl px-4 py-3 text-center text-sm font-medium leading-snug transition-all",
        dark && "bg-zinc-900/50",
        opts.isSelected
          ? "z-0 border-2 border-white text-zinc-100 shadow-sm"
          : "border border-zinc-500/50 text-zinc-300 hover:border-zinc-400",
        opts.oos && "text-zinc-500",
        opts.disabled && !opts.oos && "cursor-not-allowed opacity-30"
      )}
    >
      {opts.oos && <OosDiagonalBand />}
      <span className="relative z-[2]">{opts.children}</span>
    </button>
  );

  if (titleMode) {
    return (
      <div>
        {storefront ? (
          <span className={labelClass}>{group.name}</span>
        ) : (
          <p className={labelClass}>{group.name}</p>
        )}
        <div className={container}>
          {group.values.map((val) => {
            const vMatch = findVariantByTitleLabel(spec, val);
            const oos = vMatch && !variantInStock(vMatch);
            const isSelected = active?.id === vMatch?.id;
            if (storefront) {
              return (
                <div key={val}>
                  {buttonStorefront({
                    oos: !!oos,
                    isSelected,
                    disabled: !titleValueExists(spec, val),
                    onClick: () => onPickTitle(val),
                    children: val,
                  })}
                </div>
              );
            }
            return (
              <button
                key={val}
                type="button"
                disabled={!titleValueExists(spec, val)}
                onClick={() => onPickTitle(val)}
                className={cn(
                  itemClass,
                  "transition-all",
                  dark
                    ? "border-zinc-500 bg-zinc-900/60 text-zinc-100"
                    : "border-zinc-200 bg-white text-zinc-900",
                  isSelected &&
                    (dark
                      ? "ring-2 ring-white border-white"
                      : "ring-2 ring-black border-black"),
                  oos && "opacity-60",
                  oos && "line-through decoration-2"
                )}
                title={oos ? "缺货" : val}
              >
                {val}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {storefront ? (
        <span className={labelClass}>{group.name}</span>
      ) : (
        <p className={labelClass}>{group.name}</p>
      )}
      <div className={storefront && !useStack ? "flex flex-col gap-2" : container}>
        {group.values.map((val) => {
          const possible = valueIsPossible(
            spec,
            {
              0: d === 0 ? val : getDimValue(refV, 0) ?? undefined,
              1: d === 1 ? val : getDimValue(refV, 1) ?? undefined,
              2: d === 2 ? val : getDimValue(refV, 2) ?? undefined,
            },
            d,
            val
          );
          const buildPartial = (): Partial<Record<0 | 1 | 2, string>> => {
            const p: Partial<Record<0 | 1 | 2, string>> = { [d]: val };
            for (let j = 0; j < 3; j++) {
              if (j === d) continue;
              const c = getDimValue(refV, j as 0 | 1 | 2);
              if (c) p[j as 0 | 1 | 2] = c;
            }
            return p;
          };
          const vMatch = findVariantByPartialSelection(spec, buildPartial());
          const oos = vMatch && !variantInStock(vMatch);
          const isSelected = selectedVal === val;
          if (storefront) {
            return (
              <div key={val} className="w-full">
                {buttonStorefront({
                  oos: !!oos,
                  isSelected,
                  disabled: !possible,
                  onClick: () => onPickOptions(d, val),
                  children: val,
                })}
              </div>
            );
          }
          return (
            <button
              key={val}
              type="button"
              disabled={!possible}
              onClick={() => onPickOptions(d, val)}
              className={cn(
                itemClass,
                "transition-all",
                dark
                  ? "border-zinc-600 bg-zinc-900/80 text-zinc-200"
                  : "border-border bg-background text-foreground",
                isSelected &&
                  (dark
                    ? "ring-2 ring-white border-white"
                    : "ring-2 ring-foreground border-foreground"),
                !possible && "cursor-not-allowed opacity-30",
                possible && oos && "opacity-50",
                oos && "line-through decoration-2"
              )}
              title={oos ? "缺货" : possible ? val : "不可选"}
            >
              {val}
            </button>
          );
        })}
      </div>
    </div>
  );
}
