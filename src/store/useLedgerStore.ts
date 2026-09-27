import { create } from 'zustand';
import { LedgerEntry, AuditLog, Vendor, VendorAccountSummary } from '../types';
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
        ? (partyEntries[0].runningBalance ?? vendor?.currentBalance ?? 0)
        : (vendor?.currentBalance ?? 0);

    const delta = entryData.type === 'DEBIT' ? entryData.amount : -entryData.amount;
    const newRunningBalance = Math.round((prevBalance + delta) * 100) / 100;

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
    const raw = get().entries.filter(
      (e) => e.partyId === partyId || e.accountId === partyId
    );

    // Deduplicate by entry ID or idempotencyKey to protect against retry duplicates
    const seenIds = new Set<string>();
    const seenIdempotencyKeys = new Set<string>();
    const uniqueEntries: LedgerEntry[] = [];

    for (const entry of raw) {
      if (entry.id && seenIds.has(entry.id)) continue;
      if (entry.idempotencyKey && seenIdempotencyKeys.has(entry.idempotencyKey)) continue;

      if (entry.id) seenIds.add(entry.id);
      if (entry.idempotencyKey) seenIdempotencyKeys.add(entry.idempotencyKey);
      uniqueEntries.push(entry);
    }

    return uniqueEntries.sort((a, b) => {
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

    // Detect if an opening balance entry was posted to the ledger
    const openingEntry = entries.find(
      (e) =>
        e.sourceType === 'OPENING_BALANCE' ||
        (e.referenceNo || '').toUpperCase().startsWith('OPEN') ||
        (e.referenceId || '').toUpperCase().startsWith('OPEN') ||
        (e.note || '').toLowerCase().includes('opening balance') ||
        (e.note || '').toLowerCase().includes('initial balance')
    );
    const hasOpeningEntry = Boolean(openingEntry);

    // Total Invoiced = Sum of all DEBIT entries
    const totalDebits = entries
      .filter((e) => e.type === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    // Total Payments = Sum of all CREDIT entries
    const totalCredits = entries
      .filter((e) => e.type === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);

    // Opening balance logic:
    // If an explicit opening entry exists in the ledger, it is ALREADY included in totalDebits.
    // If not in the ledger, use vendorObj.openingBalance (if set).
    const effectiveOpeningBalance = hasOpeningEntry
      ? 0
      : Math.max(0, vendorObj?.openingBalance ?? 0);

    const reportedOpeningBalance = hasOpeningEntry
      ? (openingEntry?.amount ?? vendorObj?.openingBalance ?? 0)
      : (vendorObj?.openingBalance ?? (entries.length === 0 ? (vendorObj?.currentBalance ?? 0) : 0));

    // Outstanding Due / Net Position = Effective Opening Balance + Total Debits − Total Credits
    const rawBalance =
      entries.length > 0
        ? effectiveOpeningBalance + totalDebits - totalCredits
        : (vendorObj?.currentBalance !== undefined
            ? vendorObj.currentBalance
            : (vendorObj?.openingBalance ?? 0));

    const roundedRaw = Math.round(rawBalance * 100) / 100;
    const currentOutstanding = roundedRaw > 0 ? roundedRaw : 0;
    const advanceBalance = roundedRaw < 0
      ? Math.abs(roundedRaw)
      : (vendorObj?.advanceBalance && vendorObj.advanceBalance > 0 ? vendorObj.advanceBalance : 0);
    const overdueAmount = 0; // Baseline; derived from individual invoice due dates if applicable

    // availableCredit = 0 when no limit is set (treat as "no limit")
    const availableCredit =
      creditLimit > 0 ? Math.max(0, creditLimit - currentOutstanding) : 0;

    return {
      vendorId: partyId,
      vendorName: vendorObj?.name ?? '',
      shopName: vendorObj?.shopName ?? '',
      creditLimit,
      openingBalance: reportedOpeningBalance,
      totalDebits,
      totalCredits,
      currentOutstanding,
      advanceBalance,
      overdueAmount,
      availableCredit,
      lastLedgerBalance: roundedRaw,
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
