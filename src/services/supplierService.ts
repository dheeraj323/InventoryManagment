import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Supplier } from '../types';

const SUPPLIERS_COLLECTION = 'suppliers';

export const supplierService = {
  getSuppliers: async (): Promise<Supplier[]> => {
    try {
      const q = query(collection(db, SUPPLIERS_COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        supplierId: docSnap.id,
        ...docSnap.data(),
      })) as Supplier[];
    } catch (error) {
      console.error('Error fetching suppliers from Firestore:', error);
      return [];
    }
  },

  subscribeSuppliers: (callback: (suppliers: Supplier[]) => void) => {
    const q = query(collection(db, SUPPLIERS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const suppliers = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        supplierId: docSnap.id,
        ...docSnap.data(),
      })) as Supplier[];
      callback(suppliers);
    }, (error) => {
      console.error('Real-time suppliers subscription error:', error);
    });
  },

  addSupplier: async (supplierData: Partial<Supplier>): Promise<Supplier> => {
    const docRef = doc(collection(db, SUPPLIERS_COLLECTION));
    const newSupplier: Supplier = {
      id: docRef.id,
      supplierId: docRef.id,
      name: supplierData.name || '',
      businessName: supplierData.name || '',
      contactPerson: supplierData.contactPerson || '',
      phone: supplierData.phone || '',
      email: supplierData.email || '',
      category: supplierData.category || 'General',
      balancePayable: supplierData.balancePayable || 0,
      outstandingPayable: supplierData.balancePayable || 0,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, {
      ...newSupplier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newSupplier;
  },
};
