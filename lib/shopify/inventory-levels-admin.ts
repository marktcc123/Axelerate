/**
 * Admin REST：`inventory_levels` 按仓聚合 `available`，用于替代变体对象上不可靠/缺省的 `inventory_quantity`
 * （多仓、Trendsi 等第三方接管库存时会灰显或在 REST 上出现 0）。
 *
 * - 不设或 `SHOPIFY_ENRICH_INVENTORY_FROM_LEVELS` 非 `false` 时启用（Webhook / 同步脚本）。
 * - 可选 `SHOPIFY_INVENTORY_LOCATION_IDS`（逗号分隔数字）：若设置，只对列出的 Location 汇总 `available`；
 *   未设置则在所有仓位上汇总（与 Shopify 前台「全网可卖」观感一致）。
 *
 * Admin 令牌需勾选 `read_inventory`（或等价 read_products / inventory scopes，视应用版本）。
 */

export const SHOPIFY_INVENTORY_LEVELS_CHUNK = 50;

export function isShopifyInventoryLevelsEnrichEnabled(): boolean {
  const v = process.env.SHOPIFY_ENRICH_INVENTORY_FROM_LEVELS?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

/** 逗号分隔的 location_id，用于只统计指定仓（例如只显示卖家自有仓，不含第三方同步仓）。 */
export function parseShopifyInventoryLocationIds(): string[] | undefined {
  const raw = process.env.SHOPIFY_INVENTORY_LOCATION_IDS?.trim();
  if (!raw) return undefined;
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
  return ids.length > 0 ? ids : undefined;
}

type InventoryLevelRestRow = {
  inventory_item_id?: number | string;
  available?: number;
  location_id?: number | string;
};

type InventoryLevelsListResponse = {
  inventory_levels?: InventoryLevelRestRow[];
};

export function overlayVariantsInventoryQuantityFromAvailabilityMap<
  T extends {
    inventory_item_id?: string | number;
    inventory_quantity?: number;
  }
>(variants: T[] | null | undefined, availableByInventoryItemId: Map<string, number>): void {
  if (!variants?.length || availableByInventoryItemId.size === 0) return;
  for (const v of variants) {
    const iid =
      v.inventory_item_id != null && String(v.inventory_item_id).trim() !== ""
        ? String(v.inventory_item_id).trim()
        : "";
    if (!iid) continue;
    if (!availableByInventoryItemId.has(iid)) continue;
    const qty = availableByInventoryItemId.get(iid) ?? 0;
    v.inventory_quantity = qty;
  }
}

function requireAdminToken(): string | null {
  const t = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

function getStoreDomainRaw(): string | null {
  const d = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  return d ? d.replace(/^https?:\/\//, "") : null;
}

function getApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() || "2024-10";
}

function adminRestUrl(pathWithQuery: string): string | null {
  const domain = getStoreDomainRaw();
  if (!domain) return null;
  const v = getApiVersion();
  const p = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `https://${domain}/admin/api/${v}${p}`;
}

/** 同一 `inventory_item_id` 在多仓位会有多行：汇总 `available` */
function aggregateLevels(levels: InventoryLevelRestRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of levels) {
    if (row.inventory_item_id == null) continue;
    const iid = String(row.inventory_item_id).trim();
    if (!iid) continue;
    const avail =
      typeof row.available === "number" && Number.isFinite(row.available)
        ? Math.max(0, Math.floor(row.available))
        : 0;
    out.set(iid, (out.get(iid) ?? 0) + avail);
  }
  return out;
}

async function fetchInventoryLevelsOneBatch(
  inventoryItemIds: string[],
  token: string,
  locationIds?: string[]
): Promise<InventoryLevelRestRow[]> {
  const base = adminRestUrl("/inventory_levels.json");
  if (!base) return [];
  const url = new URL(base);
  url.searchParams.set("inventory_item_ids", inventoryItemIds.join(","));
  if (locationIds?.length) {
    url.searchParams.set("location_ids", locationIds.join(","));
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 900));
    const res2 = await fetch(url.toString(), {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const text2 = await res2.text();
    if (!res2.ok) {
      console.warn(
        `[shopify inventory_levels] ${res2.status} ${text2.slice(0, 400)}`
      );
      return [];
    }
    try {
      const body2 = JSON.parse(text2) as InventoryLevelsListResponse;
      return Array.isArray(body2.inventory_levels) ? body2.inventory_levels : [];
    } catch {
      return [];
    }
  }
  if (!res.ok) {
    console.warn(
      `[shopify inventory_levels] ${res.status} ${text.slice(0, 400)}`
    );
    return [];
  }
  let body: InventoryLevelsListResponse;
  try {
    body = JSON.parse(text) as InventoryLevelsListResponse;
  } catch {
    console.warn("[shopify inventory_levels] non-JSON response");
    return [];
  }
  return Array.isArray(body.inventory_levels) ? body.inventory_levels : [];
}

/** 分批请求并合并为一个 map：`inventory_item_id` → 汇总 `available` */
export async function fetchAggregateAvailableByInventoryItemIds(
  inventoryItemIds: string[],
  opts?: {
    token?: string;
    /** 若传入，只统计这些 location（通常从 `SHOPIFY_INVENTORY_LOCATION_IDS` 解析） */
    locationIds?: string[];
  }
): Promise<Map<string, number>> {
  const token = opts?.token ?? requireAdminToken();
  if (!token || inventoryItemIds.length === 0) return new Map();

  const unique = [...new Set(inventoryItemIds.map((x) => String(x).trim()).filter(Boolean))];
  const merged = new Map<string, number>();
  const loc = opts?.locationIds ?? parseShopifyInventoryLocationIds();

  for (let i = 0; i < unique.length; i += SHOPIFY_INVENTORY_LEVELS_CHUNK) {
    const slice = unique.slice(i, i + SHOPIFY_INVENTORY_LEVELS_CHUNK);
    const rows = await fetchInventoryLevelsOneBatch(slice, token, loc);
    const batchMap = aggregateLevels(rows);
    for (const [k, n] of batchMap) merged.set(k, n);
    if (i + SHOPIFY_INVENTORY_LEVELS_CHUNK < unique.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return merged;
}

function collectInventoryItemIdsFromVariants(
  variants: Array<{ inventory_item_id?: string | number }> | null | undefined
): string[] {
  if (!variants?.length) return [];
  const out: string[] = [];
  for (const v of variants) {
    if (v.inventory_item_id == null) continue;
    const s = String(v.inventory_item_id).trim();
    if (s) out.push(s);
  }
  return out;
}

/** 单商品：拉 levels 并写回 `variants[].inventory_quantity` */
export async function enrichProductPayloadWithInventoryLevels<
  P extends {
    variants?: Array<{
      id?: string | number;
      inventory_item_id?: string | number;
      inventory_quantity?: number;
    }>;
  }
>(product: P): Promise<void> {
  if (!isShopifyInventoryLevelsEnrichEnabled()) return;
  const token = requireAdminToken();
  if (!token) return;
  const ids = collectInventoryItemIdsFromVariants(product.variants);
  if (ids.length === 0) return;
  const map = await fetchAggregateAvailableByInventoryItemIds(ids, { token });
  overlayVariantsInventoryQuantityFromAvailabilityMap(product.variants, map);
}

/** 全店商品列表：一次性构建 item_id → available，供同步脚本循环内覆盖 */
export async function buildAvailabilityMapForRestProducts(
  products: Array<{
    variants?: Array<{ inventory_item_id?: string | number }> | null;
  }>
): Promise<Map<string, number>> {
  if (!isShopifyInventoryLevelsEnrichEnabled()) return new Map();
  const token = requireAdminToken();
  if (!token) return new Map();
  const allIds: string[] = [];
  for (const p of products) {
    allIds.push(...collectInventoryItemIdsFromVariants(p.variants ?? null));
  }
  if (allIds.length === 0) return new Map();
  return fetchAggregateAvailableByInventoryItemIds(allIds, { token });
}
