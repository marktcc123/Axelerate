/**
 * 一次性从 Shopify Admin REST 拉取全店商品并写入 Supabase `products`（存量同步）。
 *
 * 数据原则：**商品目录、变体、价格在业务上以 Shopify Admin 为准**；本表是供 App 展示的缓存。
 * 上架/改价/改库存请在 Shopify 侧操作，再靠本脚本或 `products/*` Webhook 回写 Supabase；勿把 Supabase 当主库手改再反向推 Shopify。
 *
 * 依赖 .env.local（缺任一项都会报错，请逐项核对）：
 *   SHOPIFY_STORE_DOMAIN
 *   SHOPIFY_ADMIN_ACCESS_TOKEN  ← 与 Webhook 的 SHOPIFY_WEBHOOK_SECRET、Storefront 的 SHOPIFY_STOREFRONT_ACCESS_TOKEN 不是同一个；须为
 *     Shopify 后台「自定义应用 / Custom app」里 Admin API 的访问令牌，且已勾选 read_products
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * 可选：
 *   SHOPIFY_API_VERSION（默认 2024-10）
 *   SHOPIFY_DROPSHIP_BRAND_ID — 若设置则所有商品挂到该品牌，否则按 `vendor` 建/查品牌（与 Webhook 一致）
 *   SHOPIFY_ENRICH_INVENTORY_FROM_LEVELS — 默认启用：用 Admin `inventory_levels` 汇总真实可售量写回变体（需 read_inventory）
 *   SHOPIFY_INVENTORY_LOCATION_IDS — 可选，逗号分隔：只统计这些 Location 的 available
 *
 * 用法：
 *   npx tsx scripts/sync-shopify-products.ts
 *
 * 分页：每页最多 250 条（Shopify 上限），通过 Link rel="next" 游标翻页，大于 50 条时自动多页。
 */

import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import JSONBig from "json-bigint";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { attachShopifyProductTags, buildProductSpecificationsFromRest } from "../lib/shopify/product-specifications";
import {
  pickAllRestProductImageSrcs,
  pickFirstRestProductImage,
} from "../lib/shopify/rest-product-images";
import {
  buildAvailabilityMapForRestProducts,
  overlayVariantsInventoryQuantityFromAvailabilityMap,
} from "../lib/shopify/inventory-levels-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const parseJson = JSONBig({ storeAsString: true }).parse as (s: string) => unknown;

const DEFAULT_VERSION = "2024-10";
const REST_PAGE_LIMIT = 250; // Admin REST 单页最大 250
const UPSERT_CHUNK = 100;

// --- env ---

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

const REQUIRED_SYNC_ENVS = [
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_ADMIN_ACCESS_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function assertRequiredSyncEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_SYNC_ENVS) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  if (missing.length === 0) return;
  const hint =
    missing.includes("SHOPIFY_ADMIN_ACCESS_TOKEN")
      ? [
          "",
          "  SHOPIFY_ADMIN_ACCESS_TOKEN 写法示例（勿带引号）：",
          "    SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxx",
          "  获取：Shopify 后台 → 设置 → 应用和集成 → 你的自定义应用 → API 凭据 / Admin API access token。",
        ].join("\n")
      : "";
  throw new Error(
    [
      `环境变量未配置。请在项目根目录 .env.local 中补全这些键名（当前缺：${missing.join(", ")}）`,
      hint,
    ].join("\n")
  );
}

function getStoreDomain(): string {
  return requireEnv("SHOPIFY_STORE_DOMAIN").replace(/^https?:\/\//, "");
}

function getApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_VERSION;
}

function adminRestUrl(pathWithQuery: string): string {
  const domain = getStoreDomain();
  const v = getApiVersion();
  const p = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`;
  return `https://${domain}/admin/api/${v}${p}`;
}

// --- REST types（BigInt id 在 JSON 中为 string）---

type RestVariant = {
  id?: string | number;
  inventory_item_id?: string | number;
  price?: string;
  position?: number;
  inventory_quantity?: number;
  title?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

type RestImage = { id?: string | number; src?: string };

type RestOption = { name: string; position: number; values: string[] };

type RestProduct = {
  id?: string;
  title?: string;
  body_html?: string | null;
  status?: string;
  vendor?: string | null;
  product_type?: string | null;
  /** Admin REST 商品 tags，写入 specifications 供镜像订单 */
  tags?: string | null;
  image?: { src?: string } | null;
  images?: RestImage[] | null;
  variants?: RestVariant[] | null;
  options?: RestOption[] | null;
};

type ProductsListResponse = { products?: RestProduct[] };

// --- 与 Webhook 对齐的辅助函数 ---

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriceNumber(priceStr: string | undefined): number {
  if (!priceStr) return 0;
  const n = Number.parseFloat(priceStr);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function defaultVariant(product: RestProduct): RestVariant {
  const variants = product.variants;
  if (!variants?.length) {
    return { id: 0, price: "0", position: 1, inventory_quantity: 0 };
  }
  return [...variants].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  )[0]!;
}

function buildVariantPricesSpec(product: RestProduct): Record<string, unknown> | null {
  return attachShopifyProductTags(
    buildProductSpecificationsFromRest(product.variants, product.options ?? null),
    product.tags != null ? String(product.tags) : undefined
  );
}

// --- 品牌：与 `app/api/webhooks/shopify/route.ts` 同逻辑（精简列 insert）---

async function resolveBrandIdForProduct(
  supabase: SupabaseClient,
  product: RestProduct,
  shopDomain: string,
  cache: Map<string, string>
): Promise<string> {
  const fixed = process.env.SHOPIFY_DROPSHIP_BRAND_ID?.trim();
  if (fixed) {
    return fixed;
  }

  const vendorRaw = (product.vendor ?? "")
    .trim()
    .replace(/\u0000/g, "")
    .slice(0, 500);
  const vendorKey = vendorRaw.length > 0 ? vendorRaw : "__no_vendor__";

  if (cache.has(vendorKey)) {
    return cache.get(vendorKey)!;
  }

  const displayName =
    vendorRaw.length > 0
      ? vendorRaw
      : `Shopify · ${shopDomain.replace(".myshopify.com", "")}`;

  const { data: existing } = await supabase
    .from("brands")
    .select("id")
    .eq("shopify_vendor", vendorKey)
    .maybeSingle();

  if (existing?.id) {
    cache.set(vendorKey, existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("brands")
    .insert({
      name: displayName.slice(0, 500),
      logo_url: null,
      is_featured: false,
      shopify_vendor: vendorKey,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("brands")
        .select("id")
        .eq("shopify_vendor", vendorKey)
        .maybeSingle();
      if (again?.id) {
        cache.set(vendorKey, again.id);
        return again.id;
      }
    }
    throw error;
  }

  const id = inserted!.id as string;
  cache.set(vendorKey, id);
  return id;
}

// --- 商品行（与 Webhook 字段对齐 + images / 变体价 / 长描述）---

type ProductUpsertRow = {
  shopify_product_id: string;
  brand_id: string;
  title: string;
  description: string;
  long_description_html: string | null;
  image_url: string | null;
  images: string[] | null;
  original_price: number;
  price_credits: number;
  stock_count: number;
  fulfillment_type: "dropshipping";
  status: "active" | "draft";
  category: string;
  specifications: Record<string, unknown> | null;
};

function productToRow(
  product: RestProduct,
  brandId: string,
  shopifyProductId: string
): ProductUpsertRow {
  const v = defaultVariant(product);
  const price = parsePriceNumber(
    v.price != null && typeof v.price === "string" ? v.price : String(v.price ?? "")
  );
  const inv = v.inventory_quantity;
  const stock =
    typeof inv === "number" && Number.isFinite(inv) ? Math.max(0, Math.floor(inv)) : 0;

  const listingStatus =
    product.status === "archived" || product.status === "draft" ? "draft" : "active";

  const category =
    (product.product_type ?? "").trim().slice(0, 120) || "Beauty";

  const imageUrls = pickAllRestProductImageSrcs(product);
  const varSpec = buildVariantPricesSpec(product);

  return {
    shopify_product_id: shopifyProductId,
    brand_id: brandId,
    title: (product.title ?? "Untitled").slice(0, 2000),
    description: htmlToPlainText(product.body_html),
    long_description_html: product.body_html ? String(product.body_html) : null,
    image_url: pickFirstRestProductImage(product),
    images: imageUrls.length > 0 ? imageUrls : null,
    original_price: price,
    price_credits: 0,
    stock_count: stock,
    fulfillment_type: "dropshipping",
    status: listingStatus,
    category,
    specifications: varSpec,
  };
}

// --- 无唯一约束时与 Webhook 相同：先查后写 ---

async function insertOrUpdateByShopifyId(
  supabase: SupabaseClient,
  row: ProductUpsertRow
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("products")
    .select("id")
    .eq("shopify_product_id", row.shopify_product_id)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing?.id) {
    const { error } = await supabase.from("products").update(row).eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("products").insert(row);
  if (error) throw error;
}

function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(/,\s*/)) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function adminFetch(
  url: string,
  token: string
): Promise<{ bodyText: string; link: string | null; status: number }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });
    if (res.status === 429) {
      const wait = 1000 * (attempt + 1);
      console.warn(`[sync-shopify-products] 429, retry in ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(
        `Shopify API ${res.status} ${res.statusText}: ${bodyText.slice(0, 500)}`
      );
    }
    return { bodyText, link: res.headers.get("Link"), status: res.status };
  }
  throw new Error("Shopify API: too many 429 responses");
}

async function fetchAllProducts(
  token: string
): Promise<RestProduct[]> {
  const out: RestProduct[] = [];
  let nextUrl: string | null = adminRestUrl(
    `/products.json?limit=${REST_PAGE_LIMIT}`
  );
  let page = 0;

  while (nextUrl) {
    page += 1;
    const { bodyText, link } = await adminFetch(nextUrl, token);
    const parsed = parseJson(bodyText) as ProductsListResponse;
    const batch = Array.isArray(parsed.products) ? parsed.products : [];
    for (const p of batch) {
      if (p?.id != null) out.push(p);
    }
    console.log(
      `[sync-shopify-products] page ${page}: got ${batch.length} products (total so far: ${out.length})`
    );
    nextUrl = parseNextPageUrl(link);
  }

  return out;
}

async function upsertBatches(
  supabase: SupabaseClient,
  rows: ProductUpsertRow[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const slice = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from("products")
      .upsert(slice, { onConflict: "shopify_product_id" });
    if (!error) {
      console.log(
        `[sync-shopify-products] upsert chunk ${i / UPSERT_CHUNK + 1} ok (${slice.length} rows)`
      );
      continue;
    }
    const isConflictSpec =
      error.code === "42P10" ||
      (error.message?.includes("ON CONFLICT") ?? false) ||
      (error.message?.includes("unique or exclusion") ?? false);
    if (isConflictSpec) {
      console.warn(
        "[sync-shopify-products] 批量 upsert 不可用（缺少 shopify_product_id 唯一约束？），改逐行同步… 详见 migration 00042"
      );
      for (const row of slice) {
        await insertOrUpdateByShopifyId(supabase, row);
      }
      console.log(
        `[sync-shopify-products] fallback 完成 chunk ${i / UPSERT_CHUNK + 1} (${slice.length} rows)`
      );
    } else {
      throw error;
    }
  }
}

async function main() {
  assertRequiredSyncEnv();
  const token = requireEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
  getStoreDomain();
  getApiVersion();

  const supabase = createAdminClient();
  const shopDomain = getStoreDomain();
  const brandCache = new Map<string, string>();

  console.log(
    `[sync-shopify-products] store=${shopDomain} api=${getApiVersion()}`
  );

  const products = await fetchAllProducts(token);
  console.log(`[sync-shopify-products] fetched ${products.length} product(s) from Shopify`);

  const availabilityMap = await buildAvailabilityMapForRestProducts(products);
  if (availabilityMap.size > 0) {
    console.log(
      `[sync-shopify-products] inventory_levels: ${availabilityMap.size} inventory_item_id(s)`
    );
    for (const p of products) {
      overlayVariantsInventoryQuantityFromAvailabilityMap(p.variants, availabilityMap);
    }
  }

  const rows: ProductUpsertRow[] = [];

  for (const p of products) {
    const sid = p.id != null ? String(p.id).trim() : "";
    if (!/^\d+$/.test(sid)) {
      console.warn(`[sync-shopify-products] skip product with invalid id:`, p.id);
      continue;
    }
    const brandId = await resolveBrandIdForProduct(supabase, p, shopDomain, brandCache);
    rows.push(productToRow(p, brandId, sid));
  }

  if (rows.length === 0) {
    console.log("[sync-shopify-products] nothing to write.");
    return;
  }

  await upsertBatches(supabase, rows);
  console.log(`[sync-shopify-products] done. upserted/synced ${rows.length} row(s).`);
}

main().catch((e) => {
  console.error("[sync-shopify-products] failed:", e);
  process.exit(1);
});
