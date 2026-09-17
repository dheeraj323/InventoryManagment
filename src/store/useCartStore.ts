import { create } from 'zustand';
import { Product, OrderItem } from '../types';
import { BUSINESS_RULES } from '../constants/rules';

interface CartItem extends OrderItem {}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, delta: number) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product: Product, qty = 1) => {
    const existing = get().items.find((item) => item.productId === product.id);
    if (existing) {
      set({
        items: get().items.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                orderedQty: item.orderedQty + qty,
                deliveredQty: item.orderedQty + qty,
                totalAmount: (item.orderedQty + qty) * item.unitPrice,
              }
            : item
        ),
      });
    } else {
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${product.id}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        unitPrice: product.price,
        orderedQty: qty,
        deliveredQty: qty,
        missingDamagedQty: 0,
        totalAmount: qty * product.price,
      };
      set({ items: [...get().items, newItem] });
    }
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter((item) => item.productId !== productId) });
  },

  updateQty: (productId: string, delta: number) => {
    const items = get().items;
    const item = items.find((i) => i.productId === productId);
    if (!item) return;

    const newQty = item.orderedQty + delta;
    if (newQty <= 0) {
      set({ items: items.filter((i) => i.productId !== productId) });
    } else {
      set({
        items: items.map((i) =>
          i.productId === productId
            ? {
                ...i,
                orderedQty: newQty,
                deliveredQty: newQty,
                totalAmount: newQty * i.unitPrice,
              }
            : i
        ),
      });
    }
  },

  setQty: (productId: string, qty: number) => {
    if (qty <= 0) {
      set({ items: get().items.filter((i) => i.productId !== productId) });
    } else {
      set({
        items: get().items.map((i) =>
          i.productId === productId
            ? {
                ...i,
                orderedQty: qty,
                deliveredQty: qty,
                totalAmount: qty * i.unitPrice,
              }
            : i
        ),
      });
    }
  },

  clearCart: () => set({ items: [] }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.totalAmount, 0);
  },

  getTax: () => {
    return get().getSubtotal() * BUSINESS_RULES.TAX_RATE;
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTax();
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.orderedQty, 0);
  },
}));
