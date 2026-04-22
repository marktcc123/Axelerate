import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOPICS = new Set(["products/create", "products/update"]);

type ShopifyProductPayload = {
  id: number;
  title?: string;
  body_html?: string | null;
  status?: string;
  image?: { src?: string } | null;
  images?: { id?: number; src?: string }[];
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
 * 处理 Shopify 商品并写入/更新 `products` 行。依赖唯一索引 `shopify_product_id` 做 upsert。
 */
function buildProductRow(brandId: string, product: ShopifyProductPayload) {
  const v = defaultVariant(product);
  const price = parsePriceNumber(v.price);
  const inv = v.inventory_quantity;
  const stock =
    typeof inv === "number" && Number.isFinite(inv) ? Math.max(0, Math.floor(inv)) : 0;

  const listingStatus =
    product.status === "archived" || product.status === "draft" ? "draft" : "active";

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
  };
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[shopify webhook] SHOPIFY_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const brandId = process.env.SHOPIFY_DROPSHIP_BRAND_ID?.trim();
  if (!brandId) {
    console.error(
      "[shopify webhook] SHOPIFY_DROPSHIP_BRAND_ID is not set (UUID of brands row for synced items)"
    );
    return new Response("Brand not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const hmac = request.headers.get("X-Shopify-Hmac-SHA256");
  if (!verifyShopifyHmac(rawBody, hmac, secret)) {
    console.error("[shopify webhook] HMAC verification failed");
    return new Response("Unauthorized", { status: 401 });
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
    return new Response("Bad JSON", { status: 400 });
  }

  if (typeof product.id !== "number") {
    console.error("[shopify webhook] missing product.id", { shop, topic });
    return new Response("Invalid payload", { status: 400 });
  }

  const supabase = createAdminClient();
  const row = buildProductRow(brandId, product);

  const { data, error } = await supabase
    .from("products")
    .upsert(row, { onConflict: "shopify_product_id" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[shopify webhook] upsert failed",
      { shop, topic, shopifyId: product.id, message: error.message, code: error.code },
    );
    return new Response("Database error", { status: 500 });
  }

  console.log(
    "[shopify webhook] synced",
    { shop, topic, shopify_product_id: product.id, supabase_id: data?.id },
  );
  return new Response("ok", { status: 200 });
}
