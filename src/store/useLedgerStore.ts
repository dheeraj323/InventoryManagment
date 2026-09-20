import { create } from 'zustand';
import { LedgerEntry, AuditLog, Vendor, VendorAccountSummary } from '../types';
import { MOCK_LEDGER_ENTRIES, MOCK_AUDIT_LOGS, MOCK_VENDORS } from '../constants/mockData';
import { ledgerService } from '../services/ledgerService';
import { useVendorStore } from './useVendorStore';

interface LedgerState {
  entries: LedgerEntry[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  fetchLedger: () => Promise<void>;
  subscribeLedger: (partyId?: string) => () => void;
  addEntry: (entry: Omit<LedgerEntry, 'id' | 'runningBalance'>) => Promise<void>;
  adjustLedgerManual: (
    entryId: string,
    newAmount: number,
    reason: string,
    adminName: string
  ) => Promise<void>;
  getLedgerForParty: (partyId: string) => LedgerEntry[];
  getPartyRunningBalance: (partyId: string) => number;
  /**
   * Returns a computed summary of a vendor's account position.
   * Uses ledger entry history + vendor master data for credit limit info.
   * @param vendorId - The vendor document ID
   * @param vendor   - Optional Vendor object for credit limit and name context
   */
  getVendorAccountSummary: (vendorId: string, vendor?: Vendor) => VendorAccountSummary;
  getVendorReceivables: () => { vendorId: string; name: string; balance: number }[];
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  entries: [],
  auditLogs: [],
  isLoading: false,

  fetchLedger: async () => {
    set({ isLoading: true });
    try {
      const logs = await ledgerService.getAuditLogs();
      set({ auditLogs: logs || [], isLoading: false });
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      set({ isLoading: false });
    }
  },

  subscribeLedger: (partyId?: string) => {
    return ledgerService.subscribeLedger((firestoreEntries) => {
      set({ entries: firestoreEntries || [] });
    }, partyId);
  },

  addEntry: async (entryData) => {
    const partyEntries = get().getLedgerForParty(entryData.partyId);
    const vendor = useVendorStore.getState().getVendorById(entryData.partyId);
    const prevBalance =
      partyEntries.length > 0
        ? partyEntries[0].runningBalance
        : (vendor?.currentBalance ?? 0);

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
        if (timeB !== timeA) return timeB - timeA;
        // Deterministic secondary sort: in descending chronological order,
        // CREDIT (payment settlement) occurred after DEBIT (invoice billing)
        if (a.type === 'CREDIT' && b.type === 'DEBIT') return -1;
        if (a.type === 'DEBIT' && b.type === 'CREDIT') return 1;
        return 0;
      });
  },

  getPartyRunningBalance: (partyId: string) => {
    const summary = get().getVendorAccountSummary(partyId);
    return summary.lastLedgerBalance;
  },

  getVendorAccountSummary: (partyId: string, vendor?: Vendor): VendorAccountSummary => {
    const entries = get().getLedgerForParty(partyId);
    const vendorObj = vendor || useVendorStore.getState().getVendorById(partyId);

    const creditLimit = vendorObj?.creditLimit ?? 0;
    // openingBalance: use explicitly set opening balance, or fall back to currentBalance
    // (for migrated vendors who had a balance before ledger entries were created)
    const openingBalance = vendorObj?.openingBalance ?? vendorObj?.currentBalance ?? 0;

    // Check if there is an explicit opening balance entry in the ledger
    const hasOpeningEntry = entries.some(
      (e) => e.sourceType === 'OPENING_BALANCE' || (e.referenceNo || '').startsWith('OPEN-')
    );
    const effectiveOpeningBalance = hasOpeningEntry ? 0 : openingBalance;

    // Total Invoiced = Sum of all DEBIT entries
    const totalDebits = entries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    // Total Payments = Sum of all CREDIT entries
    const totalCredits = entries
      .filter((e) => e.type === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);

    // Outstanding Due = Effective Opening Balance + Total Debits − Total Credits (clamped to >= 0)
    const rawBalance =
      entries.length > 0
        ? effectiveOpeningBalance + totalDebits - totalCredits
        : openingBalance;

    const currentOutstanding = Math.max(0, rawBalance);
    const advanceBalance = 0; // Advance is not supported in the system
    const overdueAmount = 0; // Baseline; derived from individual invoice due dates if applicable

    // availableCredit = 0 when no limit is set (treat as "no limit")
    const availableCredit =
      creditLimit > 0 ? Math.max(0, creditLimit - currentOutstanding) : 0;

    return {
      vendorId: partyId,
      vendorName: vendorObj?.name ?? '',
      shopName: vendorObj?.shopName ?? '',
      creditLimit,
      openingBalance,
      totalDebits,
      totalCredits,
      currentOutstanding,
      advanceBalance,
      overdueAmount,
      availableCredit,
      lastLedgerBalance: currentOutstanding,
    };
  },

  getVendorReceivables: () => {
    const vendors = useVendorStore.getState().vendors;
    return vendors.map((v) => ({
      vendorId: v.id,
      name: v.shopName,
      balance: get().getVendorAccountSummary(v.id, v).currentOutstanding,
    }));
  },
}));
