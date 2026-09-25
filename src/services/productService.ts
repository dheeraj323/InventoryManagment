import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types';

const PRODUCTS_COLLECTION = 'products';
const SYSTEM_COLLECTION = 'system';
const METADATA_DOC = 'metadata';
const LIVE_STOCK_DOC = 'live_stock';

export const productService = {
  // Fetch system metadata (productsVersion) - exactly 1 Firestore read
  getProductsMetadata: async (): Promise<{ productsVersion: number; lastUpdated?: string } | null> => {
    try {
      const metaRef = doc(db, SYSTEM_COLLECTION, METADATA_DOC);
      const snapshot = await getDoc(metaRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        return {
          productsVersion: data.productsVersion || 1,
          lastUpdated: data.lastUpdated,
        };
      }
      return null;
    } catch (error) {
      console.warn('Could not fetch products metadata from Firestore:', error);
      return null;
    }
  },

  // Bump the productsVersion in system/metadata when catalog is modified
  bumpProductsVersion: async (): Promise<number> => {
    try {
      const metaRef = doc(db, SYSTEM_COLLECTION, METADATA_DOC);
      const snapshot = await getDoc(metaRef);
      const currentVersion = snapshot.exists() ? (snapshot.data().productsVersion || 1) : 1;
      const nextVersion = currentVersion + 1;
      await setDoc(
        metaRef,
        {
          productsVersion: nextVersion,
          lastUpdated: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return nextVersion;
    } catch (error) {
      console.warn('Error bumping products version in metadata:', error);
      return 1;
    }
  },

  // Fetch all products
  getProducts: async (): Promise<Product[]> => {
    try {
      const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        productId: docSnap.id,
        ...docSnap.data(),
      })) as Product[];
    } catch (error) {
      console.error('Error fetching products from Firestore:', error);
      return [];
    }
  },

  // Fetch single product by ID
  getProductById: async (productId: string): Promise<Product | null> => {
    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, productId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          productId: snapshot.id,
          ...snapshot.data(),
        } as Product;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      return null;
    }
  },

  // Real-time listener for products
  subscribeProducts: (callback: (products: Product[]) => void) => {
    const q = query(collection(db, PRODUCTS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        productId: docSnap.id,
        ...docSnap.data(),
      })) as Product[];
      products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      callback(products);
    }, (error) => {
      console.error('Real-time products subscription error:', error);
    });
  },

  // Fetch consolidated Live Stock Map (1 Read)
  getLiveStock: async (): Promise<Record<string, number>> => {
    try {
      const stockRef = doc(db, SYSTEM_COLLECTION, LIVE_STOCK_DOC);
      const snapshot = await getDoc(stockRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const stockMap: Record<string, number> = {};
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'number') {
            stockMap[key] = val;
          }
        }
        return stockMap;
      }
      return {};
    } catch (error) {
      console.warn('Could not fetch live stock map:', error);
      return {};
    }
  },

  // Real-time listener on consolidated Live Stock Map (Exactly 1 Read on load + 1 Read per stock change)
  subscribeLiveStock: (callback: (stockMap: Record<string, number>) => void) => {
    const stockRef = doc(db, SYSTEM_COLLECTION, LIVE_STOCK_DOC);
    return onSnapshot(
      stockRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const stockMap: Record<string, number> = {};
          for (const [key, val] of Object.entries(data)) {
            if (typeof val === 'number') {
              stockMap[key] = val;
            }
          }
          callback(stockMap);
        }
      },
      (error) => {
        console.error('Real-time live stock subscription error:', error);
      }
    );
  },

  // Update Live Stock Map in Firestore
  updateLiveStockMap: async (updates: Record<string, any>): Promise<void> => {
    try {
      const stockRef = doc(db, SYSTEM_COLLECTION, LIVE_STOCK_DOC);
      await setDoc(stockRef, updates, { merge: true });
    } catch (error) {
      console.warn('Error updating live stock map in Firestore:', error);
    }
  },

  // Update stock level
  updateStock: async (productId: string, newStockQty: number): Promise<void> => {
    const safeStock = Math.max(0, newStockQty);
    const docRef = doc(db, PRODUCTS_COLLECTION, productId);
    await updateDoc(docRef, {
      stockQty: safeStock,
      availableStock: safeStock,
      updatedAt: serverTimestamp(),
    });

    // Sync consolidated live stock map
    productService.updateLiveStockMap({
      [productId]: safeStock,
    }).catch((err) => console.warn('Failed to sync live stock map:', err));
  },

  // Bulk update stock levels across multiple products in a single batch
  bulkUpdateStock: async (updates: { productId: string; newStockQty: number }[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      const liveStockUpdates: Record<string, number> = {};

      for (const item of updates) {
        const safeStock = Math.max(0, item.newStockQty);
        const docRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        batch.update(docRef, {
          stockQty: safeStock,
          availableStock: safeStock,
          updatedAt: serverTimestamp(),
        });
        liveStockUpdates[item.productId] = safeStock;
      }

      // Also batch-update the single live_stock document
      const stockRef = doc(db, SYSTEM_COLLECTION, LIVE_STOCK_DOC);
      batch.set(stockRef, liveStockUpdates, { merge: true });

      await batch.commit();
    } catch (error) {
      console.error('Error in bulk stock update:', error);
      throw error;
    }
  },

  // Add new Product / SKU (auto-generates backend operational SKU identifier)
  addProduct: async (productData: Partial<Product>): Promise<Product> => {
    const docRef = doc(collection(db, PRODUCTS_COLLECTION));
    const catCode = (productData.category || 'GEN')
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase() || 'GEN';
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const backendGeneratedSku = productData.sku || `SKU-${catCode}-${randCode}`;

    const initialStock = Math.max(0, productData.stockQty || 0);

    const newProduct: Product = {
      id: docRef.id,
      productId: docRef.id,
      name: productData.name || '',
      category: productData.category || 'General',
      unit: productData.unit || 'Piece',
      price: productData.price || 0,
      sellingPrice: productData.price || 0,
      stockQty: initialStock,
      availableStock: initialStock,
      lowStockThreshold: productData.lowStockThreshold || 10,
      minimumStock: productData.lowStockThreshold || 10,
      sku: backendGeneratedSku,
      imageUrl: productData.imageUrl || '',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, {
      ...newProduct,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update live stock map
    productService.updateLiveStockMap({
      [docRef.id]: initialStock,
    }).catch((err) => console.warn('Failed to add product to live stock map:', err));

    // Bump catalog version in metadata asynchronously
    productService.bumpProductsVersion().catch((err) => {
      console.warn('Failed to bump products version on add:', err);
    });

    return newProduct;
  },

  // Update existing Product attributes (name, price, unit, category, sku, threshold, etc.)
  updateProduct: async (productId: string, updates: Partial<Product>): Promise<void> => {
    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, productId);
      const cleanUpdates: Record<string, any> = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      if (updates.price !== undefined && updates.sellingPrice === undefined) {
        cleanUpdates.sellingPrice = updates.price;
      }
      if (updates.lowStockThreshold !== undefined && updates.minimumStock === undefined) {
        cleanUpdates.minimumStock = updates.lowStockThreshold;
      }
      if (updates.stockQty !== undefined && updates.availableStock === undefined) {
        cleanUpdates.availableStock = updates.stockQty;
      }
      await updateDoc(docRef, cleanUpdates);

      if (updates.stockQty !== undefined) {
        productService.updateLiveStockMap({
          [productId]: Math.max(0, updates.stockQty),
        }).catch((err) => console.warn('Failed to sync live stock map on product update:', err));
      }

      // Bump catalog version in metadata
      productService.bumpProductsVersion().catch((err) => {
        console.warn('Failed to bump products version on update:', err);
      });
    } catch (error) {
      console.error(`Error updating product ${productId}:`, error);
      throw error;
    }
  },

  // Delete product from Firestore
  deleteProduct: async (productId: string): Promise<void> => {
    try {
      const docRef = doc(db, PRODUCTS_COLLECTION, productId);
      await deleteDoc(docRef);

      // Remove from live stock map
      productService.updateLiveStockMap({
        [productId]: deleteField(),
      }).catch((err) => console.warn('Failed to remove product from live stock map:', err));

      // Bump catalog version in metadata
      productService.bumpProductsVersion().catch((err) => {
        console.warn('Failed to bump products version on delete:', err);
      });
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  },
};
