/**
 * 安全解析图片 URL，兼容残缺的 Unsplash 链接
 */
export function getValidImageUrl(url?: string | null): string {
  if (!url || typeof url !== "string" || !url.trim()) {
    return "/placeholder.svg";
  }
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  // 残缺的 Unsplash 链接（如 photo-1550009158-9ebf6d250400）自动补全前缀
  return `https://images.unsplash.com/${trimmed.startsWith("/") ? trimmed.slice(1) : trimmed}`;
}
