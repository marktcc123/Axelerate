import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import JSONBig from "json-bigint";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachShopifyProductTags, buildProductSpecificationsFromRest } from "@/lib/shopify/product-specifications";
import {
  pickAllRestProductImageSrcs,
  pickFirstRestProductImage,
} from "@/lib/shopify/rest-product-images";
import { fetchAdminRestProductById } from "@/lib/shopify/api";
import { enrichProductPayloadWithInventoryLevels } from "@/lib/shopify/inventory-levels-admin";

/** 此 Webhook 写入的 `products` 行以 Shopify 载荷为准；App 侧商品数据应由此与 `sync-shopify-products` 同步，而非独立建主数据。 */
const parseShopifyProductJson = JSONBig({ storeAsString: true }).parse;

export const runtime = "nodejs";

const TOPICS = new Set(["products/create", "products/update"]);

/**
 * 浏览器 GET 可访问，用于确认部署与「关键 env 已配置」（不返回秘钥内容）。
 * 例：https://你的域名/api/webhooks/shopify
 */
function serviceRoleKeyLooksLikeJwt(key: string | undefined): boolean {
  const k = key?.trim() ?? "";
  return k.startsWith("eyJ") && k.length > 80;
}

export async function GET() {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return Response.json(
    {
      ok: true,
      route: "shopify-webhook",
      env: {
        hasShopifyWebhookSecret: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET?.trim()),
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
        hasServiceRole: Boolean(sr),
        /** 建议配置：Webhook 收到摘要 Body 时会用 Admin REST 拉全量商品以写入 `images` / `long_description_html` */
        hasShopifyAdminToken: Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()),
        /** 必须是 service_role 的 JWT（以 eyJ 开头），不要用 sb_publishable / anon */
        serviceRoleKeyLooksValid: serviceRoleKeyLooksLikeJwt(sr),
        hasFixedDropshipBrand: Boolean(process.env.SHOPIFY_DROPSHIP_BRAND_ID?.trim()),
      },
    },
    { status: 200 }
  );
}

type ShopifyProductPayload = {
  /** 大整数在 JSON 中超出 JS 安全整数时必须为字符串，避免精度丢失 */
  id: string;
  title?: string;
  body_html?: string | null;
  status?: string;
  /** Shopify「供应商」字段，用于在 Supabase 中自动创建/匹配品牌 */
  vendor?: string | null;
  /** 常用作商品类型/分类提示 */
  product_type?: string | null;
  /** 部分 Webhook（含第三方精简摘要）会省略此字段或仅含占位；完整数据依赖 Admin REST 合并 */
  featured_image?: string | null;
  image?: { src?: string } | null;
  images?: { id?: number; src?: string }[];
  variants?: {
    id: string | number;
    inventory_item_id?: string | number;
    price?: string;
    position?: number;
    inventory_quantity?: number;
    title?: string | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
  }[];
  options?: { name: string; position: number; values: string[] }[];
  /** Admin REST `tags` 字符串，逗号分隔；写入 `specifications.shopify_product_tags` 供镜像单合并到订单 tags */
  tags?: string | null;
};

function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string
): boolean {
  if (!hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(hmacHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type ShopifyVariant = NonNullable<ShopifyProductPayload["variants"]>[number];

function defaultVariant(product: ShopifyProductPayload): ShopifyVariant {
  const variants = product.variants;
  if (!variants?.length) {
    return { id: 0, price: "0", position: 1, inventory_quantity: 0 };
  }
  return [...variants].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  )[0]!;
}

function parsePriceNumber(priceStr: string | undefined): number {
  if (!priceStr) return 0;
  const n = Number.parseFloat(priceStr);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 若设置 `SHOPIFY_DROPSHIP_BRAND_ID`，所有同步商品强制挂到该品牌（覆盖自动逻辑）。
 * 否则按 Shopify `vendor` 在 `brands.shopify_vendor` 上查找；无则插入新品牌，再返回 `id`。
 */
async function resolveBrandIdForProduct(
  supabase: SupabaseClient,
  product: ShopifyProductPayload,
  shopDomain: string
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
    return existing.id;
  }

  // 仅写「必有」列：name/logo/is_featured 来自 00001，shopify_vendor 来自 00041。
  // 不写入 description/category：部分环境未跑 00016 时 PostgREST 报 PGRST204；跑齐迁移后可再扩展。
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
    console.error("[shopify webhook] brands insert", {
      message: error.message,
      code: error.code,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    });
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("brands")
        .select("id")
        .eq("shopify_vendor", vendorKey)
        .maybeSingle();
      if (again?.id) {
        return again.id;
      }
    }
    throw error;
  }

  console.log("[shopify webhook] created brand", { vendorKey, id: inserted?.id });
  return inserted!.id as string;
}

function buildProductRow(
  brandId: string,
  product: ShopifyProductPayload,
  shopifyProductId: string
) {
  const v = defaultVariant(product);
  const price = parsePriceNumber(v.price);
  const inv = v.inventory_quantity;
  const stock =
    typeof inv === "number" && Number.isFinite(inv) ? Math.max(0, Math.floor(inv)) : 0;

  const listingStatus =
    product.status === "archived" || product.status === "draft" ? "draft" : "active";

  const category =
    (product.product_type ?? "").trim().slice(0, 120) || "Beauty";

  const specifications = attachShopifyProductTags(
    buildProductSpecificationsFromRest(product.variants ?? null, product.options ?? null),
    product.tags != null ? String(product.tags) : undefined
  );

  const galleryUrls = pickAllRestProductImageSrcs(product);

  return {
    shopify_product_id: shopifyProductId,
    brand_id: brandId,
    title: (product.title ?? "Untitled").slice(0, 2000),
    description: htmlToPlainText(product.body_html),
    long_description_html: product.body_html ? String(product.body_html) : null,
    image_url: pickFirstRestProductImage(product),
    images: galleryUrls.length > 0 ? galleryUrls : null,
    original_price: price,
    price_credits: 0,
    stock_count: stock,
    fulfillment_type: "dropshipping" as const,
    status: listingStatus,
    category,
    specifications,
  };
}

/**
 * 不依赖 `ON CONFLICT (shopify_product_id)`：生产库若未跑 00042 唯一约束，PostgREST upsert 会报 42P10。
 * 先按 shopify_product_id 查再 update/insert。
 */
async function insertOrUpdateProductByShopifyId(
  supabase: SupabaseClient,
  row: ReturnType<typeof buildProductRow>
) {
  const shopifyId = row.shopify_product_id;
  const { data: existing, error: selErr } = await supabase
    .from("products")
    .select("id")
    .eq("shopify_product_id", shopifyId)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("products")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("products")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

function errJson(
  code: string,
  status: number,
  extra?: Record<string, string>
) {
  return Response.json(
    { ok: false, code, ...extra },
    { status, headers: { "content-type": "application/json" } }
  );
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[shopify webhook] SHOPIFY_WEBHOOK_SECRET is not set");
    return errJson("missing_shopify_webhook_secret", 500);
  }

  const rawBody = await request.text();
  const hmac = request.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyShopifyHmac(rawBody, hmac, secret)) {
    console.error("[shopify webhook] HMAC verification failed");
    return errJson("hmac_mismatch", 401);
  }

  const topic = request.headers.get("X-Shopify-Topic") ?? "";
  const shop = request.headers.get("X-Shopify-Shop-Domain") ?? "unknown";
  if (!TOPICS.has(topic)) {
    console.log(`[shopify webhook] ignore topic=${topic} shop=${shop}`);
    return new Response("ok", { status: 200 });
  }

  let product: ShopifyProductPayload;
  try {
    product = parseShopifyProductJson(rawBody) as ShopifyProductPayload;
  } catch (e) {
    console.error("[shopify webhook] JSON parse error:", e);
    return errJson("invalid_json", 400);
  }

  const shopifyProductId =
    typeof product.id === "string"
      ? product.id.trim()
      : String(product.id);
  if (!/^\d+$/.test(shopifyProductId)) {
    console.error("[shopify webhook] missing or invalid product.id", { shop, topic });
    return errJson("missing_product_id", 400);
  }

  /** 第三方（如 Trendsi）触发的 Webhook Body 常为摘要：缺 `images`/`body_html`；用 Admin REST 拉全量后再写库。 */
  let productForDb: ShopifyProductPayload = product;
  const adminSnapshot = await fetchAdminRestProductById(shopifyProductId);
  if (adminSnapshot) {
    productForDb = {
      ...product,
      ...(adminSnapshot as unknown as ShopifyProductPayload),
      id: product.id,
    };
  }

  await enrichProductPayloadWithInventoryLevels(productForDb);

  let supabase: SupabaseClient;
  try {
    supabase = createAdminClient();
  } catch (e) {
    console.error("[shopify webhook] createAdminClient failed:", e);
    return errJson("missing_supabase_env", 500, {
      hint: "set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel",
    });
  }

  let brandId: string;
  try {
    brandId = await resolveBrandIdForProduct(supabase, productForDb, shop);
  } catch (e) {
    console.error("[shopify webhook] resolve brand failed:", e, { shop, topic });
    const supa = e as { message?: string; code?: string };
    const detail = [supa?.code, supa?.message]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 800);
    return errJson("brand_resolution_failed", 500, { detail: detail || String(e) });
  }

  const row = buildProductRow(brandId, productForDb, shopifyProductId);

  let data: { id?: string } | null;
  try {
    data = await insertOrUpdateProductByShopifyId(supabase, row);
  } catch (error) {
    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error("[shopify webhook] product sync failed", {
      shop,
      topic,
      shopifyId: shopifyProductId,
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    });
    return errJson("supabase_product_sync_failed", 500, { pg: err.code ?? "unknown" });
  }

  console.log(
    "[shopify webhook] synced",
    { shop, topic, shopify_product_id: shopifyProductId, supabase_id: data?.id, brand_id: brandId },
  );
  return new Response("ok", { status: 200 });
}
