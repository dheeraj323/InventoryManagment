import { create } from 'zustand';
import { Product, Supplier } from '../types';
import { MOCK_PRODUCTS, MOCK_SUPPLIERS } from '../constants/mockData';
import { productService } from '../services/productService';
import { supplierService } from '../services/supplierService';

interface InventoryState {
  products: Product[];
  suppliers: Supplier[];
  isLoading: boolean;
  subscribeInventory: () => () => void;
  updateStock: (productId: string, newStock: number) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  getLowStockProducts: () => Product[];
  getProductById: (id: string) => Product | undefined;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: MOCK_PRODUCTS,
  suppliers: MOCK_SUPPLIERS,
  isLoading: false,

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
    set({
      products: get().products.map((p) =>
        p.id === productId ? { ...p, stockQty: Math.max(0, newStock) } : p
      ),
    });

    try {
      await productService.updateStock(productId, newStock);
    } catch (err) {
      console.error('Error updating product stock in Firestore:', err);
    }
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
    return get().products.filter((p) => p.stockQty <= p.lowStockThreshold);
  },

  getProductById: (id: string) => {
    return get().products.find((p) => p.id === id);
  },
}));
