import { create } from 'zustand';
import { Vendor, VendorStatus, PaymentMethod, LedgerEntry } from '../types';
import { vendorService } from '../services/vendorService';
import { paymentService } from '../services/paymentService';
import { authService } from '../services/authService';

interface VendorState {
  vendors: Vendor[];
  isLoading: boolean;
  subscribeVendors: (vendorId?: string) => () => void;
  fetchVendors: () => Promise<void>;
  getVendorById: (id: string) => Vendor | undefined;
  addVendor: (vendorData: Partial<Vendor> & { password?: string }, adminName?: string) => Promise<Vendor>;
  updateVendorProfile: (vendorId: string, updates: Partial<Vendor>, adminName?: string) => Promise<void>;
  updateVendorStatus: (vendorId: string, status: VendorStatus, reason?: string, adminName?: string) => Promise<void>;
  updateVendorPassword: (vendorId: string, newPassword: string) => Promise<void>;
  adjustCreditLimit: (vendorId: string, newLimit: number, reason: string, adminName?: string) => Promise<void>;
  recordDirectPayment: (params: {
    vendorId: string;
    amount: number;
    paymentMode: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
    adminName: string;
  }) => Promise<void>;
  updatePayLaterAccess: (vendorId: string, payLaterEligible: boolean) => Promise<void>;
}

export const useVendorStore = create<VendorState>((set, get) => ({
  vendors: [],
  isLoading: false,

  fetchVendors: async () => {
    set({ isLoading: true });
    try {
      const vendors = await vendorService.getVendors();
      const uniqueMap = new Map<string, Vendor>();
      (vendors || []).forEach((v) => {
        const key = v.id || v.vendorId;
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, v);
        }
      });
      set({ vendors: Array.from(uniqueMap.values()), isLoading: false });
    } catch (err) {
      console.error('Error fetching vendors from Firestore:', err);
      set({ isLoading: false });
    }
  },

  subscribeVendors: (vendorId?: string) => {
    return vendorService.subscribeVendors((firestoreVendors) => {
      const uniqueMap = new Map<string, Vendor>();
      (firestoreVendors || []).forEach((v) => {
        const key = v.id || v.vendorId;
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, v);
        }
      });
      set({ vendors: Array.from(uniqueMap.values()) });
    }, vendorId);
  },

  getVendorById: (id: string) => {
    return get().vendors.find((v) => v.id === id || v.vendorId === id);
  },

  addVendor: async (vendorData: Partial<Vendor> & { password?: string }, adminName: string = 'Admin') => {
    if (vendorData.username && vendorData.password) {
      const { vendor } = await authService.registerVendorByAdmin({
        shopName: vendorData.shopName || '',
        ownerName: vendorData.ownerName || vendorData.name || '',
        phone: vendorData.phone || '',
        address: vendorData.address || '',
        username: vendorData.username,
        password: vendorData.password,
        adminName,
      });
      set((state) => {
        const uniqueMap = new Map<string, Vendor>();
        const newKey = vendor.id || vendor.vendorId;
        if (newKey) uniqueMap.set(newKey, vendor);
        state.vendors.forEach((v) => {
          const key = v.id || v.vendorId;
          if (key && !uniqueMap.has(key)) uniqueMap.set(key, v);
        });
        return { vendors: Array.from(uniqueMap.values()) };
      });
      return vendor;
    } else {
      const newVendor = await vendorService.addVendor(vendorData, adminName);
      set((state) => {
        const uniqueMap = new Map<string, Vendor>();
        const newKey = newVendor.id || newVendor.vendorId;
        if (newKey) uniqueMap.set(newKey, newVendor);
        state.vendors.forEach((v) => {
          const key = v.id || v.vendorId;
          if (key && !uniqueMap.has(key)) uniqueMap.set(key, v);
        });
        return { vendors: Array.from(uniqueMap.values()) };
      });
      return newVendor;
    }
  },

  updateVendorPassword: async (vendorId: string, newPassword: string) => {
    await authService.adminUpdateVendorPassword(vendorId, newPassword);
  },

  updateVendorProfile: async (vendorId: string, updates: Partial<Vendor>, adminName: string = 'Admin') => {
    set({
      vendors: get().vendors.map((v) =>
        v.id === vendorId || v.vendorId === vendorId
          ? { ...v, ...updates }
          : v
      ),
    });
    await vendorService.updateVendorProfile(vendorId, updates, adminName);
  },

  updateVendorStatus: async (
    vendorId: string,
    status: VendorStatus,
    reason: string = 'Status updated by Admin',
    adminName: string = 'Admin'
  ) => {
    set({
      vendors: get().vendors.map((v) =>
        v.id === vendorId || v.vendorId === vendorId
          ? {
              ...v,
              status,
              active: status === 'ACTIVE',
              payLaterEligible: status === 'ACTIVE',
              payLaterEnabled: status === 'ACTIVE',
            }
          : v
      ),
    });
    await vendorService.updateVendorStatus(vendorId, status, reason, adminName);
  },

  adjustCreditLimit: async (
    vendorId: string,
    newLimit: number,
    reason: string,
    adminName: string = 'Admin'
  ) => {
    set({
      vendors: get().vendors.map((v) =>
        v.id === vendorId || v.vendorId === vendorId
          ? { ...v, creditLimit: newLimit }
          : v
      ),
    });
    await vendorService.adjustCreditLimit(vendorId, newLimit, reason, adminName);
  },

  recordDirectPayment: async (params) => {
    const payment = await paymentService.recordDirectPayment(params);
    const targetVendor = get().vendors.find(
      (v) => v.id === params.vendorId || v.vendorId === params.vendorId
    );
    const prevBalance = targetVendor?.currentBalance || 0;
    const updatedBal = Math.round((prevBalance - params.amount) * 100) / 100;
    const currentOutstanding = Math.max(0, updatedBal);
    const advanceBalance = Math.max(0, -updatedBal);

    // Optimistic balance update in useVendorStore
    set({
      vendors: get().vendors.map((v) => {
        if (v.id === params.vendorId || v.vendorId === params.vendorId) {
          return {
            ...v,
            currentBalance: updatedBal,
            currentOutstanding,
            advanceBalance,
            lastPaymentDate: payment.paymentDate,
          };
        }
        return v;
      }),
    });

    // Optimistically record the CREDIT ledger entry in useLedgerStore
    const isAdvancePayment = prevBalance <= 0 || params.amount > prevBalance;
    const autoNote = isAdvancePayment
      ? prevBalance <= 0
        ? `Advance payment of ₹${params.amount.toLocaleString('en-IN')} received via ${params.paymentMode}`
        : `Payment of ₹${params.amount.toLocaleString('en-IN')} (₹${prevBalance.toLocaleString('en-IN')} due settled + ₹${(params.amount - prevBalance).toLocaleString('en-IN')} advance balance)`
      : `${params.paymentMode} payment received directly at HQ`;

    const creditEntryId = payment.id || `led-${Date.now()}`;
    const safeRef = params.referenceNumber?.trim() || payment.referenceNumber || `PAY-${Date.now().toString().slice(-6)}`;

    const newCreditEntry: LedgerEntry = {
      id: creditEntryId,
      entryId: creditEntryId,
      accountType: 'vendor',
      accountId: params.vendorId,
      partyId: params.vendorId,
      partyName: targetVendor?.shopName || targetVendor?.name || 'Vendor',
      partyType: 'VENDOR',
      type: 'CREDIT',
      transactionType: 'CREDIT',
      direction: 'credit',
      amount: params.amount,
      runningBalance: updatedBal,
      referenceId: safeRef,
      referenceNo: safeRef,
      sourceType: 'PAYMENT',
      idempotencyKey: `${payment.id}:CREDIT`,
      date: payment.paymentDate || new Date().toISOString(),
      note: params.notes || payment.notes || autoNote,
      paymentMethod: params.paymentMode,
      createdBy: params.adminName || 'Admin',
      createdRole: 'ADMIN',
      createdAt: payment.paymentDate || new Date().toISOString(),
    };

    try {
      // Lazy load useLedgerStore to break require cycle: useVendorStore <-> useLedgerStore
      const { useLedgerStore } = require('./useLedgerStore');
      const currentEntries = useLedgerStore.getState().entries;
      const filtered = currentEntries.filter((e: LedgerEntry) => e.id !== creditEntryId && e.id !== newCreditEntry.id);
      useLedgerStore.setState({
        entries: [newCreditEntry, ...filtered],
      });
    } catch (_err) {
      // Silently continue if store is not available during init
    }
  },

  updatePayLaterAccess: async (vendorId, payLaterEligible) => {
    set({
      vendors: get().vendors.map((v) =>
        v.id === vendorId || v.vendorId === vendorId
          ? { ...v, payLaterEligible, payLaterEnabled: payLaterEligible }
          : v
      ),
    });

    try {
      await vendorService.updatePayLaterAccess(vendorId, payLaterEligible);
    } catch (err) {
      console.error('Error updating vendor pay later access in Firestore:', err);
    }
  },
}));
