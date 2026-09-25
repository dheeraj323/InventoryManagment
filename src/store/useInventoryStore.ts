import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Supplier } from '../types';
import { productService } from '../services/productService';
import { supplierService } from '../services/supplierService';

const CACHE_KEY_PRODUCTS = '@inventory_products_cache';
const CACHE_KEY_VERSION = '@inventory_products_version';
const CACHE_KEY_TIMESTAMP = '@inventory_products_last_sync';

interface InventoryState {
  products: Product[];
  suppliers: Supplier[];
  isLoading: boolean;
  isSyncing: boolean;
  cachedVersion: number;
  lastSyncTime: string | null;
  initInventoryCache: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  refreshCatalog: (force?: boolean) => Promise<void>;
  mergeLiveStock: (stockMap: Record<string, number>) => void;
  subscribeLiveStock: () => () => void;
  subscribeInventory: () => () => void;
  updateStock: (productId: string, newStock: number) => Promise<void>;
  bulkUpdateStock: (updates: { productId: string; addedQty: number }[]) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  getLowStockProducts: () => Product[];
  getProductById: (id: string) => Product | undefined;
  getSupplierById: (id: string) => Supplier | undefined;
  addSupplier: (supplier: Partial<Supplier>) => Promise<Supplier>;
  updateSupplier: (supplierId: string, updates: Partial<Supplier>) => Promise<void>;
  adjustSupplierPayable: (
    supplierId: string,
    amountDelta: number,
    type: 'ADD_BILL' | 'RECORD_PAYMENT' | 'SET_BALANCE',
    reason?: string
  ) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
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

// Helper to persist products to AsyncStorage asynchronously
const saveProductsToLocalCache = async (products: Product[], version?: number) => {
  try {
    const pairs: [string, string][] = [
      [CACHE_KEY_PRODUCTS, JSON.stringify(products)],
      [CACHE_KEY_TIMESTAMP, new Date().toISOString()],
    ];
    if (version !== undefined) {
      pairs.push([CACHE_KEY_VERSION, String(version)]);
    }
    await AsyncStorage.multiSet(pairs);
  } catch (err) {
    console.warn('Failed to save products to AsyncStorage cache:', err);
  }
};

export const useInventoryStore = create<InventoryState>((set, get) => ({
  products: [],
  suppliers: [],
  isLoading: false,
  isSyncing: false,
  cachedVersion: 0,
  lastSyncTime: null,

  // 1. Hybrid App Initialization: Instant Local Read + 1 Firestore Read Check
  initInventoryCache: async () => {
    set({ isSyncing: true });
    let localVersion = get().cachedVersion;
    let hasLocalProducts = false;

    // Step A: Load instantly from AsyncStorage (0ms Firestore cost, offline friendly)
    try {
      const [[, cachedProdsJson], [, cachedVerStr], [, lastSync]] = await AsyncStorage.multiGet([
        CACHE_KEY_PRODUCTS,
        CACHE_KEY_VERSION,
        CACHE_KEY_TIMESTAMP,
      ]);

      if (cachedVerStr) {
        localVersion = parseInt(cachedVerStr, 10) || 0;
      }

      if (cachedProdsJson) {
        const parsed = JSON.parse(cachedProdsJson) as Product[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          hasLocalProducts = true;
          set({
            products: parsed,
            cachedVersion: localVersion,
            lastSyncTime: lastSync || null,
          });
        }
      }
    } catch (err) {
      console.warn('Error reading products from AsyncStorage:', err);
    }

    // Step B: Check metadata version in Firestore (Exactly 1 Read)
    try {
      const remoteMeta = await productService.getProductsMetadata();

      if (remoteMeta) {
        const remoteVersion = remoteMeta.productsVersion || 1;

        if (hasLocalProducts && localVersion === remoteVersion) {
          // Version is identical -> Keep local cache (0 additional reads!)
          set({
            cachedVersion: remoteVersion,
            isSyncing: false,
          });
          return;
        }

        // Version changed or no local cache -> Fetch all products and update storage
        const prods = await productService.getProducts();
        if (prods && prods.length > 0) {
          set({
            products: prods,
            cachedVersion: remoteVersion,
            lastSyncTime: new Date().toISOString(),
          });
          await saveProductsToLocalCache(prods, remoteVersion);
        }
      } else if (!hasLocalProducts) {
        // Fallback: If metadata not found and no local cache, fetch products
        const prods = await productService.getProducts();
        if (prods && prods.length > 0) {
          set({ products: prods, cachedVersion: 1 });
          await saveProductsToLocalCache(prods, 1);
        }
      }
    } catch (err) {
      console.warn('Error syncing inventory metadata version:', err);
    } finally {
      set({ isSyncing: false, isLoading: false });
    }
  },

  // 2. Fetch products (Delegates to smart init / refresh)
  fetchProducts: async () => {
    await get().initInventoryCache();
  },

  // 3. Manual "Refresh Catalog" / Force reload from Firestore
  refreshCatalog: async (force = true) => {
    set({ isLoading: true });
    try {
      if (force) {
        const [prods, remoteMeta] = await Promise.all([
          productService.getProducts(),
          productService.getProductsMetadata(),
        ]);
        const newVersion = remoteMeta?.productsVersion || get().cachedVersion || 1;
        if (prods && prods.length > 0) {
          set({
            products: prods,
            cachedVersion: newVersion,
            lastSyncTime: new Date().toISOString(),
          });
          await saveProductsToLocalCache(prods, newVersion);
        }
      } else {
        await get().initInventoryCache();
      }
    } catch (err) {
      console.error('Error refreshing catalog from Firestore:', err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  // 4. Merge real-time Live Stock Map into in-memory catalog
  mergeLiveStock: (stockMap: Record<string, number>) => {
    if (!stockMap || Object.keys(stockMap).length === 0) return;
    const currentProducts = get().products;
    if (currentProducts.length === 0) return;

    let hasChanges = false;
    const updatedProducts = currentProducts.map((p) => {
      const liveQty = stockMap[p.id];
      if (liveQty !== undefined && liveQty !== p.stockQty) {
        hasChanges = true;
        return {
          ...p,
          stockQty: liveQty,
          availableStock: liveQty,
        };
      }
      return p;
    });

    if (hasChanges) {
      set({ products: updatedProducts });
      saveProductsToLocalCache(updatedProducts);
    }
  },

  // 5. Subscribe to lightweight 1-document live stock map (1 Read on load + 1 Read per stock change)
  subscribeLiveStock: () => {
    return productService.subscribeLiveStock((stockMap) => {
      get().mergeLiveStock(stockMap);
    });
  },

  // 6. Real-time inventory subscription (Products + Stock Map + Suppliers)
  subscribeInventory: () => {
    // 1. Immediately read from cache if available so UI has data without delay
    get().initInventoryCache();

    // 2. Real-time listener for products catalog
    const unsubProducts = productService.subscribeProducts((prods) => {
      if (prods) {
        set({ products: prods, isLoading: false });
        saveProductsToLocalCache(prods);
      }
    });

    // 3. Subscribe to consolidated Live Stock Map (1 document)
    const unsubLiveStock = get().subscribeLiveStock();

    // 4. Subscribe to suppliers in Firestore
    const unsubSuppliers = supplierService.subscribeSuppliers((firestoreSups) => {
      set({ suppliers: firestoreSups || [] });
    });

    return () => {
      unsubProducts();
      unsubLiveStock();
      unsubSuppliers();
    };
  },

  updateStock: async (productId: string, newStock: number) => {
    const previousProducts = get().products;
    const safeStock = Math.max(0, newStock);

    // 1. Instant optimistic state update with 0 delay
    const updatedProducts = previousProducts.map((p) =>
      p.id === productId ? { ...p, stockQty: safeStock, availableStock: safeStock } : p
    );
    set({ products: updatedProducts });

    // Persist to local cache
    saveProductsToLocalCache(updatedProducts);

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

  bulkUpdateStock: async (updates: { productId: string; addedQty: number }[]) => {
    const previousProducts = get().products;
    const updateMap = new Map<string, number>();
    for (const u of updates) {
      if (u.addedQty > 0) {
        updateMap.set(u.productId, u.addedQty);
      }
    }

    if (updateMap.size === 0) return;

    // 1. Instant optimistic update across all targeted products
    const updatedProducts = previousProducts.map((p) => {
      const added = updateMap.get(p.id);
      if (added !== undefined && added > 0) {
        const newStock = Math.max(0, p.stockQty + added);
        return {
          ...p,
          stockQty: newStock,
          availableStock: newStock,
        };
      }
      return p;
    });

    set({ products: updatedProducts });
    saveProductsToLocalCache(updatedProducts);

    // 2. Commit batch write to Firestore
    try {
      const batchPayload = Array.from(updateMap.entries()).map(([productId, added]) => {
        const prod = previousProducts.find((p) => p.id === productId);
        const newStock = Math.max(0, (prod?.stockQty || 0) + added);
        return { productId, newStockQty: newStock };
      });
      await productService.bulkUpdateStock(batchPayload);
    } catch (err) {
      console.error('Error applying bulk stock update to Firestore:', err);
    }
  },

  addProduct: async (productData) => {
    try {
      const addedProduct = await productService.addProduct(productData);
      const newVersion = get().cachedVersion + 1;
      let newProducts: Product[] = [];
      set((state) => {
        const remaining = state.products.filter(
          (p) => p.id !== addedProduct.id && p.sku !== addedProduct.sku
        );
        newProducts = [addedProduct, ...remaining];
        return { products: newProducts, cachedVersion: newVersion };
      });
      saveProductsToLocalCache(newProducts, newVersion);
      return addedProduct;
    } catch (err) {
      console.error('Error adding product to Firestore:', err);
      // Fallback local addition if network/Firebase is offline
      const fallback: Product = {
        ...productData,
        id: `prod-${Date.now()}`,
        productId: `prod-${Date.now()}`,
      };
      set((state) => {
        const list = [fallback, ...state.products];
        saveProductsToLocalCache(list);
        return { products: list };
      });
      return fallback;
    }
  },

  updateProduct: async (productId: string, updates: Partial<Product>) => {
    const previousProducts = get().products;
    const newVersion = get().cachedVersion + 1;
    const updatedProducts = previousProducts.map((p) =>
      p.id === productId ? { ...p, ...updates } : p
    );
    // Optimistic update
    set({
      products: updatedProducts,
      cachedVersion: newVersion,
    });
    saveProductsToLocalCache(updatedProducts, newVersion);

    try {
      await productService.updateProduct(productId, updates);
    } catch (err) {
      console.error('Error updating product in Firestore:', err);
    }
  },

  deleteProduct: async (productId: string) => {
    const previousProducts = get().products;
    const newVersion = get().cachedVersion + 1;
    const updatedProducts = previousProducts.filter((p) => p.id !== productId);
    // Optimistic remove
    set({
      products: updatedProducts,
      cachedVersion: newVersion,
    });
    saveProductsToLocalCache(updatedProducts, newVersion);

    try {
      await productService.deleteProduct(productId);
    } catch (err) {
      console.error('Error deleting product in Firestore:', err);
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

  getSupplierById: (id: string) => {
    return get().suppliers.find((s) => s.id === id || s.supplierId === id);
  },

  addSupplier: async (supplierData: Partial<Supplier>) => {
    const newSupplier = await supplierService.addSupplier(supplierData);
    set({ suppliers: [...get().suppliers, newSupplier] });
    return newSupplier;
  },

  updateSupplier: async (supplierId: string, updates: Partial<Supplier>) => {
    set({
      suppliers: get().suppliers.map((s) =>
        s.id === supplierId || s.supplierId === supplierId ? { ...s, ...updates } : s
      ),
    });
    try {
      await supplierService.updateSupplier(supplierId, updates);
    } catch (err) {
      console.error('Error updating supplier in Firestore:', err);
    }
  },

  adjustSupplierPayable: async (
    supplierId: string,
    amountDelta: number,
    type: 'ADD_BILL' | 'RECORD_PAYMENT' | 'SET_BALANCE',
    reason?: string
  ) => {
    const current = get().suppliers.find((s) => s.id === supplierId || s.supplierId === supplierId);
    if (!current) return;

    let newBalance = current.balancePayable || 0;
    if (type === 'ADD_BILL') {
      newBalance += Math.abs(amountDelta);
    } else if (type === 'RECORD_PAYMENT') {
      newBalance = Math.max(0, newBalance - Math.abs(amountDelta));
    } else if (type === 'SET_BALANCE') {
      newBalance = Math.max(0, amountDelta);
    }

    set({
      suppliers: get().suppliers.map((s) =>
        s.id === supplierId || s.supplierId === supplierId
          ? { ...s, balancePayable: newBalance, outstandingPayable: newBalance }
          : s
      ),
    });

    try {
      await supplierService.adjustSupplierPayable(supplierId, newBalance, reason);
    } catch (err) {
      console.error('Error updating supplier payable in Firestore:', err);
    }
  },

  deleteSupplier: async (supplierId: string) => {
    set({
      suppliers: get().suppliers.filter((s) => s.id !== supplierId && s.supplierId !== supplierId),
    });
    try {
      await supplierService.deleteSupplier(supplierId);
    } catch (err) {
      console.error('Error deleting supplier in Firestore:', err);
    }
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
