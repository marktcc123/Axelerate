import type { CartLine } from "@/lib/perks-order-fulfill";

/**
 * Stripe `metadata.cart`：新格式 `productId|qty|shopifyVariantId`（variant 可选），
 * 逗号分隔多行。兼容旧格式 `productId:qty`（UUID 最后一处冒号右侧为数量）。
 */
export function formatCartMetadataLine(
  productId: string,
  quantity: number,
  shopifyVariantId?: string | null
): string {
  const q = Math.max(1, Math.floor(quantity));
  const v = shopifyVariantId?.trim();
  if (v) {
    return `${productId}|${q}|${v}`;
  }
  return `${productId}|${q}`;
}

export function encodeCartMetadataFromLines(lines: CartLine[]): string {
  return lines
    .map((c) => formatCartMetadataLine(c.id, c.quantity, c.shopifyVariantId))
    .join(",");
}

export function parseCartMetadata(cartRaw: string): CartLine[] {
  if (!cartRaw?.trim()) return [];
  return cartRaw
    .split(",")
    .map((seg) => {
      const s = seg.trim();
      if (!s) return null;
      if (s.includes("|")) {
        const p = s.split("|");
        if (p.length === 2) {
          return {
            id: p[0]!,
            quantity: Math.max(1, Math.floor(Number(p[1]) || 1)),
          } satisfies CartLine;
        }
        if (p.length >= 3) {
          return {
            id: p[0]!,
            quantity: Math.max(1, Math.floor(Number(p[1]) || 1)),
            shopifyVariantId: p[2]!.trim(),
          } satisfies CartLine;
        }
      }
      const idx = s.lastIndexOf(":");
      if (idx === -1) return { id: s, quantity: 1 };
      const id = s.slice(0, idx);
      const quantity = Math.max(1, Math.floor(Number(s.slice(idx + 1)) || 1));
      return { id, quantity };
    })
    .filter((x): x is CartLine => x != null);
}
