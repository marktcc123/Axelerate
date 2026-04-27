import "server-only";

/**
 * 从 `scripts/sync-shopify-products.ts` 写入的 `specifications.shopify_variants[0].id` 等结构取默认变体 ID（数字或 GID 字符串均可再交给 `parseVariantIdForRest`）。
 */
export function getDefaultShopifyVariantIdFromProduct(
  specifications: unknown
): string | null {
  if (!specifications || typeof specifications !== "object") return null;
  const s = specifications as { shopify_variants?: { id?: string | null }[] };
  const first = s.shopify_variants?.[0]?.id;
  if (first == null) return null;
  const t = String(first).trim();
  return t.length > 0 ? t : null;
}

export function encodeDropshipLineMetadata(
  lines: { shopifyVariantId: string; quantity: number }[]
): string {
  return lines
    .map((l) => {
      const id = l.shopifyVariantId.trim();
      if (id.includes("|") || id.includes(":")) {
        throw new Error("Shopify variant id for metadata must not contain | or :");
      }
      return `${id}:${l.quantity}`;
    })
    .join("|");
}

export function parseDropshipLineMetadata(
  raw: string | null | undefined
): { shopifyVariantId: string; quantity: number }[] {
  if (!raw?.trim()) return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((seg) => {
      const u = seg.lastIndexOf(":");
      if (u === -1) {
        return { shopifyVariantId: seg, quantity: 1 };
      }
      const id = seg.slice(0, u);
      const q = Math.max(1, Math.floor(Number(seg.slice(u + 1)) || 1));
      return { shopifyVariantId: id, quantity: q };
    });
}
