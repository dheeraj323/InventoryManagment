import { create } from 'zustand';
import { Product, Supplier } from '../types';
import { MOCK_PRODUCTS, MOCK_SUPPLIERS } from '../constants/mockData';
import { productService } from '../services/productService';
import { supplierService } from '../services/supplierService';

interface InventoryState {
  products: Product[];
  suppliers: Supplier[];
  isLoading: boolean;
  fetchProducts: () => Promise<void>;
  subscribeInventory: () => () => void;
  updateStock: (productId: string, newStock: number) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  getLowStockProducts: () => Product[];
  getProductById: (id: string) => Product | undefined;
  getInventoryStats: () => {
    totalCount: number;
    healthyCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValuation: number;
  };
}

// Debounce timers map for inventory stock syncing
const stockDebounceTimers: { [productId: string]: ReturnType<typeof setTimeout> } = {};

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: MOCK_PRODUCTS,
  suppliers: MOCK_SUPPLIERS,
  isLoading: false,

  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      const prods = await productService.getProducts();
      if (prods && prods.length > 0) {
        set({ products: prods });
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  subscribeInventory: () => {
    const unsubProducts = productService.subscribeProducts((firestoreProds) => {
      if (firestoreProds && firestoreProds.length > 0) {
        set({ products: firestoreProds });
      }
    });

    const unsubSuppliers = supplierService.subscribeSuppliers((firestoreSups) => {
      if (firestoreSups && firestoreSups.length > 0) {
        set({ suppliers: firestoreSups });
      }
    });

    return () => {
      unsubProducts();
      unsubSuppliers();
    };
  },

  updateStock: async (productId: string, newStock: number) => {
    const previousProducts = get().products;
    const safeStock = Math.max(0, newStock);

    // 1. Instant optimistic state update with 0 delay
    set({
      products: previousProducts.map((p) =>
        p.id === productId ? { ...p, stockQty: safeStock, availableStock: safeStock } : p
      ),
    });

    // 2. Debounce Firestore write to allow seamless rapid taps
    if (stockDebounceTimers[productId]) {
      clearTimeout(stockDebounceTimers[productId]);
    }

    stockDebounceTimers[productId] = setTimeout(async () => {
      try {
        await productService.updateStock(productId, safeStock);
      } catch (err) {
        console.error('Error updating product stock in Firestore:', err);
      } finally {
        delete stockDebounceTimers[productId];
      }
    }, 450);
  },

  addProduct: async (productData) => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
    };
    set({ products: [...get().products, newProduct] });

    try {
      await productService.addProduct(productData);
    } catch (err) {
      console.error('Error adding product to Firestore:', err);
    }
  },

  getLowStockProducts: () => {
    return get().products.filter(
      (p) => p.stockQty <= p.lowStockThreshold && p.stockQty > 0
    );
  },

  getProductById: (id: string) => {
    return get().products.find((p) => p.id === id);
  },

  getInventoryStats: () => {
    const prods = get().products;
    let healthyCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValuation = 0;

    for (const p of prods) {
      const stock = p.stockQty || 0;
      const threshold = p.lowStockThreshold || 0;
      const price = p.price || 0;

      totalValuation += stock * price;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= threshold) {
        lowStockCount++;
      } else {
        healthyCount++;
      }
    }

    return {
      totalCount: prods.length,
      healthyCount,
      lowStockCount,
      outOfStockCount,
      totalValuation,
    };
  },
}));
