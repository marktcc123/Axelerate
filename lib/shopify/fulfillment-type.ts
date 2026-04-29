/**
 * 与 Shopify 同步写入的 `products.fulfillment_type` 常见取值。
 * 业务上「是否代发」等分类若与 Shopify 不一致，应以 Shopify 标签/Metafield 映射为准，并靠 Webhook 回写本字段。
 */
export function isDropshippingFulfillmentType(
  raw: string | null | undefined
): boolean {
  const t = (raw ?? "").toLowerCase().trim();
  return t === "dropshipping" || t === "dropship";
}
