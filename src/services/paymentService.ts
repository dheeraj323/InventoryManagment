/**
 * paymentService.ts
 *
 * Dedicated service for managing and recording payments directly in Firestore.
 * Ensures atomicity between `payments`, `ledgerEntries`, `vendors`, and `auditLogs`.
 */

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Payment, LedgerEntry, PaymentMethod } from '../types';

const PAYMENTS_COLLECTION = 'payments';
const VENDORS_COLLECTION = 'vendors';
const LEDGER_COLLECTION = 'ledgerEntries';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        cleaned[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export const paymentService = {
  /** Fetch all payments for a specific vendor */
  getVendorPayments: async (vendorId: string): Promise<Payment[]> => {
    try {
      const q = query(
        collection(db, PAYMENTS_COLLECTION),
        where('vendorId', '==', vendorId),
        orderBy('paymentDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        paymentId: docSnap.id,
        ...docSnap.data(),
      })) as Payment[];
    } catch (error) {
      console.error(`[paymentService] Error fetching payments for vendor ${vendorId}:`, error);
      return [];
    }
  },

  /** Subscribe to real-time payments for a vendor */
  subscribeVendorPayments: (
    vendorId: string,
    callback: (payments: Payment[]) => void
  ): (() => void) => {
    const q = query(
      collection(db, PAYMENTS_COLLECTION),
      where('vendorId', '==', vendorId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          paymentId: docSnap.id,
          ...docSnap.data(),
        })) as Payment[];
        payments.sort(
          (a, b) =>
            new Date(b.paymentDate || b.createdAt || 0).getTime() -
            new Date(a.paymentDate || a.createdAt || 0).getTime()
        );
        callback(payments);
      },
      (error) => {
        console.error(`[paymentService] Subscription error for vendor ${vendorId}:`, error);
      }
    );
  },

  /**
   * Atomically records a direct / offline payment from a vendor.
   * 1. Creates a `payments` document.
   * 2. Writes a `CREDIT` ledger entry in `ledgerEntries`.
   * 3. Decrements `vendors.currentBalance`.
   * 4. Creates an `auditLogs` entry.
   */
  recordDirectPayment: async (params: {
    vendorId: string;
    amount: number;
    paymentMode: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    adminName: string;
  }): Promise<Payment> => {
    const { vendorId, amount, paymentMode, referenceNumber, notes, adminName } = params;
    const nowStr = new Date().toISOString();
    const paymentRef = doc(collection(db, PAYMENTS_COLLECTION));
    const paymentId = paymentRef.id;
    const ledgerEntryRef = doc(collection(db, LEDGER_COLLECTION));
    const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);

    const safeRef = referenceNumber?.trim() || `PAY-${Date.now().toString().slice(-6)}`;

    return await runTransaction(db, async (transaction) => {
      // 1. ALL READS
      const vendorSnap = await transaction.get(vendorRef);
      if (!vendorSnap.exists()) {
        throw new Error(`Vendor ${vendorId} does not exist.`);
      }
      const vendorData = vendorSnap.data();
      const currentBalance = vendorData.currentBalance || 0;
      const vendorName = vendorData.name || 'Vendor';
      const shopName = vendorData.shopName || vendorName;

      // New net balance after payment credit (can be negative if advance is paid)
      const newBalance = Math.round((currentBalance - amount) * 100) / 100;
      const currentOutstanding = Math.max(0, newBalance);
      const advanceBalance = Math.max(0, -newBalance);

      const isAdvancePayment = currentBalance <= 0 || amount > currentBalance;
      const autoNote = isAdvancePayment
        ? currentBalance <= 0
          ? `Advance payment of ₹${amount.toLocaleString('en-IN')} received via ${paymentMode}`
          : `Payment of ₹${amount.toLocaleString('en-IN')} (₹${currentBalance.toLocaleString('en-IN')} due settled + ₹${(amount - currentBalance).toLocaleString('en-IN')} advance balance)`
        : `${paymentMode} payment received directly at HQ`;

      // 2. CREATE PAYMENT DOCUMENT
      const newPayment: Payment = {
        id: paymentId,
        paymentId,
        vendorId,
        vendorName,
        shopName,
        amount,
        paymentMode,
        paymentType: 'receivable',
        collectedBy: adminName,
        paymentDate: nowStr,
        referenceNumber: safeRef,
        verificationStatus: 'VERIFIED',
        verifiedBy: adminName,
        verifiedAt: nowStr,
        notes: notes?.trim() || autoNote,
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      transaction.set(
        paymentRef,
        cleanFirestoreData({
          ...newPayment,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      // 3. CREATE CREDIT LEDGER ENTRY
      const creditLedgerEntry: LedgerEntry = {
        id: ledgerEntryRef.id,
        entryId: ledgerEntryRef.id,
        accountType: 'vendor',
        accountId: vendorId,
        partyId: vendorId,
        partyName: shopName,
        partyType: 'VENDOR',
        type: 'CREDIT',
        transactionType: 'CREDIT',
        direction: 'credit',
        amount,
        runningBalance: newBalance,
        referenceId: safeRef,
        referenceNo: safeRef,
        sourceType: 'PAYMENT',
        idempotencyKey: `${paymentId}:CREDIT`,
        date: nowStr,
        note: notes?.trim() || autoNote,
        paymentMethod: paymentMode,
        createdBy: adminName,
        createdRole: 'ADMIN',
        createdAt: nowStr,
      };

      transaction.set(
        ledgerEntryRef,
        cleanFirestoreData({
          ...creditLedgerEntry,
          createdAt: serverTimestamp(),
        })
      );

      // 4. UPDATE VENDOR BALANCE
      transaction.update(vendorRef, {
        currentBalance: newBalance,
        currentOutstanding,
        advanceBalance,
        lastPaymentDate: nowStr,
        updatedAt: serverTimestamp(),
      });

      // 5. WRITE AUDIT LOG
      transaction.set(auditRef, {
        id: auditRef.id,
        action: 'PAYMENT_RECORDED',
        performedBy: adminName,
        userRole: 'ADMIN',
        entityType: 'VENDOR',
        entityId: vendorId,
        timestamp: nowStr,
        reason: isAdvancePayment ? 'Advance payment recorded' : 'Direct payment recorded',
        details: `Recorded ₹${amount.toFixed(2)} for ${shopName}. New Balance: ₹${newBalance.toFixed(2)} (Outstanding: ₹${currentOutstanding}, Advance: ₹${advanceBalance})`,
        createdAt: serverTimestamp(),
      });

      return newPayment;
    });
  },
};
