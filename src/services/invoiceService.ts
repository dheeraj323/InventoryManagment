/**
 * invoiceService.ts
 *
 * Read-only queries against the `invoices` Firestore collection.
 * Invoices are written exclusively by financialTransactionService.finalizeDelivery().
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Invoice } from '../types';

const INVOICES_COLLECTION = 'invoices';

export const invoiceService = {
  /** Fetch a single invoice by its document ID (same as orderId). */
  getInvoice: async (invoiceId: string): Promise<Invoice | null> => {
    try {
      const docRef = doc(db, INVOICES_COLLECTION, invoiceId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Invoice;
      }
      return null;
    } catch (error) {
      console.error(`[invoiceService] Error fetching invoice ${invoiceId}:`, error);
      return null;
    }
  },

  /** Fetch all invoices for a specific vendor, sorted by date descending. */
  getVendorInvoices: async (vendorId: string): Promise<Invoice[]> => {
    try {
      const q = query(
        collection(db, INVOICES_COLLECTION),
        where('vendorId', '==', vendorId),
        orderBy('invoiceDate', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
    } catch (error) {
      console.error(`[invoiceService] Error fetching invoices for vendor ${vendorId}:`, error);
      return [];
    }
  },

  /** Real-time listener for a vendor's invoices. Returns unsubscribe function. */
  subscribeVendorInvoices: (
    vendorId: string,
    callback: (invoices: Invoice[]) => void
  ): (() => void) => {
    const q = query(
      collection(db, INVOICES_COLLECTION),
      where('vendorId', '==', vendorId),
      orderBy('invoiceDate', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
        callback(invoices);
      },
      (error) => {
        console.error(`[invoiceService] Subscription error for vendor ${vendorId}:`, error);
      }
    );
  },

  /** Fetch all unpaid or partially paid invoices across all vendors (Admin use). */
  getOutstandingInvoices: async (): Promise<Invoice[]> => {
    try {
      const q = query(
        collection(db, INVOICES_COLLECTION),
        where('status', 'in', ['FINALIZED', 'PARTIALLY_PAID', 'OVERDUE']),
        orderBy('invoiceDate', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
    } catch (error) {
      console.error('[invoiceService] Error fetching outstanding invoices:', error);
      return [];
    }
  },
};
