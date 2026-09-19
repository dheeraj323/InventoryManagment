import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Vendor } from '../types';

const VENDORS_COLLECTION = 'vendors';

export const vendorService = {
  // Fetch all vendors
  getVendors: async (): Promise<Vendor[]> => {
    try {
      const q = query(collection(db, VENDORS_COLLECTION), orderBy('shopName', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        vendorId: docSnap.id,
        ...docSnap.data(),
      })) as Vendor[];
    } catch (error) {
      console.error('Error fetching vendors from Firestore:', error);
      return [];
    }
  },

  // Fetch single vendor by ID
  getVendorById: async (vendorId: string): Promise<Vendor | null> => {
    try {
      const docRef = doc(db, VENDORS_COLLECTION, vendorId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          vendorId: snapshot.id,
          ...snapshot.data(),
        } as Vendor;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching vendor ${vendorId}:`, error);
      return null;
    }
  },

  // Subscribe to real-time vendor updates
  subscribeVendors: (callback: (vendors: Vendor[]) => void) => {
    const q = query(collection(db, VENDORS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const vendors = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        vendorId: docSnap.id,
        ...docSnap.data(),
      })) as Vendor[];
      callback(vendors);
    }, (error) => {
      console.error('Real-time vendors subscription error:', error);
    });
  },

  // Update Vendor Pay Later eligibility (Admin action)
  updatePayLaterAccess: async (
    vendorId: string,
    payLaterEligible: boolean
  ): Promise<void> => {
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
    await updateDoc(vendorRef, {
      payLaterEligible,
      payLaterEnabled: payLaterEligible,
      updatedAt: serverTimestamp(),
    });
  },

  // Update Vendor Outstanding Balance
  updateOutstandingBalance: async (
    vendorId: string,
    newBalance: number
  ): Promise<void> => {
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
    await updateDoc(vendorRef, {
      currentBalance: newBalance,
      currentOutstanding: newBalance,
      updatedAt: serverTimestamp(),
    });
  },

  // Add a new Vendor
  addVendor: async (vendorData: Partial<Vendor>): Promise<Vendor> => {
    const vendorRef = doc(collection(db, VENDORS_COLLECTION));
    const newVendor: Vendor = {
      id: vendorRef.id,
      vendorId: vendorRef.id,
      name: vendorData.name || '',
      ownerName: vendorData.name || '',
      shopName: vendorData.shopName || '',
      businessName: vendorData.shopName || '',
      phone: vendorData.phone || '',
      address: vendorData.address || '',
      area: vendorData.area || '',
      currentBalance: vendorData.currentBalance || 0,
      currentOutstanding: vendorData.currentBalance || 0,
      payLaterEligible: vendorData.payLaterEligible ?? true,
      payLaterEnabled: vendorData.payLaterEligible ?? true,
      preferredPaymentMode: vendorData.preferredPaymentMode || 'CASH',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(vendorRef, {
      ...newVendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newVendor;
  },
};
