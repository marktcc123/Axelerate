/**
 * Admin REST / Webhook 商品载荷中的图片提取（可与 Storefront GraphQL `images(first:10)` 行为对齐）。
 */

/** 与 GraphQL `images(first: 10)` 一致，避免一次写入过长 URL 数组 */
export const MAX_REST_PRODUCT_IMAGE_URLS = 10;

/** 从单行 Image 或未统一结构中取 URL（兼容 Webhook 摘要形态）。 */
function srcFromLooseImage(im: unknown): string | null {
  if (!im || typeof im !== "object") return null;
  const o = im as { src?: string };
  const s = o.src ? String(o.src).trim() : "";
  return s || null;
}

/** REST：`featured_image`、`image.src`、否则 `images[0].src`。用于 `image_url` 封面字段。 */
export function pickFirstRestProductImage(product: {
  featured_image?: string | null;
  image?: { src?: string } | string | null;
  images?: ({ src?: string } | null)[] | null;
}): string | null {
  const ff = typeof product.featured_image === "string" ? product.featured_image.trim() : "";
  if (ff) return ff;
  if (typeof product.image === "string") {
    const u = product.image.trim();
    return u || null;
  }
  if (product.image?.src) {
    const u = String(product.image.src).trim();
    return u || null;
  }
  const firstImg = product.images?.[0];
  return srcFromLooseImage(firstImg) ?? null;
}

function dedupePreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** 遍历 `images[].src`；为空时退化为单张首图。最多保留 {@link MAX_REST_PRODUCT_IMAGE_URLS} 条。 */
export function pickAllRestProductImageSrcs(product: {
  featured_image?: string | null;
  image?: { src?: string } | string | null;
  images?: ({ src?: string } | null)[] | null;
}): string[] {
  const fromImages = (product.images ?? [])
    .map((im) => srcFromLooseImage(im))
    .filter((u): u is string => Boolean(u));
  const ordered = dedupePreserveOrder(fromImages);
  const capped = ordered.slice(0, MAX_REST_PRODUCT_IMAGE_URLS);
  if (capped.length > 0) return capped;
  const one = pickFirstRestProductImage(product);
  return one ? [one].slice(0, MAX_REST_PRODUCT_IMAGE_URLS) : [];
}
