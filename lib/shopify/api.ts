import "server-only";

import { mergeShopifyCommaTags } from "@/lib/shopify/product-specifications";

/**
 * Shopify 集成（Storefront + Admin），仅允许在 Server Components / Server Actions / Route Handlers 中导入。
 *
 * 环境变量（.env.local）：
 * - SHOPIFY_STORE_DOMAIN：如 `your-store.myshopify.com`（不含 https）
 * - SHOPIFY_STOREFRONT_ACCESS_TOKEN：Headless Storefront API 令牌
 * - SHOPIFY_ADMIN_ACCESS_TOKEN：需 `write_orders`、`read_products`；建议 `read_customers` + `write_customers`。镜像单迁移履约仓时需 `read_locations` + `write_merchant_managed_fulfillment_orders`。
 * - SHOPIFY_ORDER_INVENTORY_BEHAVIOUR：可选。`decrement_ignoring_policy`（默认，镜像单常需此项：第三方/Trendsi 接管库存时在 Shopify 无「可卖」量也能建单扣账）| `decrement_obeying_policy`（强制按库存政策）| `bypass`
 * - SHOPIFY_MIRROR_VENDOR_LOCATION_ID：可选，纯数字。REST 建单后将 Fulfillment order 移到此 Location（供应商仓）。
 * - SHOPIFY_MIRROR_ASSIGN_VENDOR_LOCATION：设为 `true` / `1` 时若未配置 ID，则在 locations 列表中查找名称默认为 `Vendor` 的位置。
 * - SHOPIFY_MIRROR_VENDOR_LOCATION_NAME：按名称查找（与上一项或本项合用）；单独设置该项也会启用名称查找，默认比对 `Vendor`。
 * - SHOPIFY_API_VERSION：可选，默认 `2024-10`（请勿把应用 ID 或随机 hex 当作 API 版本）
 *
 * Storefront GraphQL 参考：https://shopify.dev/docs/api/storefront
 * Admin REST 订单：https://shopify.dev/docs/api/admin-rest/latest/resources/order#post-orders
 */

const DEFAULT_API_VERSION = "2024-10";

function getApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_API_VERSION;
}

function getStoreDomain(): string {
  const d = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  if (!d) {
    throw new Error(
      "Missing SHOPIFY_STORE_DOMAIN (e.g. your-store.myshopify.com)."
    );
  }
  return d.replace(/^https?:\/\//, "");
}

function getStorefrontToken(): string {
  const t = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();
  if (!t) {
    throw new Error("Missing SHOPIFY_STOREFRONT_ACCESS_TOKEN.");
  }
  return t;
}

function getAdminToken(): string {
  const t = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (!t) {
    throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN.");
  }
  return t;
}

/** Webhook 等场景按需拉 Admin REST：未配置令牌时不抛错。 */
function getAdminTokenIfConfigured(): string | null {
  const t = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  return t || null;
}

/** Stripe / 服务端镜像建单前检查：两处 env 均需配置且与 Custom App Admin API 令牌一致（Vercel Production 常与本地 .env.local 漏配一端）。 */
export function isShopifyAdminConfiguredForMirroring(): boolean {
  const d = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const t = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  return Boolean(d && t);
}

/**
 * 按商品数字 ID 拉取 Admin REST **完整** Product JSON（含 `images[]`、`body_html`）。
 * 用于补足 `products/update` Webhook 中第三方同步（如 Trendsi）带来的**不完整**载荷。
 *
 * @returns `product` 对象；未配置 Admin 令牌、HTTP 非 200 或解析失败时返回 `null`。
 */
export async function fetchAdminRestProductById(
  productIdNumeric: string
): Promise<Record<string, unknown> | null> {
  const token = getAdminTokenIfConfigured();
  if (!token) return null;
  try {
    const res = await fetch(
      adminRestEndpoint(`/products/${encodeURIComponent(productIdNumeric)}.json`),
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error("[shopify] Admin GET product failed", {
        status: res.status,
        snippet: text.slice(0, 400),
      });
      return null;
    }
    const json = (await res.json()) as { product?: unknown };
    const p = json?.product;
    if (p && typeof p === "object" && !Array.isArray(p)) {
      return p as Record<string, unknown>;
    }
    return null;
  } catch (e) {
    console.error("[shopify] Admin GET product threw", e);
    return null;
  }
}

function storefrontEndpoint(): string {
  return `https://${getStoreDomain()}/api/${getApiVersion()}/graphql.json`;
}

function adminRestEndpoint(path: string): string {
  return `https://${getStoreDomain()}/admin/api/${getApiVersion()}${path.startsWith("/") ? path : `/${path}`}`;
}

function adminGraphqlEndpoint(): string {
  return `https://${getStoreDomain()}/admin/api/${getApiVersion()}/graphql.json`;
}

async function shopifyAdminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(adminGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": getAdminToken(),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const text = await res.text();
  let body: { data?: T; errors?: { message: string }[] };
  try {
    body = JSON.parse(text) as { data?: T; errors?: { message: string }[] };
  } catch {
    throw new Error(`Admin GraphQL non-JSON (${res.status}): ${text.slice(0, 400)}`);
  }
  if (!res.ok) {
    throw new Error(`Admin GraphQL HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  if (body.errors?.length) {
    throw new Error(`Admin GraphQL: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (body.data === undefined) {
    throw new Error(`Admin GraphQL: empty data (${text.slice(0, 300)})`);
  }
  return body.data;
}

/** 解析要把镜像单履约迁移到的 Vendor Location（GID）。未启用或未找到时返回 null。 */
let cachedMirrorVendorLocationGid: string | undefined | "_none_";

async function resolveMirrorVendorFulfillmentLocationGid(): Promise<string | null> {
  const idRaw = process.env.SHOPIFY_MIRROR_VENDOR_LOCATION_ID?.trim();
  if (idRaw && /^\d+$/.test(idRaw)) {
    return `gid://shopify/Location/${idRaw}`;
  }

  const nameEnv = process.env.SHOPIFY_MIRROR_VENDOR_LOCATION_NAME?.trim();
  const assign =
    process.env.SHOPIFY_MIRROR_ASSIGN_VENDOR_LOCATION?.trim().toLowerCase() === "true" ||
    process.env.SHOPIFY_MIRROR_ASSIGN_VENDOR_LOCATION?.trim() === "1";
  if (!nameEnv && !assign) return null;

  const nameTarget = nameEnv || "Vendor";
  if (cachedMirrorVendorLocationGid && cachedMirrorVendorLocationGid !== "_none_") {
    return cachedMirrorVendorLocationGid;
  }
  if (cachedMirrorVendorLocationGid === "_none_") return null;

  const res = await fetch(adminRestEndpoint("/locations.json"), {
    headers: {
      "X-Shopify-Access-Token": getAdminToken(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn("[shopify] GET locations.json failed", res.status, text.slice(0, 300));
    cachedMirrorVendorLocationGid = "_none_";
    return null;
  }
  let parsed: { locations?: { id?: number; name?: string }[] };
  try {
    parsed = JSON.parse(text) as { locations?: { id?: number; name?: string }[] };
  } catch {
    cachedMirrorVendorLocationGid = "_none_";
    return null;
  }
  const list = Array.isArray(parsed.locations) ? parsed.locations : [];
  const want = nameTarget.toLowerCase();
  const found = list.find(
    (l) => String(l?.name ?? "").trim().toLowerCase() === want
  );
  if (found?.id != null && Number.isFinite(Number(found.id))) {
    const gid = `gid://shopify/Location/${found.id}`;
    cachedMirrorVendorLocationGid = gid;
    return gid;
  }
  console.warn(
    `[shopify] No Location named "${nameTarget}" (set SHOPIFY_MIRROR_VENDOR_LOCATION_ID or fix name).`
  );
  cachedMirrorVendorLocationGid = "_none_";
  return null;
}

const FULFILLMENT_ORDERS_ON_ORDER_QUERY = /* GraphQL */ `
  query MirrorOrderFulfillmentOrders($orderId: ID!) {
    order(id: $orderId) {
      id
      fulfillmentOrders(first: 25) {
        nodes {
          id
          status
          assignedLocation {
            location {
              id
            }
          }
        }
      }
    }
  }
`;

const FULFILLMENT_ORDER_MOVE_MUTATION = /* GraphQL */ `
  mutation MirrorMoveFulfillmentOrder($id: ID!, $newLocationId: ID!) {
    fulfillmentOrderMove(id: $id, newLocationId: $newLocationId) {
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * REST 建单后 Shopify 自动分配履约仓；将未发货的 Fulfillment order 迁到 Vendor Location。
 * 若目标仓无该 SKU 库存，Shopify 会返回 userErrors，仅记日志不抛错。
 */
async function moveMirrorOrderFulfillmentToVendorIfConfigured(
  orderNumericId: string
): Promise<void> {
  const targetGid = await resolveMirrorVendorFulfillmentLocationGid();
  if (!targetGid) return;

  const orderGid = `gid://shopify/Order/${orderNumericId}`;

  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 300 + attempt * 150));
    }

    type Q = {
      order: {
        fulfillmentOrders: { nodes: Array<{ id: string; status: string; assignedLocation: { location: { id: string } | null } | null }> };
      } | null;
    };

    let data: Q;
    try {
      data = await shopifyAdminGraphql<Q>(FULFILLMENT_ORDERS_ON_ORDER_QUERY, {
        orderId: orderGid,
      });
    } catch (e) {
      console.warn("[shopify] fulfillmentOrders query failed", e);
      return;
    }

    const fos = data.order?.fulfillmentOrders?.nodes ?? [];
    if (fos.length === 0) continue;

    for (const fo of fos) {
      if (!fo?.id) continue;
      const st = String(fo.status ?? "").toUpperCase();
      if (st === "CLOSED" || st === "CANCELLED") continue;
      const cur = fo.assignedLocation?.location?.id ?? null;
      if (cur === targetGid) continue;

      type M = {
        fulfillmentOrderMove: { userErrors: { field?: string[]; message: string }[] };
      };

      try {
        const moved = await shopifyAdminGraphql<M>(FULFILLMENT_ORDER_MOVE_MUTATION, {
          id: fo.id,
          newLocationId: targetGid,
        });
        const errs = moved.fulfillmentOrderMove?.userErrors ?? [];
        if (errs.length > 0) {
          console.warn("[shopify] fulfillmentOrderMove userErrors:", errs);
        }
      } catch (e) {
        console.warn("[shopify] fulfillmentOrderMove failed", e);
      }
    }

    return;
  }

  console.warn(
    "[shopify] fulfillmentOrders empty after retries; skipping vendor location move:",
    orderNumericId
  );
}

/** 从 `gid://shopify/ProductVariant/123` 或纯数字得到 REST 用的数字 variant_id */
export function parseVariantIdForRest(
  variantGidOrNumeric: string
): string {
  const s = variantGidOrNumeric.trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/ProductVariant\/(\d+)/);
  if (m) return m[1];
  throw new Error(
    `Invalid Shopify variant id (expected GID or numeric): ${variantGidOrNumeric}`
  );
}

// --- Storefront: products ---

const PRODUCTS_QUERY = /* GraphQL */ `
  query StorefrontProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          handle
          featuredImage {
            url
            altText
          }
          images(first: 10) {
            nodes {
              url
              altText
            }
          }
          variants(first: 50) {
            nodes {
              id
              title
              sku
              availableForSale
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
              quantityAvailable
            }
          }
        }
      }
    }
  }
`;

export type ShopifyProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  /** Storefront 可见库存；若未追踪库存，可能为 null */
  quantityAvailable: number | null;
};

export type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  handle: string;
  /** 优先 featuredImage，否则 images[0]，用于封面展示 */
  imageUrl: string | null;
  /** 画廊 URL 列表（与 `images(first: 10)` 一致，顺序与 Shopify 画廊一致）；封面仍为 `imageUrl` */
  imageUrls: string[];
  imageAlt: string | null;
  variants: ShopifyProductVariant[];
};

type StorefrontProductsResponse = {
  data?: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: {
        node: {
          id: string;
          title: string;
          description: string;
          handle: string;
          featuredImage: { url: string; altText: string | null } | null;
          images: { nodes: { url: string; altText: string | null }[] };
          variants: {
            nodes: {
              id: string;
              title: string;
              sku: string | null;
              availableForSale: boolean;
              price: { amount: string; currencyCode: string };
              compareAtPrice: { amount: string; currencyCode: string } | null;
              quantityAvailable: number | null;
            }[];
          };
        };
      }[];
    };
  };
  errors?: { message: string }[];
};

async function storefrontGraphql<TData>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const res = await fetch(storefrontEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": getStorefrontToken(),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Storefront API HTTP ${res.status}: ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json()) as {
    data?: TData;
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(
      `Storefront GraphQL: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }
  if (!json.data) {
    throw new Error("Storefront GraphQL: empty data");
  }
  return json.data;
}

/**
 * 拉取商品：标题、描述、封面图、图廊（最多 10 张）、变体价与可售/库存（Storefront 可见字段）。
 */
export async function getProducts(options?: {
  first?: number;
  after?: string | null;
}): Promise<{
  products: ShopifyProduct[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const first = Math.min(Math.max(options?.first ?? 24, 1), 100);
  const data = await storefrontGraphql<StorefrontProductsResponse["data"]>(
    PRODUCTS_QUERY,
    { first, after: options?.after ?? null }
  );

  const products: ShopifyProduct[] = (data?.products?.edges ?? []).map(
    ({ node }) => {
      const nodes = node.images?.nodes ?? [];
      const rawUrls = nodes
        .map((n) => (n.url ? String(n.url).trim() : ""))
        .filter(Boolean);
      const seenUrl = new Set<string>();
      const imageUrls = rawUrls.filter((u) => {
        if (seenUrl.has(u)) return false;
        seenUrl.add(u);
        return true;
      });
      const imageUrl =
        node.featuredImage?.url ??
        nodes[0]?.url ??
        imageUrls[0] ??
        null;
      const imageAlt =
        node.featuredImage?.altText ?? nodes[0]?.altText ?? null;
      return {
        id: node.id,
        title: node.title,
        description: node.description,
        handle: node.handle,
        imageUrl,
        imageUrls,
        imageAlt,
        variants: (node.variants?.nodes ?? []).map((v) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          availableForSale: v.availableForSale,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          quantityAvailable: v.quantityAvailable,
        })),
      };
    }
  );

  return {
    products,
    pageInfo: {
      hasNextPage: data?.products?.pageInfo?.hasNextPage ?? false,
      endCursor: data?.products?.pageInfo?.endCursor ?? null,
    },
  };
}

// --- Storefront: cart ---

const CART_CREATE = /* GraphQL */ `
  mutation CreateCart($input: CartInput) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export type CreateCartLine = {
  merchandiseId: string;
  quantity: number;
};

/**
 * 创建空购物车，或带初始行。`merchandiseId` 为 ProductVariant 的 GID（来自 getProducts 的 variant.id）。
 */
export async function createCart(lines?: CreateCartLine[]): Promise<{
  cartId: string;
  checkoutUrl: string;
  totalQuantity: number;
  total: { amount: string; currencyCode: string } | null;
}> {
  const lineItems =
    lines?.map((l) => ({
      merchandiseId: l.merchandiseId,
      quantity: l.quantity,
    })) ?? [];

  const data = await storefrontGraphql<{
    cartCreate: {
      cart: {
        id: string;
        checkoutUrl: string;
        totalQuantity: number;
        cost: { totalAmount: { amount: string; currencyCode: string } } | null;
      } | null;
      userErrors: { field: string[] | null; message: string; code?: string }[];
    };
  }>(CART_CREATE, {
    input: { lines: lineItems },
  });

  const errs = data.cartCreate.userErrors;
  if (errs?.length) {
    throw new Error(
      `cartCreate: ${errs.map((e) => e.message).join("; ")}`
    );
  }

  const cart = data.cartCreate.cart;
  if (!cart) {
    throw new Error("cartCreate: no cart returned");
  }

  return {
    cartId: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    total: cart.cost?.totalAmount ?? null,
  };
}

/**
 * 逻辑骨架：若你在 Next.js 内用 **Shopify 托管结账** 收款，可在用户备妥后重定向到该 URL。
 * 若你在应用内用 **Stripe** 收款，应忽略此 URL，在支付成功后改为调用 `createPaidOrderInShopify`。
 */
export async function getStorefrontCheckoutUrlForCart(
  cartId: string
): Promise<string> {
  // 简单做法：cartCreate 已返回 checkoutUrl；若仅持有 cartId，可再查 cart
  const CART_QUERY = /* GraphQL */ `
    query GetCart($id: ID!) {
      cart(id: $id) {
        id
        checkoutUrl
      }
    }
  `;
  const data = await storefrontGraphql<{
    cart: { id: string; checkoutUrl: string } | null;
  }>(CART_QUERY, { id: cartId });
  if (!data.cart?.checkoutUrl) {
    throw new Error("Cart not found or missing checkoutUrl.");
  }
  return data.cart.checkoutUrl;
}

// --- Admin: 在 Stripe 成功收款后，静默建「已支付」订单（供仓库/应用发货）---

export type ShopifyAddressInput = {
  first_name: string;
  last_name: string;
  address1: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
};

export type StripeMirroredLineItem = {
  /** `gid://shopify/ProductVariant/...` 或纯数字 */
  shopifyVariantId: string;
  quantity: number;
  /** 与 Stripe 实收一致的单价（店铺货币），不传则用目录价 */
  unitPrice?: string;
};

export type StripeShippingLineInput = {
  title: string;
  price: string;
  code?: string;
};

export type CreatePaidOrderInShopifyInput = {
  stripeReference: {
    paymentIntentId?: string;
    checkoutSessionId?: string;
  };
  email: string;
  lineItems: StripeMirroredLineItem[];
  totalAmount: string;
  currencyCode: string;
  shippingAddress?: ShopifyAddressInput;
  billingAddress?: ShopifyAddressInput;
  shippingLines?: StripeShippingLineInput[];
  taxAmount?: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
  };
  shopifyCustomerId?: string;
  noteAttributes?: { name: string; value: string }[];
  sendReceipt?: boolean;
  /** 默认 Stripe；平台余额可传 `wallet` */
  paymentSource?: "stripe" | "wallet";
  /** 写进 `transactions[].gateway`；不填则按 paymentSource 用 `Stripe` 或 `Axelerate` */
  transactionGateway?: string;
  /**
   * 追加到 Shopify 订单 `tags`（逗号分隔），通常来自后台商品 `tags`；与内置 `nextjs,…,axelerate-mirror` 合并去重。
   */
  additionalMirrorTags?: string;
};

type AdminOrderRestResponse = {
  order?: {
    id: number;
    name: string;
    financial_status: string;
  };
  errors?: string | Record<string, unknown>;
};

type AdminCustomersSearchResponse = {
  customers?: { id: number }[];
};

type AdminCustomerCreateResponse = {
  customer?: { id: number };
  errors?: string | Record<string, unknown>;
};

function getOrderInventoryBehaviour(): string {
  const v = process.env.SHOPIFY_ORDER_INVENTORY_BEHAVIOUR?.trim();
  if (
    v === "bypass" ||
    v === "decrement_ignoring_policy" ||
    v === "decrement_obeying_policy"
  ) {
    return v;
  }
  /** 外部已收款镜像单：避免 Shopify 侧「无 Available」时整单 422 */
  return "decrement_ignoring_policy";
}

/**
 * 按 email 查或创建 Shopify Customer。若 **创建** 返回 403（未授予或未批准 `write_customers`），则返回 `null`，由调用方仅用 `order.email` 建单。
 */
export async function findOrCreateShopifyCustomerForOrderMirror(
  p: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
  }
): Promise<string | null> {
  const token = getAdminToken();
  const searchUrl = new URL(adminRestEndpoint("/customers/search.json"));
  searchUrl.searchParams.set("query", `email:${p.email}`);
  searchUrl.searchParams.set("fields", "id,email");

  const getRes = await fetch(searchUrl.toString(), {
    headers: { "X-Shopify-Access-Token": token },
    cache: "no-store",
  });
  const getText = await getRes.text();
  let getBody: AdminCustomersSearchResponse;
  try {
    getBody = JSON.parse(getText) as AdminCustomersSearchResponse;
  } catch {
    throw new Error(
      `Shopify customers/search non-JSON (${getRes.status}): ${getText.slice(0, 400)}`
    );
  }
  if (getRes.ok && getBody.customers?.[0]?.id != null) {
    return String(getBody.customers[0].id);
  }

  const phone = p.phone?.replace(/\s/g, "").slice(0, 25) || undefined;
  const postRes = await fetch(adminRestEndpoint("/customers.json"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({
      customer: {
        email: p.email,
        first_name: p.first_name.slice(0, 255) || "Customer",
        last_name: p.last_name.slice(0, 255) || "-",
        phone: phone || undefined,
        verified_email: true,
        send_email_welcome: false,
      },
    }),
    cache: "no-store",
  });
  const postText = await postRes.text();
  let postBody: AdminCustomerCreateResponse;
  try {
    postBody = JSON.parse(postText) as AdminCustomerCreateResponse;
  } catch {
    throw new Error(
      `Shopify customers create non-JSON (${postRes.status}): ${postText.slice(0, 500)}`
    );
  }
  if (postRes.ok && postBody.customer?.id != null) {
    return String(postBody.customer.id);
  }
  if (postRes.status === 403) {
    console.warn(
      "[shopify] customers.json POST 403 (need write_customers + merchant approval). " +
        "Order mirror will use email only without customer id. " +
        postText.slice(0, 300)
    );
    return null;
  }
  if (postRes.status === 422) {
    const retry = await fetch(searchUrl.toString(), {
      headers: { "X-Shopify-Access-Token": token },
      cache: "no-store",
    });
    const retryText = await retry.text();
    const retryBody = JSON.parse(retryText) as AdminCustomersSearchResponse;
    if (retryBody.customers?.[0]?.id != null) {
      return String(retryBody.customers[0].id);
    }
  }
  throw new Error(
    `Shopify customers create failed ${postRes.status}: ${postText.slice(0, 800)}`
  );
}

/**
 * Stripe → Shopify 已支付镜像单：扣库存、客户、账单/发货地址、运费与税费、 transactions。
 * `fulfillment_status` 建单时不可写；新单默认 unfulfilled。
 */
export async function createPaidOrderInShopify(
  input: CreatePaidOrderInShopifyInput
): Promise<{
  orderId: string;
  orderName: string;
  financialStatus: string;
}> {
  const { stripeReference, email, lineItems, totalAmount, currencyCode } =
    input;

  const line_items = lineItems.map((li) => {
    const idStr = parseVariantIdForRest(li.shopifyVariantId);
    const n = Number(idStr);
    if (!Number.isSafeInteger(n)) {
      throw new Error(
        `shopify variant_id ${idStr} outside JS safe integer; use a smaller test variant or implement GraphQL orderCreate`
      );
    }
    const row: Record<string, unknown> = { variant_id: n, quantity: li.quantity };
    if (li.unitPrice != null && li.unitPrice !== "") {
      row.price = li.unitPrice;
    }
    return row;
  });

  let customerNumericId: number | undefined;
  if (input.shopifyCustomerId) {
    const c = String(input.shopifyCustomerId).trim();
    if (/^\d+$/.test(c)) {
      const n = Number(c);
      if (Number.isSafeInteger(n)) customerNumericId = n;
    }
  } else if (input.customer) {
    const c = input.customer;
    const idStr = await findOrCreateShopifyCustomerForOrderMirror({
      email: c.email,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
    });
    if (idStr != null) {
      const n = Number(idStr);
      if (Number.isSafeInteger(n)) customerNumericId = n;
    }
  }

  const isWallet = input.paymentSource === "wallet";
  const noteLine0 = isWallet
    ? "Paid via Axelerate wallet (Next.js)."
    : "Paid via external Stripe (Next.js).";
  const noteParts = [
    noteLine0,
    `charged=${totalAmount} ${currencyCode}`,
    stripeReference.checkoutSessionId
      ? `session=${stripeReference.checkoutSessionId}`
      : null,
    stripeReference.paymentIntentId
      ? `pi=${stripeReference.paymentIntentId}`
      : null,
  ].filter(Boolean);

  const noteAttrs: { name: string; value: string }[] = [
    { name: "payment_gateway", value: isWallet ? "axelerate_wallet" : "stripe" },
    ...(input.noteAttributes ?? []),
  ];
  if (input.stripeReference.checkoutSessionId) {
    noteAttrs.push({
      name: isWallet ? "internal_ref" : "stripe_checkout_session",
      value: input.stripeReference.checkoutSessionId,
    });
  }

  const tagWallet = isWallet ? "wallet" : "stripe-mirrored";
  const mergedTagStr = mergeShopifyCommaTags([
    `nextjs,${tagWallet},inventory-sync,axelerate-mirror`,
    input.additionalMirrorTags?.trim() ?? "",
  ]);

  const order: Record<string, unknown> = {
    email,
    line_items,
    send_receipt: input.sendReceipt ?? false,
    financial_status: "paid",
    note: noteParts.join(" | "),
    tags: mergedTagStr || `nextjs,${tagWallet},inventory-sync,axelerate-mirror`,
    inventory_behaviour: getOrderInventoryBehaviour(),
    note_attributes: noteAttrs,
  };

  if (customerNumericId != null) {
    order.customer = { id: customerNumericId };
  }
  if (input.shippingAddress) {
    order.shipping_address = input.shippingAddress;
  }
  if (input.billingAddress) {
    order.billing_address = input.billingAddress;
  }
  if (input.shippingLines && input.shippingLines.length > 0) {
    // REST 可接受最简 { title, price }；有 code 时一并带上便于后台筛选
    order.shipping_lines = input.shippingLines.map((s) => {
      const row: Record<string, string> = { title: s.title, price: s.price };
      if (s.code) {
        row.code = s.code;
        row.source = "shopify";
      }
      return row;
    });
  }
  if (
    input.taxAmount != null &&
    input.taxAmount !== "" &&
    input.taxAmount !== "0" &&
    input.taxAmount !== "0.00"
  ) {
    order.taxes_included = false;
    order.tax_lines = [
      {
        title: isWallet ? "Tax" : "Tax (from Stripe)",
        price: input.taxAmount,
        rate: 0,
      },
    ];
  }

  const txGateway =
    input.transactionGateway?.trim() ||
    (isWallet ? "Axelerate" : "Stripe");

  order.transactions = [
    {
      kind: "sale" as const,
      status: "success" as const,
      amount: totalAmount,
      currency: currencyCode,
      gateway: txGateway,
    },
  ];

  const orderPayload = { order };

  const res = await fetch(adminRestEndpoint("/orders.json"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": getAdminToken(),
    },
    body: JSON.stringify(orderPayload),
    cache: "no-store",
  });

  const text = await res.text();
  let body: AdminOrderRestResponse;
  try {
    body = JSON.parse(text) as AdminOrderRestResponse;
  } catch {
    throw new Error(`Admin REST order create: non-JSON (${res.status}): ${text.slice(0, 400)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Admin REST order create failed ${res.status}: ${text.slice(0, 800)}`
    );
  }

  if (body.errors) {
    throw new Error(
      `Admin order errors: ${typeof body.errors === "string" ? body.errors : JSON.stringify(body.errors)}`
    );
  }

  if (!body.order) {
    throw new Error("Admin order create: empty order in response");
  }

  try {
    await moveMirrorOrderFulfillmentToVendorIfConfigured(String(body.order.id));
  } catch (e) {
    console.warn("[shopify] mirror fulfillment vendor location move:", e);
  }

  return {
    orderId: String(body.order.id),
    orderName: body.order.name,
    financialStatus: body.order.financial_status,
  };
}
