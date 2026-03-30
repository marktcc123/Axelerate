/**
 * 将 profiles.shipping_address JSON 或订单上的 snapshot 格式化为多行文本。
 */
export function formatShippingAddressPayload(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      return formatShippingAddressPayload(JSON.parse(t) as unknown);
    } catch {
      return t;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const line1 = String(o.address_line1 ?? o.addressLine1 ?? "").trim();
    const line2 = String(o.address_line2 ?? "").trim();
    const city = String(o.city ?? "").trim();
    const state = String(o.state ?? "").trim();
    const zip = String(o.zip_code ?? o.zipCode ?? o.zip ?? "").trim();
    const cityLine = [city, state, zip].filter(Boolean).join(", ");
    const parts = [line1, line2, cityLine].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  }
  return null;
}
