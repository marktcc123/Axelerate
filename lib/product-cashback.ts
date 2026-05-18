/**
 * Catalog cashback rate (0–100). Aligns with `products.credit_cashback_percent`
 * defaults in DB / fulfillment (`?? 10` when unset).
 */
export function getProductCreditCashbackPercent(product: {
  credit_cashback_percent?: number | null;
}): number {
  const raw = product.credit_cashback_percent;
  if (raw == null) return 10;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(100, Math.round(n)));
}
