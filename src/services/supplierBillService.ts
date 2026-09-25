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
import {
  SupplierBill,
  SupplierBillItem,
  BillAuditRecord,
  BillAuditAction,
  SupplierPurchaseStats,
} from '../types';
import { supplierService } from './supplierService';

const SUPPLIERS_COLLECTION = 'suppliers';
const BILLS_SUBCOLLECTION = 'bills';
const HISTORY_SUBCOLLECTION = 'history';

export const supplierBillService = {
  /**
   * Fetch all bills for a specific supplier
   */
  getSupplierBills: async (
    supplierId: string,
    includeDeleted: boolean = false
  ): Promise<SupplierBill[]> => {
    try {
      const billsRef = collection(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION);
      const q = query(billsRef, orderBy('billDate', 'desc'));
      const snapshot = await getDocs(q);

      const bills = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          billId: docSnap.id,
          ...data,
          billDate: data.billDate || new Date().toISOString().split('T')[0],
          items: Array.isArray(data.items) ? data.items : [],
        } as SupplierBill;
      });

      if (!includeDeleted) {
        return bills.filter((b) => !b.isDeleted);
      }
      return bills;
    } catch (error) {
      console.error('Error fetching supplier bills:', error);
      return [];
    }
  },

  /**
   * Subscribe to real-time changes for a supplier's bills
   */
  subscribeSupplierBills: (
    supplierId: string,
    callback: (bills: SupplierBill[]) => void,
    includeDeleted: boolean = false
  ) => {
    const billsRef = collection(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION);
    const q = query(billsRef, orderBy('billDate', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const bills = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            billId: docSnap.id,
            ...data,
            billDate: data.billDate || new Date().toISOString().split('T')[0],
            items: Array.isArray(data.items) ? data.items : [],
          } as SupplierBill;
        });

        const filtered = includeDeleted ? bills : bills.filter((b) => !b.isDeleted);
        callback(filtered);
      },
      (error) => {
        console.error('Real-time supplier bills subscription error:', error);
      }
    );
  },

  /**
   * Get single bill details
   */
  getBillById: async (supplierId: string, billId: string): Promise<SupplierBill | null> => {
    try {
      const billRef = doc(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION, billId);
      const snap = await getDoc(billRef);
      if (!snap.exists()) return null;

      const data = snap.data();
      return {
        id: snap.id,
        billId: snap.id,
        ...data,
        items: Array.isArray(data.items) ? data.items : [],
      } as SupplierBill;
    } catch (error) {
      console.error('Error fetching bill details:', error);
      return null;
    }
  },

  /**
   * Create a new supplier bill, log audit entry, and update supplier payable if unpaid
   */
  addBill: async (
    supplierId: string,
    billData: Omit<SupplierBill, 'id' | 'billId'>,
    user: { uid: string; name?: string }
  ): Promise<SupplierBill> => {
    const billRef = doc(collection(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION));
    const nowIso = new Date().toISOString();

    const newBill: SupplierBill = {
      id: billRef.id,
      billId: billRef.id,
      supplierId,
      supplierName: billData.supplierName || '',
      userId: user.uid,
      createdByName: user.name || 'Admin',
      invoiceNumber: billData.invoiceNumber.trim(),
      billDate: billData.billDate || nowIso.split('T')[0],
      uploadedAt: nowIso,
      subtotal: Number(billData.subtotal) || 0,
      tax: Number(billData.tax) || 0,
      discount: Number(billData.discount) || 0,
      totalAmount: Number(billData.totalAmount) || 0,
      paymentStatus: billData.paymentStatus || 'PENDING',
      paidAmount: billData.paidAmount || (billData.paymentStatus === 'PAID' ? Number(billData.totalAmount) : 0),
      cloudinaryUrl: billData.cloudinaryUrl || '',
      cloudinaryPublicId: billData.cloudinaryPublicId || '',
      fileName: billData.fileName || '',
      fileType: billData.fileType || '',
      fileSize: billData.fileSize || 0,
      notes: billData.notes || '',
      items: billData.items || [],
      isDeleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 1. Write bill document
    await setDoc(billRef, {
      ...newBill,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Write initial audit record
    const historyRef = doc(
      collection(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION, billRef.id, HISTORY_SUBCOLLECTION)
    );

    const initialAudit: BillAuditRecord = {
      id: historyRef.id,
      billId: billRef.id,
      supplierId,
      action: 'CREATED',
      description: `Bill created for Invoice #${newBill.invoiceNumber} with total ₹${newBill.totalAmount.toLocaleString('en-IN')}`,
      changedBy: user.uid,
      changedByName: user.name || 'Admin',
      changedAt: nowIso,
      newValue: {
        invoiceNumber: newBill.invoiceNumber,
        totalAmount: newBill.totalAmount,
        paymentStatus: newBill.paymentStatus,
        itemCount: newBill.items.length,
      },
    };

    await setDoc(historyRef, {
      ...initialAudit,
      changedAt: serverTimestamp(),
    });

    // 3. Update supplier balance payable if unpaid
    if (newBill.paymentStatus === 'PENDING') {
      try {
        const supDoc = await getDoc(doc(db, SUPPLIERS_COLLECTION, supplierId));
        if (supDoc.exists()) {
          const currentPayable = supDoc.data().balancePayable || 0;
          await supplierService.adjustSupplierPayable(
            supplierId,
            currentPayable + newBill.totalAmount,
            `Bill #${newBill.invoiceNumber}`
          );
        }
      } catch (err) {
        console.warn('Could not auto-adjust supplier balance payable:', err);
      }
    }

    return newBill;
  },

  /**
   * Update an existing bill and record an audit log
   */
  updateBill: async (
    supplierId: string,
    billId: string,
    updates: Partial<SupplierBill>,
    audit: {
      action: BillAuditAction;
      description: string;
      field?: string;
      oldValue?: any;
      newValue?: any;
      changedBy: string;
      changedByName?: string;
    }
  ): Promise<void> => {
    const billRef = doc(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION, billId);
    const nowIso = new Date().toISOString();

    // 1. Update bill
    await updateDoc(billRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // 2. Add history record
    const historyRef = doc(
      collection(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION, billId, HISTORY_SUBCOLLECTION)
    );

    const auditRecord: BillAuditRecord = {
      id: historyRef.id,
      billId,
      supplierId,
      action: audit.action,
      field: audit.field,
      oldValue: audit.oldValue,
      newValue: audit.newValue,
      description: audit.description,
      changedBy: audit.changedBy,
      changedByName: audit.changedByName || 'Admin',
      changedAt: nowIso,
    };

    await setDoc(historyRef, {
      ...auditRecord,
      changedAt: serverTimestamp(),
    });
  },

  /**
   * Replace attachment and create an audit record
   */
  replaceAttachment: async (
    supplierId: string,
    billId: string,
    newAttachment: {
      cloudinaryUrl: string;
      cloudinaryPublicId: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    },
    user: { uid: string; name?: string; oldFileName?: string }
  ): Promise<void> => {
    const description = user.oldFileName
      ? `Attachment replaced: "${user.oldFileName}" → "${newAttachment.fileName}"`
      : `Attachment uploaded: "${newAttachment.fileName}"`;

    await supplierBillService.updateBill(
      supplierId,
      billId,
      {
        cloudinaryUrl: newAttachment.cloudinaryUrl,
        cloudinaryPublicId: newAttachment.cloudinaryPublicId,
        fileName: newAttachment.fileName,
        fileType: newAttachment.fileType,
        fileSize: newAttachment.fileSize,
      },
      {
        action: 'ATTACHMENT_REPLACED',
        description,
        field: 'attachment',
        oldValue: user.oldFileName || 'None',
        newValue: newAttachment.fileName,
        changedBy: user.uid,
        changedByName: user.name,
      }
    );
  },

  /**
   * Soft-delete a bill with audit tracking
   */
  softDeleteBill: async (
    supplierId: string,
    billId: string,
    user: { uid: string; name?: string; invoiceNumber?: string }
  ): Promise<void> => {
    const billRef = doc(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION, billId);
    const nowIso = new Date().toISOString();

    await updateDoc(billRef, {
      isDeleted: true,
      deletedAt: nowIso,
      deletedBy: user.uid,
      updatedAt: serverTimestamp(),
    });

    const historyRef = doc(
      collection(db, SUPPLIERS_COLLECTION, supplierId, BILLS_SUBCOLLECTION, billId, HISTORY_SUBCOLLECTION)
    );

    const auditRecord: BillAuditRecord = {
      id: historyRef.id,
      billId,
      supplierId,
      action: 'DELETED',
      description: `Bill ${user.invoiceNumber ? `(#${user.invoiceNumber}) ` : ''}soft-deleted from active records`,
      changedBy: user.uid,
      changedByName: user.name || 'Admin',
      changedAt: nowIso,
    };

    await setDoc(historyRef, {
      ...auditRecord,
      changedAt: serverTimestamp(),
    });
  },

  /**
   * Fetch audit history for a bill
   */
  getBillHistory: async (supplierId: string, billId: string): Promise<BillAuditRecord[]> => {
    try {
      const historyRef = collection(
        db,
        SUPPLIERS_COLLECTION,
        supplierId,
        BILLS_SUBCOLLECTION,
        billId,
        HISTORY_SUBCOLLECTION
      );
      const q = query(historyRef, orderBy('changedAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as BillAuditRecord[];
    } catch (error) {
      console.error('Error fetching bill history:', error);
      return [];
    }
  },

  /**
   * Subscribe to real-time audit history of a bill
   */
  subscribeBillHistory: (
    supplierId: string,
    billId: string,
    callback: (history: BillAuditRecord[]) => void
  ) => {
    const historyRef = collection(
      db,
      SUPPLIERS_COLLECTION,
      supplierId,
      BILLS_SUBCOLLECTION,
      billId,
      HISTORY_SUBCOLLECTION
    );
    const q = query(historyRef, orderBy('changedAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as BillAuditRecord[];
        callback(records);
      },
      (error) => {
        console.error('Real-time bill history subscription error:', error);
      }
    );
  },

  /**
   * Compute comprehensive purchase statistics from historical bills
   */
  calculateSupplierStats: (
    bills: SupplierBill[],
    currentBalancePayable: number = 0
  ): SupplierPurchaseStats => {
    const activeBills = bills.filter((b) => !b.isDeleted);
    const now = new Date();
    const currentYearStr = now.getFullYear().toString();
    const currentMonthPrefix = `${currentYearStr}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let totalPurchases = 0;
    let currentMonthPurchases = 0;
    let currentYearPurchases = 0;
    let lastPurchaseDate = '';
    let paidBillsCount = 0;
    let pendingBillsCount = 0;
    const uniqueProductNames = new Set<string>();

    for (const bill of activeBills) {
      const amt = bill.totalAmount || 0;
      totalPurchases += amt;

      const bDate = bill.billDate || '';
      if (bDate.startsWith(currentMonthPrefix)) {
        currentMonthPurchases += amt;
      }
      if (bDate.startsWith(currentYearStr)) {
        currentYearPurchases += amt;
      }

      if (!lastPurchaseDate || bDate > lastPurchaseDate) {
        lastPurchaseDate = bDate;
      }

      if (bill.paymentStatus === 'PAID') {
        paidBillsCount++;
      } else {
        pendingBillsCount++;
      }

      if (Array.isArray(bill.items)) {
        for (const item of bill.items) {
          if (item.productName) {
            uniqueProductNames.add(item.productName.trim().toLowerCase());
          }
        }
      }
    }

    const totalBills = activeBills.length;
    const averageBillValue = totalBills > 0 ? Math.round(totalPurchases / totalBills) : 0;

    return {
      totalBills,
      totalPurchases,
      currentMonthPurchases,
      currentYearPurchases,
      lastPurchaseDate,
      averageBillValue,
      totalProductsCount: uniqueProductNames.size,
      outstandingAmount: currentBalancePayable,
      paidBillsCount,
      pendingBillsCount,
    };
  },
};
