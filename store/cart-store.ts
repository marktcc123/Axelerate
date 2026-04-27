import { create } from "zustand";
import type { Product } from "@/lib/types";
import {
  findVariantInSpecifications,
  getDefaultVariantId,
  getVariantInventory,
  parseProductSpecifications,
  resolveVariantIdForCheckout,
} from "@/lib/shopify/product-specifications";

export interface CartItem {
  /** `${productId}::${shopifyVariantId|default}`，用于区分同商品多规格行 */
  lineKey: string;
  product: Product;
  quantity: number;
  /** Shopify 变体 id；无多规格时可为与后台一致的默认变体或 null */
  shopifyVariantId: string | null;
  variantLabel: string | null;
}

export function makeCartLineKey(productId: string, shopifyVariantId: string | null): string {
  const v = shopifyVariantId?.trim() || "default";
  return `${productId}::${v}`;
}

function maxQtyForLine(product: Product, shopifyVariantId: string | null): number {
  const spec = parseProductSpecifications(product.specifications);
  const vid = shopifyVariantId || resolveVariantIdForCheckout(spec, null);
  if (spec?.shopify_variants.length && vid) {
    const inv = getVariantInventory(spec, vid);
    if (inv != null) return Math.max(0, inv);
  }
  return Math.max(0, product.stock_count);
}

type AddOptions = {
  /** 若未传则使用 specifications 中默认变体 */
  shopifyVariantId?: string | null;
  variantLabel?: string | null;
};

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, options?: AddOptions) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  removeItem: (lineKey: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],

  addItem: (product, quantity = 1, options) =>
    set((state) => {
      const spec = parseProductSpecifications(product.specifications);
      const requested = options?.shopifyVariantId?.trim() ?? null;
      const validRequested =
        requested && spec && findVariantInSpecifications(spec, requested)
          ? requested
          : null;
      const shopifyVariantId =
        validRequested ?? getDefaultVariantId(spec);
      const lineKey = makeCartLineKey(product.id, shopifyVariantId);
      const label =
        options?.variantLabel?.trim() ||
        (shopifyVariantId && spec
          ? (findVariantInSpecifications(spec, shopifyVariantId)?.title ?? null)
          : null);

      const cap = maxQtyForLine(product, shopifyVariantId);
      if (cap <= 0) {
        return state;
      }

      const existing = state.items.find((i) => i.lineKey === lineKey);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, cap);
        return {
          items: state.items.map((i) =>
            i.lineKey === lineKey ? { ...i, quantity: newQty } : i
          ),
        };
      }
      const qty = Math.min(quantity, cap);
      return {
        items: [
          ...state.items,
          {
            lineKey,
            product,
            quantity: qty,
            shopifyVariantId,
            variantLabel: label,
          },
        ],
      };
    }),

  updateQuantity: (lineKey, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.lineKey !== lineKey) };
      }
      const item = state.items.find((i) => i.lineKey === lineKey);
      if (!item) return state;
      const cap = maxQtyForLine(item.product, item.shopifyVariantId);
      const capped = Math.min(quantity, cap);
      return {
        items: state.items.map((i) =>
          i.lineKey === lineKey ? { ...i, quantity: capped } : i
        ),
      };
    }),

  removeItem: (lineKey) =>
    set((state) => ({
      items: state.items.filter((i) => i.lineKey !== lineKey),
    })),

  clearCart: () => set({ items: [] }),
}));
