import { create } from 'zustand';
import { LedgerEntry, AuditLog } from '../types';
import { MOCK_LEDGER_ENTRIES, MOCK_AUDIT_LOGS, MOCK_VENDORS } from '../constants/mockData';
import { ledgerService } from '../services/ledgerService';

interface LedgerState {
  entries: LedgerEntry[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  fetchLedger: () => Promise<void>;
  subscribeLedger: () => () => void;
  addEntry: (entry: Omit<LedgerEntry, 'id' | 'runningBalance'>) => Promise<void>;
  adjustLedgerManual: (
    entryId: string,
    newAmount: number,
    reason: string,
    adminName: string
  ) => Promise<void>;
  getLedgerForParty: (partyId: string) => LedgerEntry[];
  getPartyRunningBalance: (partyId: string) => number;
  getVendorReceivables: () => { vendorId: string; name: string; balance: number }[];
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  entries: MOCK_LEDGER_ENTRIES,
  auditLogs: MOCK_AUDIT_LOGS,
  isLoading: false,

  fetchLedger: async () => {
    set({ isLoading: true });
    try {
      const logs = await ledgerService.getAuditLogs();
      if (logs.length > 0) {
        set({ auditLogs: logs });
      }
      set({ isLoading: false });
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      set({ isLoading: false });
    }
  },

  subscribeLedger: () => {
    return ledgerService.subscribeLedger((firestoreEntries) => {
      if (firestoreEntries && firestoreEntries.length > 0) {
        set({ entries: firestoreEntries });
      }
    });
  },

  addEntry: async (entryData) => {
    const partyEntries = get().getLedgerForParty(entryData.partyId);
    const prevBalance = partyEntries.length > 0 ? partyEntries[0].runningBalance : 0;

    const delta = entryData.type === 'DEBIT' ? entryData.amount : -entryData.amount;
    const newRunningBalance = prevBalance + delta;

    const newEntry: LedgerEntry = {
      ...entryData,
      id: `led-${Date.now()}`,
      date: entryData.date || new Date().toISOString(),
      runningBalance: newRunningBalance,
    };

    set({ entries: [newEntry, ...get().entries] });

    try {
      await ledgerService.addEntry(entryData);
    } catch (err) {
      console.error('Error adding ledger entry to Firestore:', err);
    }
  },

  adjustLedgerManual: async (entryId, newAmount, reason, adminName) => {
    const target = get().entries.find((e) => e.id === entryId);
    if (!target) return;

    const timestamp = new Date().toISOString();
    const oldAmount = target.amount;

    const newAuditLog: AuditLog = {
      id: `audit-${Date.now()}`,
      action: 'LEDGER_MANUAL_ADJUSTMENT',
      performedBy: adminName,
      userRole: 'ADMIN',
      entityType: 'LEDGER_ENTRY',
      entityId: entryId,
      timestamp,
      reason,
      details: `Changed entry ${target.referenceNo} amount from $${oldAmount} to $${newAmount}.`,
    };

    set({
      entries: get().entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              amount: newAmount,
              editedAt: timestamp,
              editedBy: adminName,
              editReason: reason,
            }
          : e
      ),
      auditLogs: [newAuditLog, ...get().auditLogs],
    });

    try {
      await ledgerService.adjustLedgerManual(entryId, newAmount, reason, adminName);
    } catch (err) {
      console.error('Error adjusting ledger in Firestore:', err);
    }
  },

  getLedgerForParty: (partyId: string) => {
    return get()
      .entries.filter((e) => e.partyId === partyId || e.accountId === partyId)
      .sort((a, b) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  },

  getPartyRunningBalance: (partyId: string) => {
    const entries = get().getLedgerForParty(partyId);
    if (entries.length === 0) {
      const vendor = MOCK_VENDORS.find((v) => v.id === partyId);
      return vendor ? vendor.currentBalance : 0;
    }
    return entries[0].runningBalance;
  },

  getVendorReceivables: () => {
    return MOCK_VENDORS.map((v) => ({
      vendorId: v.id,
      name: v.shopName,
      balance: get().getPartyRunningBalance(v.id),
    }));
  },
}));
