import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { CashSettlement } from '../types';

const SETTLEMENTS_COLLECTION = 'cashSettlements';

export const settlementService = {
  // Fetch all settlements
  getSettlements: async (): Promise<CashSettlement[]> => {
    try {
      const q = query(collection(db, SETTLEMENTS_COLLECTION), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        settlementId: docSnap.id,
        ...docSnap.data(),
      })) as CashSettlement[];
    } catch (error) {
      console.error('Error fetching settlements:', error);
      return [];
    }
  },

  // Subscribe to settlements real-time updates
  subscribeSettlements: (callback: (settlements: CashSettlement[]) => void) => {
    const q = query(collection(db, SETTLEMENTS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const settlements = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        settlementId: docSnap.id,
        ...docSnap.data(),
      })) as CashSettlement[];

      // Client-side sort: newest settlements at the top
      settlements.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
        return timeB - timeA;
      });

      callback(settlements);
    }, (error) => {
      console.error('Settlements subscription error:', error);
    });
  },

  // Staff submits cash settlement
  submitSettlement: async (
    staffId: string,
    staffName: string,
    collectedCash: number,
    handedOverCash: number,
    notes?: string
  ): Promise<CashSettlement> => {
    const docRef = doc(collection(db, SETTLEMENTS_COLLECTION));
    const variance = handedOverCash - collectedCash;
    const dateStr = new Date().toISOString().split('T')[0];
    const settlementNumber = `STL-2026-${Date.now().toString().slice(-4)}`;

    const newSettlement: CashSettlement = {
      id: docRef.id,
      settlementId: docRef.id,
      settlementNumber,
      staffId,
      staffName,
      date: dateStr,
      settlementDate: dateStr,
      totalCashCollected: collectedCash,
      amountCollected: collectedCash,
      handedOverCash,
      amountHandedOver: handedOverCash,
      variance,
      difference: variance,
      status: 'PENDING_VERIFICATION',
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };

    await setDoc(docRef, {
      ...newSettlement,
      createdAt: serverTimestamp(),
    });

    return newSettlement;
  },

  // Admin verifies settlement
  verifySettlement: async (settlementId: string, adminName: string): Promise<void> => {
    const docRef = doc(db, SETTLEMENTS_COLLECTION, settlementId);
    await updateDoc(docRef, {
      status: 'VERIFIED',
      verifiedBy: adminName,
      verifiedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  },
};
