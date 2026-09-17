import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
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

  // Add new Product
  addProduct: async (productData: Partial<Product>): Promise<Product> => {
    const docRef = doc(collection(db, PRODUCTS_COLLECTION));
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
      sku: productData.sku || `SKU-${Date.now().toString().slice(-6)}`,
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
};
