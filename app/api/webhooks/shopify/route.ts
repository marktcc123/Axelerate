import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOPICS = new Set(["products/create", "products/update"]);

/**
 * 浏览器 GET 可访问，用于确认部署与「关键 env 已配置」（不返回秘钥内容）。
 * 例：https://你的域名/api/webhooks/shopify
 */
export async function GET() {
  return Response.json(
    {
      ok: true,
      route: "shopify-webhook",
      env: {
        hasShopifyWebhookSecret: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET?.trim()),
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
        hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
        hasFixedDropshipBrand: Boolean(process.env.SHOPIFY_DROPSHIP_BRAND_ID?.trim()),
      },
    },
    { status: 200 }
  );
}

type ShopifyProductPayload = {
  id: number;
  title?: string;
  body_html?: string | null;
  status?: string;
  /** Shopify「供应商」字段，用于在 Supabase 中自动创建/匹配品牌 */
  vendor?: string | null;
  /** 常用作商品类型/分类提示 */
  product_type?: string | null;
  image?: { src?: string } | null;
  images?: { id?: number; src: string }[];
  variants?: {
    id: number;
    price?: string;
    position?: number;
    inventory_quantity?: number;
  }[];
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

function pickFirstImage(product: ShopifyProductPayload): string | null {
  if (product.image?.src) return product.image.src;
  const first = product.images?.[0]?.src;
  return first ?? null;
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

  const vendorRaw = (product.vendor ?? "").trim();
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

  const brandCategory =
    (product.product_type ?? "").trim().slice(0, 200) || null;

  const { data: inserted, error } = await supabase
    .from("brands")
    .insert({
      name: displayName.slice(0, 500),
      logo_url: null,
      is_featured: false,
      shopify_vendor: vendorKey,
      description: null,
      category: brandCategory,
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
  product: ShopifyProductPayload
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

  return {
    shopify_product_id: product.id,
    brand_id: brandId,
    title: (product.title ?? "Untitled").slice(0, 2000),
    description: htmlToPlainText(product.body_html),
    image_url: pickFirstImage(product),
    original_price: price,
    price_credits: 0,
    stock_count: stock,
    fulfillment_type: "dropshipping" as const,
    status: listingStatus,
    category,
  };
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
    product = JSON.parse(rawBody) as ShopifyProductPayload;
  } catch (e) {
    console.error("[shopify webhook] JSON parse error:", e);
    return errJson("invalid_json", 400);
  }

  if (typeof product.id !== "number") {
    console.error("[shopify webhook] missing product.id", { shop, topic });
    return errJson("missing_product_id", 400);
  }

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
    brandId = await resolveBrandIdForProduct(supabase, product, shop);
  } catch (e) {
    console.error("[shopify webhook] resolve brand failed:", e, { shop, topic });
    return errJson("brand_resolution_failed", 500);
  }

  const row = buildProductRow(brandId, product);

  const { data, error } = await supabase
    .from("products")
    .upsert(row, { onConflict: "shopify_product_id" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[shopify webhook] upsert failed",
      {
        shop,
        topic,
        shopifyId: product.id,
        message: error.message,
        code: error.code,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
      }
    );
    return errJson("supabase_upsert_failed", 500, { pg: error.code ?? "unknown" });
  }

  console.log(
    "[shopify webhook] synced",
    { shop, topic, shopify_product_id: product.id, supabase_id: data?.id, brand_id: brandId },
  );
  return new Response("ok", { status: 200 });
}
