import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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

export const productService = {
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
      callback(products);
    }, (error) => {
      console.error('Real-time products subscription error:', error);
    });
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
  },

  // Bulk update stock levels across multiple products in a single batch
  bulkUpdateStock: async (updates: { productId: string; newStockQty: number }[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      for (const item of updates) {
        const safeStock = Math.max(0, item.newStockQty);
        const docRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        batch.update(docRef, {
          stockQty: safeStock,
          availableStock: safeStock,
          updatedAt: serverTimestamp(),
        });
      }
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

    const newProduct: Product = {
      id: docRef.id,
      productId: docRef.id,
      name: productData.name || '',
      category: productData.category || 'General',
      unit: productData.unit || 'Piece',
      price: productData.price || 0,
      sellingPrice: productData.price || 0,
      stockQty: productData.stockQty || 0,
      availableStock: productData.stockQty || 0,
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
    } catch (error) {
      console.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  },
};
