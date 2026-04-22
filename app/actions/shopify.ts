"use server";

/**
 * 商品目录与 Storefront 购物车仅通过 Server Action 向客户端暴露；
 * 含 Admin 令牌的 `createPaidOrderInShopify` 请仅在 Route Handler（Stripe webhook）或内网任务中从 `@/lib/shopify/api` 直接引用，不要在此文件中导出，以免被误用为可调用 Action。
 */
import {
  getProducts,
  createCart,
  getStorefrontCheckoutUrlForCart,
  type CreateCartLine,
} from "@/lib/shopify/api";

export async function fetchShopifyProductCatalog() {
  return getProducts({ first: 24 });
}

export async function startShopifyCart(lines?: CreateCartLine[]) {
  return createCart(lines);
}

export async function resolveShopifyCheckoutUrl(cartId: string) {
  return getStorefrontCheckoutUrlForCart(cartId);
}
