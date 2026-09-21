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
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Vendor, VendorStatus, LedgerEntry } from '../types';

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

  // Subscribe to real-time vendor updates (all vendors for Admin/Staff, single vendor for Vendor)
  subscribeVendors: (callback: (vendors: Vendor[]) => void, vendorId?: string) => {
    if (vendorId) {
      const docRef = doc(db, VENDORS_COLLECTION, vendorId);
      return onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            callback([
              {
                id: snapshot.id,
                vendorId: snapshot.id,
                ...snapshot.data(),
              } as Vendor,
            ]);
          } else {
            callback([]);
          }
        },
        (error) => {
          console.error(`Real-time vendor (${vendorId}) subscription error:`, error);
        }
      );
    }

    const q = query(collection(db, VENDORS_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const vendors = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          vendorId: docSnap.id,
          ...docSnap.data(),
        })) as Vendor[];
        callback(vendors);
      },
      (error) => {
        console.error('Real-time vendors subscription error:', error);
      }
    );
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

  // Add a new Vendor with optional opening balance ledger entry
  addVendor: async (
    vendorData: Partial<Vendor>,
    adminName: string = 'Admin'
  ): Promise<Vendor> => {
    const nowStr = new Date().toISOString();
    const vendorRef = doc(collection(db, VENDORS_COLLECTION));
    const vendorId = vendorRef.id;
    const initialBal = Math.max(0, vendorData.openingBalance || vendorData.currentBalance || 0);

    const newVendor: Vendor = {
      id: vendorId,
      vendorId,
      name: vendorData.name || '',
      ownerName: vendorData.name || '',
      shopName: vendorData.shopName || '',
      businessName: vendorData.shopName || '',
      phone: vendorData.phone || '',
      email: vendorData.email || '',
      address: vendorData.address || '',
      area: vendorData.area || '',
      vendorType: vendorData.vendorType || 'Retailer',
      paymentTerms: vendorData.paymentTerms || 'Net 15 Days',
      creditLimit: vendorData.creditLimit || 0,
      openingBalance: initialBal,
      currentBalance: initialBal,
      currentOutstanding: initialBal,
      overdueAmount: 0,
      payLaterEligible: vendorData.payLaterEligible ?? true,
      payLaterEnabled: vendorData.payLaterEligible ?? true,
      preferredPaymentMode: vendorData.preferredPaymentMode || 'CASH',
      status: vendorData.status || 'ACTIVE',
      active: vendorData.status !== 'SUSPENDED',
      notes: vendorData.notes || '',
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await runTransaction(db, async (transaction) => {
      // 1. Write Vendor document
      transaction.set(
        vendorRef,
        cleanFirestoreData({
          ...newVendor,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      // 2. If initial opening balance > 0, generate opening balance DEBIT ledger entry
      if (initialBal > 0) {
        const ledgerRef = doc(collection(db, LEDGER_COLLECTION));
        const openingEntry: LedgerEntry = {
          id: ledgerRef.id,
          entryId: ledgerRef.id,
          accountType: 'vendor',
          accountId: vendorId,
          partyId: vendorId,
          partyName: newVendor.shopName,
          partyType: 'VENDOR',
          type: 'DEBIT',
          transactionType: 'DEBIT',
          direction: 'debit',
          amount: initialBal,
          runningBalance: initialBal,
          referenceId: 'OPENING-BAL',
          referenceNo: 'OPENING-BAL',
          sourceType: 'OPENING_BALANCE',
          idempotencyKey: `${vendorId}:OPENING_BALANCE`,
          date: nowStr,
          note: 'Opening balance imported at vendor registration',
          createdBy: adminName,
          createdRole: 'ADMIN',
          createdAt: nowStr,
        };

        transaction.set(
          ledgerRef,
          cleanFirestoreData({
            ...openingEntry,
            createdAt: serverTimestamp(),
          })
        );
      }

      // 3. Write Audit Log
      const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
      transaction.set(auditRef, {
        id: auditRef.id,
        action: 'VENDOR_CREATED',
        performedBy: adminName,
        userRole: 'ADMIN',
        entityType: 'VENDOR',
        entityId: vendorId,
        timestamp: nowStr,
        reason: `New vendor registered: ${newVendor.shopName} (${newVendor.name})`,
        details: `Credit Limit: ₹${newVendor.creditLimit}, Opening Balance: ₹${initialBal}`,
        createdAt: serverTimestamp(),
      });
    });

    return newVendor;
  },

  // Update Vendor Profile Info
  updateVendorProfile: async (
    vendorId: string,
    updates: Partial<Vendor>,
    adminName: string = 'Admin'
  ): Promise<void> => {
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
    const nowStr = new Date().toISOString();

    await updateDoc(
      vendorRef,
      cleanFirestoreData({
        ...updates,
        updatedAt: serverTimestamp(),
      })
    );

    // Audit log for profile updates
    const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'VENDOR_PROFILE_UPDATED',
      performedBy: adminName,
      userRole: 'ADMIN',
      entityType: 'VENDOR',
      entityId: vendorId,
      timestamp: nowStr,
      reason: `Vendor profile details updated for ${updates.shopName || vendorId}`,
      details: JSON.stringify(updates),
      createdAt: serverTimestamp(),
    });
  },

  // Update Vendor Status (ACTIVE, PENDING_APPROVAL, ON_HOLD, SUSPENDED)
  updateVendorStatus: async (
    vendorId: string,
    newStatus: VendorStatus,
    reason: string = 'Status updated by Admin',
    adminName: string = 'Admin'
  ): Promise<void> => {
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
    const nowStr = new Date().toISOString();
    const isActive = newStatus === 'ACTIVE';

    await updateDoc(vendorRef, {
      status: newStatus,
      active: isActive,
      payLaterEligible: newStatus === 'ACTIVE',
      payLaterEnabled: newStatus === 'ACTIVE',
      updatedAt: serverTimestamp(),
    });

    const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'VENDOR_STATUS_CHANGE',
      performedBy: adminName,
      userRole: 'ADMIN',
      entityType: 'VENDOR',
      entityId: vendorId,
      timestamp: nowStr,
      reason,
      details: `Status changed to ${newStatus}. Active: ${isActive}`,
      createdAt: serverTimestamp(),
    });
  },

  // Adjust Vendor Credit Limit with mandatory reason & audit log
  adjustCreditLimit: async (
    vendorId: string,
    newCreditLimit: number,
    reason: string,
    adminName: string = 'Admin'
  ): Promise<void> => {
    const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
    const nowStr = new Date().toISOString();

    await updateDoc(vendorRef, {
      creditLimit: Math.max(0, newCreditLimit),
      updatedAt: serverTimestamp(),
    });

    const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'CREDIT_LIMIT_UPDATE',
      performedBy: adminName,
      userRole: 'ADMIN',
      entityType: 'VENDOR',
      entityId: vendorId,
      timestamp: nowStr,
      reason,
      details: `Credit limit modified to ₹${newCreditLimit.toLocaleString('en-IN')}`,
      createdAt: serverTimestamp(),
    });
  },
};
