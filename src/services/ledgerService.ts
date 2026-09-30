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
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { LedgerEntry, AuditLog } from '../types';

const LEDGER_COLLECTION = 'ledgerEntries';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
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

export const ledgerService = {
  // Get ledger entries for a party (vendor or supplier)
  getLedgerForParty: async (partyId: string): Promise<LedgerEntry[]> => {
    try {
      const q = query(
        collection(db, LEDGER_COLLECTION),
        where('partyId', '==', partyId)
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        entryId: docSnap.id,
        ...docSnap.data(),
      })) as LedgerEntry[];
      return entries.sort(
        (a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
      );
    } catch (error) {
      console.error(`Error fetching ledger for party ${partyId}:`, error);
      return [];
    }
  },

  // Real-time listener for ledger entries (optionally filtered by partyId for vendor isolation)
  subscribeLedger: (callback: (entries: LedgerEntry[]) => void, partyId?: string) => {
    let q = query(collection(db, LEDGER_COLLECTION));
    if (partyId) {
      q = query(collection(db, LEDGER_COLLECTION), where('partyId', '==', partyId));
    }
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        entryId: docSnap.id,
        ...docSnap.data(),
      })) as LedgerEntry[];
      callback(entries);
    }, (error) => {
      console.error('Ledger subscription error:', error);
    });
  },

  // Add a new ledger entry with running balance calculation.
  // Pass preComputedRunningBalance when the caller has already computed it locally
  // (e.g. useLedgerStore.addEntry) to skip the getLedgerForParty getDocs read.
  addEntry: async (
    entryData: Omit<LedgerEntry, 'id' | 'runningBalance'>,
    preComputedRunningBalance?: number
  ): Promise<LedgerEntry> => {
    const entryRef = doc(collection(db, LEDGER_COLLECTION));

    let runningBalance: number;
    if (preComputedRunningBalance !== undefined) {
      // Caller already computed the balance from in-memory state — no read needed.
      runningBalance = preComputedRunningBalance;
    } else {
      // Fallback: fetch ledger history to derive the running balance.
      const partyEntries = await ledgerService.getLedgerForParty(entryData.partyId);
      const prevBalance = partyEntries.length > 0 ? partyEntries[0].runningBalance : 0;
      const delta = entryData.type === 'DEBIT' ? entryData.amount : -entryData.amount;
      runningBalance = prevBalance + delta;
    }

    const newEntry: LedgerEntry = {
      ...entryData,
      id: entryRef.id,
      entryId: entryRef.id,
      accountId: entryData.partyId,
      accountType: entryData.partyType.toLowerCase() as 'vendor' | 'supplier',
      transactionType: entryData.type,
      direction: entryData.type.toLowerCase() as 'debit' | 'credit',
      runningBalance,
      createdAt: new Date().toISOString(),
    };

    await setDoc(entryRef, cleanFirestoreData({
      ...newEntry,
      createdAt: serverTimestamp(),
    }));

    return newEntry;
  },

  // Adjust ledger entry manually (Admin action - requires mandatory reason and generates audit log)
  adjustLedgerManual: async (
    entryId: string,
    newAmount: number,
    reason: string,
    adminName: string
  ): Promise<void> => {
    if (!reason || reason.trim().length === 0) {
      throw new Error('A mandatory reason is required for manual ledger adjustments.');
    }

    await runTransaction(db, async (transaction) => {
      const entryRef = doc(db, LEDGER_COLLECTION, entryId);
      const entrySnap = await transaction.get(entryRef);

      if (!entrySnap.exists()) {
        throw new Error('Target ledger entry does not exist.');
      }

      const existingData = entrySnap.data() as LedgerEntry;
      const oldAmount = existingData.amount;
      const timestamp = new Date().toISOString();

      // Create Audit Log Document inside transaction
      const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
      const auditLog: AuditLog = {
        id: auditRef.id,
        logId: auditRef.id,
        action: 'LEDGER_MANUAL_ADJUSTMENT',
        performedBy: adminName,
        userRole: 'ADMIN',
        entityType: 'LEDGER_ENTRY',
        entityId: entryId,
        timestamp,
        reason: reason.trim(),
        details: `Changed entry ${existingData.referenceNo} amount from $${oldAmount} to $${newAmount}.`,
        createdAt: timestamp,
      };

      transaction.set(auditRef, {
        ...auditLog,
        createdAt: serverTimestamp(),
      });

      // Update Ledger Entry inside transaction
      transaction.update(entryRef, {
        amount: newAmount,
        editedAt: timestamp,
        editedBy: adminName,
        editReason: reason.trim(),
      });
    });
  },

  // Fetch audit logs
  getAuditLogs: async (): Promise<AuditLog[]> => {
    try {
      const q = query(collection(db, AUDIT_LOGS_COLLECTION), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        logId: docSnap.id,
        ...docSnap.data(),
      })) as AuditLog[];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  },
};
