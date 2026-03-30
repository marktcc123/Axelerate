import { create } from "zustand";
import type { Product } from "@/lib/types";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],

  addItem: (product, quantity = 1) =>
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id);
      if (existing) {
        const newQty = Math.min(
          existing.quantity + quantity,
          product.stock_count
        );
        return {
          items: state.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: newQty } : i
          ),
        };
      }
      const qty = Math.min(quantity, product.stock_count);
      return { items: [...state.items, { product, quantity: qty }] };
    }),

  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.product.id !== productId) };
      }
      const item = state.items.find((i) => i.product.id === productId);
      if (!item) return state;
      const capped = Math.min(quantity, item.product.stock_count);
      return {
        items: state.items.map((i) =>
          i.product.id === productId ? { ...i, quantity: capped } : i
        ),
      };
    }),

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.product.id !== productId),
    })),

  clearCart: () => set({ items: [] }),
}));
