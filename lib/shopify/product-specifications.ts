/**
 * Shopify 商品在 Supabase `products.specifications` 中的 JSON 结构
 * 由同步脚本与 Webhook 写入；前端与结账用此解析变体、价格与库存。
 */

export type ShopifyVariantSpec = {
  id: string;
  price: string;
  position: number | null;
  inventory_quantity: number | null;
  title: string | null;
  option1: string | null;
  option2: string | null;
  option3: string | null;
};

export type ShopifyOptionSpec = {
  name: string;
  position: number;
  values: string[];
};

export type ProductSpecificationsJson = {
  shopify_variants: ShopifyVariantSpec[];
  shopify_options?: ShopifyOptionSpec[];
  /** Admin REST `Product.tags` 逗号分隔；镜像建单时并入 Shopify 订单 tags */
  shopify_product_tags?: string;
};

export type RestVariantLike = {
  id?: string | number;
  /** Admin REST 有此字段；可与 `inventory_levels` 对照拉真实 available */
  inventory_item_id?: string | number;
  price?: string;
  position?: number;
  inventory_quantity?: number;
  title?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

export type RestOptionLike = {
  name: string;
  position: number;
  values: string[];
};

function normStr(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * 从 Admin REST 的 variants + options 构建写入 DB 的 specifications 对象。
 */
export function buildProductSpecificationsFromRest(
  variants: RestVariantLike[] | null | undefined,
  options: RestOptionLike[] | null | undefined
): Record<string, unknown> | null {
  if (!variants?.length) return null;

  const list = [...variants]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((x) => {
      const id = x.id != null ? String(x.id).trim() : "";
      return {
        id: id || "",
        price: x.price != null && String(x.price).trim() !== "" ? String(x.price) : "0",
        position: typeof x.position === "number" && Number.isFinite(x.position) ? x.position : null,
        inventory_quantity:
          typeof x.inventory_quantity === "number" && Number.isFinite(x.inventory_quantity)
            ? Math.max(0, Math.floor(x.inventory_quantity))
            : null,
        title: normStr(x.title != null ? String(x.title) : null),
        option1: normStr(x.option1 != null ? String(x.option1) : null),
        option2: normStr(x.option2 != null ? String(x.option2) : null),
        option3: normStr(x.option3 != null ? String(x.option3) : null),
      };
    })
    .filter((x) => x.id.length > 0);

  if (list.length === 0) return null;

  const optRows: ShopifyOptionSpec[] = (options ?? [])
    .map((o) => ({
      name: (o.name ?? "Option").trim() || "Option",
      position: o.position,
      values: [...new Set((o.values ?? []).map((v) => String(v).trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true })
      ),
    }))
    .filter((o) => o.values.length > 0)
    .sort((a, b) => a.position - b.position);

  const out: Record<string, unknown> = { shopify_variants: list };
  if (optRows.length > 0) {
    out.shopify_options = optRows;
  }
  return out;
}

/**
 * 将 Shopify 商品 `tags` 写入 `specifications`（与 `shopify_variants` 并存）。
 * 若没有变体片段（specs null），不写仅含 tags 的对象，以免覆盖表中已有 specifications。
 */
export function attachShopifyProductTags(
  specs: Record<string, unknown> | null,
  tagsCommaSeparated: string | null | undefined
): Record<string, unknown> | null {
  const t = (tagsCommaSeparated ?? "").trim();
  if (!specs) return null;
  if (!t) return { ...specs };
  const out = { ...specs, shopify_product_tags: t.slice(0, 4000) };
  return Object.keys(out).length ? out : null;
}

/** 合并多来源逗号分隔标签（去重、截断）；用于镜像订单 Shopify `tags`。 */
export function mergeShopifyCommaTags(
  segments: Array<string | null | undefined>
): string {
  const set = new Set<string>();
  for (const raw of segments) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    for (const p of s.split(",")) {
      const t = p.trim();
      if (t) set.add(t.slice(0, 80));
      if (set.size >= 50) break;
    }
  }
  return [...set].join(", ").slice(0, 950);
}

/** App 购物车行是否可映射为 Shopify variant 并参与镜像单（代销/自营只要来自 Shopify 皆可）。 */
export function cartLineHasResolvableShopifyVariant(
  product: { specifications: unknown },
  cartLine: { shopifyVariantId?: string | null | undefined }
): boolean {
  const spec = parseProductSpecifications(product.specifications);
  if (!spec?.shopify_variants?.length) return false;
  const vid = resolveVariantIdForCheckout(spec, cartLine.shopifyVariantId ?? undefined);
  return Boolean(vid);
}

export function parseProductSpecifications(raw: unknown): ProductSpecificationsJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const v = o.shopify_variants;
  if (!Array.isArray(v) || v.length === 0) return null;
  const shopify_variants: ShopifyVariantSpec[] = [];
  for (const row of v) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = r.id != null ? String(r.id).trim() : "";
    if (!id) continue;
    const inv = r.inventory_quantity;
    shopify_variants.push({
      id,
      price: r.price != null ? String(r.price) : "0",
      position:
        typeof r.position === "number" && Number.isFinite(r.position) ? r.position : null,
      inventory_quantity:
        typeof inv === "number" && Number.isFinite(inv) ? Math.max(0, Math.floor(inv)) : null,
      title: r.title != null ? normStr(String(r.title)) : null,
      option1: r.option1 != null ? normStr(String(r.option1)) : null,
      option2: r.option2 != null ? normStr(String(r.option2)) : null,
      option3: r.option3 != null ? normStr(String(r.option3)) : null,
    });
  }
  if (shopify_variants.length === 0) return null;

  const so = o.shopify_options;
  let shopify_options: ShopifyOptionSpec[] | undefined;
  if (Array.isArray(so) && so.length > 0) {
    const parsed: ShopifyOptionSpec[] = [];
    for (const x of so) {
      if (!x || typeof x !== "object") continue;
      const ox = x as Record<string, unknown>;
      const name = String(ox.name ?? "Option").trim() || "Option";
      const pos = typeof ox.position === "number" && Number.isFinite(ox.position) ? ox.position : 0;
      const vals = ox.values;
      const values = Array.isArray(vals)
        ? [...new Set(vals.map((v) => String(v).trim()).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          )
        : [];
      if (values.length) parsed.push({ name, position: pos, values });
    }
    if (parsed.length) shopify_options = parsed.sort((a, b) => a.position - b.position);
  }

  const tagsRaw = o.shopify_product_tags;
  const shopify_product_tags =
    tagsRaw != null && String(tagsRaw).trim() !== ""
      ? String(tagsRaw).trim().slice(0, 4000)
      : undefined;

  const base: ProductSpecificationsJson = shopify_options?.length
    ? { shopify_variants, shopify_options }
    : { shopify_variants };

  return shopify_product_tags
    ? { ...base, shopify_product_tags }
    : base;
}

function parsePriceNumberLocal(price: string | undefined | null): number {
  if (!price) return 0;
  const n = Number.parseFloat(String(price));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function findVariantInSpecifications(
  spec: ProductSpecificationsJson | null,
  shopifyVariantId: string
): ShopifyVariantSpec | null {
  if (!spec?.shopify_variants.length) return null;
  const t = shopifyVariantId.trim();
  return spec.shopify_variants.find((v) => v.id === t) ?? null;
}

/** 无选择器时的默认变体；仅用于加购/展示 */
export function getDefaultVariantId(spec: ProductSpecificationsJson | null): string | null {
  if (!spec?.shopify_variants.length) return null;
  const sorted = [...spec.shopify_variants].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const first = sorted[0];
  return first?.id?.trim() || null;
}

/** 优先选有库存的变体，供详情页默认选中 */
export function getPreferredDefaultVariantId(
  spec: ProductSpecificationsJson | null
): string | null {
  if (!spec?.shopify_variants.length) return null;
  const sorted = [...spec.shopify_variants].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const inStock = sorted.find(
    (v) => v.inventory_quantity == null || v.inventory_quantity > 0
  );
  return (inStock ?? sorted[0])?.id?.trim() || null;
}

/**
 * 校验购物车传来的变体 id；缺省或非法时回退到默认变体。
 */
export function resolveVariantIdForCheckout(
  spec: ProductSpecificationsJson | null,
  requested: string | null | undefined
): string | null {
  const d = getDefaultVariantId(spec);
  const r = requested?.trim();
  if (r && spec && findVariantInSpecifications(spec, r)) return r;
  return d;
}

export function getUnitPriceUsd(
  spec: ProductSpecificationsJson | null,
  shopifyVariantId: string | null | undefined,
  fallbackUnitUsd: number
): number {
  if (!shopifyVariantId) return fallbackUnitUsd;
  const v = findVariantInSpecifications(spec, shopifyVariantId);
  if (!v) return fallbackUnitUsd;
  return parsePriceNumberLocal(v.price);
}

export function getVariantInventory(
  spec: ProductSpecificationsJson | null,
  shopifyVariantId: string | null | undefined
): number | null {
  if (!shopifyVariantId) return null;
  const v = findVariantInSpecifications(spec, shopifyVariantId);
  if (!v) return null;
  if (v.inventory_quantity == null) return null;
  return v.inventory_quantity;
}
