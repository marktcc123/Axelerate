import type { ProductSpecificationsJson, ShopifyVariantSpec } from "@/lib/shopify/product-specifications";

export type OptionGroup = {
  /** 0-based index in option1/2/3；matchByTitle 时仍占位为 0 */
  dimension: 0 | 1 | 2;
  name: string;
  values: string[];
  /**
   * 为 true 时 `values` 与 `variant.title` 对应（无 option1/2/3 时的回退，对齐参考图「Style」纵向 SKU）
   */
  matchByTitle?: boolean;
};

function uniqueOrderPreserving(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * 从 specifications 生成用于 UI 的选项维度；无元数据时从变体 option1/2/3 推导。
 */
export function buildOptionGroups(spec: ProductSpecificationsJson | null): OptionGroup[] {
  if (!spec?.shopify_variants.length) return [];

  const fromMeta = spec.shopify_options;
  if (fromMeta?.length) {
    return [...fromMeta]
      .map((o) => {
        const p = o.position;
        const dim = (p >= 1 && p <= 3 ? p - 1 : 0) as 0 | 1 | 2;
        return { dimension: dim, name: o.name, values: [...o.values] };
      })
      .sort((a, b) => a.dimension - b.dimension);
  }

  const dims: OptionGroup[] = [];
  for (let d = 0; d < 3; d++) {
    const key = d === 0 ? "option1" : d === 1 ? "option2" : "option3";
    const collected: string[] = [];
    for (const v of spec.shopify_variants) {
      const raw = v[key as keyof ShopifyVariantSpec];
      if (typeof raw === "string" && raw.trim()) collected.push(raw);
    }
    const values = uniqueOrderPreserving(collected);
    if (values.length === 0) continue;
    dims.push({
      dimension: d as 0 | 1 | 2,
      name: d === 0 ? "Option" : `Option ${d + 1}`,
      values,
    });
  }
  if (dims.length > 0) return dims;

  // Admin 仅同步了变体、未写入 option1/2/3 时：用 variant.title 作为可选 SKU 文案（如 Washcloth (Set of 2)）
  if (spec.shopify_variants.length > 1) {
    const titles = uniqueOrderPreserving(
      spec.shopify_variants.map((v, i) => {
        const t = v.title?.trim();
        if (t) return t;
        return `Option ${i + 1}`;
      })
    );
    if (titles.length > 0) {
      return [
        {
          dimension: 0,
          name: "Style",
          values: titles,
          matchByTitle: true,
        },
      ];
    }
  }
  return [];
}

function variantOptions(v: ShopifyVariantSpec): [string | null, string | null, string | null] {
  return [v.option1, v.option2, v.option3];
}

export function findVariantByTitleLabel(
  spec: ProductSpecificationsJson,
  titleLabel: string
): ShopifyVariantSpec | null {
  const t = titleLabel.trim();
  const byTitle = spec.shopify_variants.find((va) => (va.title?.trim() || "") === t);
  if (byTitle) return byTitle;
  const m = /^Option\s*(\d+)$/i.exec(t);
  if (m) {
    const idx = Number.parseInt(m[1]!, 10) - 1;
    if (idx >= 0 && idx < spec.shopify_variants.length) {
      return spec.shopify_variants[idx] ?? null;
    }
  }
  return null;
}

export function findVariantByPartialSelection(
  spec: ProductSpecificationsJson,
  selection: Partial<Record<0 | 1 | 2, string>>
): ShopifyVariantSpec | null {
  const variants = spec.shopify_variants;
  if (!variants.length) return null;

  const match = variants.find((va) => {
    const opts = variantOptions(va);
    for (let d = 0; d < 3; d++) {
      const chosen = selection[d as 0 | 1 | 2];
      if (chosen === undefined) continue;
      const cell = opts[d];
      if (!cell || cell.trim() !== chosen.trim()) return false;
    }
    return true;
  });
  return match ?? null;
}

/** 某维度下，在给定其它维度选择时，某值是否对应至少一个变体（不要求有货）。 */
export function valueIsPossible(
  spec: ProductSpecificationsJson,
  selection: Partial<Record<0 | 1 | 2, string>>,
  dimension: 0 | 1 | 2,
  value: string
): boolean {
  const partial = { ...selection, [dimension]: value };
  return findVariantByPartialSelection(spec, partial) != null;
}

/** title 模式下列表中的值均可点（一值一变体） */
export function titleValueExists(spec: ProductSpecificationsJson, value: string): boolean {
  return findVariantByTitleLabel(spec, value) != null;
}

export function variantInStock(v: ShopifyVariantSpec | null): boolean {
  if (!v) return false;
  if (v.inventory_quantity == null) return true;
  return v.inventory_quantity > 0;
}

/**
 * 布局：选项值数量 > 6 用两列网格，否则横向换行。
 */
export function optionLayoutClass(valueCount: number): { container: string; item: string } {
  if (valueCount > 6) {
    return {
      container: "grid grid-cols-2 gap-2",
      item: "min-h-[40px] rounded-xl border px-2 py-2 text-center text-xs font-medium",
    };
  }
  return {
    container: "flex flex-wrap gap-2",
    item: "min-h-[40px] min-w-[44px] rounded-lg border px-3 py-2 text-center text-xs font-medium",
  };
}

/** 长文案 SKU / 参考图侧栏：纵向全宽药丸 */
export function optionTitleStackLayoutClass(): { container: string; item: string } {
  return {
    container: "flex w-full flex-col gap-2",
    item: "w-full min-h-[48px] rounded-xl border px-4 py-3 text-center text-sm font-medium leading-snug",
  };
}
