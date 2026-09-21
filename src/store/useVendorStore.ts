import { create } from 'zustand';
import { Vendor, VendorStatus, PaymentMethod } from '../types';
import { vendorService } from '../services/vendorService';
import { paymentService } from '../services/paymentService';

interface VendorState {
  vendors: Vendor[];
  isLoading: boolean;
  subscribeVendors: (vendorId?: string) => () => void;
  fetchVendors: () => Promise<void>;
  getVendorById: (id: string) => Vendor | undefined;
  addVendor: (vendorData: Partial<Vendor>, adminName?: string) => Promise<Vendor>;
  updateVendorProfile: (vendorId: string, updates: Partial<Vendor>, adminName?: string) => Promise<void>;
  updateVendorStatus: (vendorId: string, status: VendorStatus, reason?: string, adminName?: string) => Promise<void>;
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
      set({ vendors: vendors || [], isLoading: false });
    } catch (err) {
      console.error('Error fetching vendors from Firestore:', err);
      set({ isLoading: false });
    }
  },

  subscribeVendors: (vendorId?: string) => {
    return vendorService.subscribeVendors((firestoreVendors) => {
      set({ vendors: firestoreVendors || [] });
    }, vendorId);
  },

  getVendorById: (id: string) => {
    return get().vendors.find((v) => v.id === id || v.vendorId === id);
  },

  addVendor: async (vendorData: Partial<Vendor>, adminName: string = 'Admin') => {
    const newVendor = await vendorService.addVendor(vendorData, adminName);
    set({ vendors: [newVendor, ...get().vendors] });
    return newVendor;
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
    // Optimistic balance update
    set({
      vendors: get().vendors.map((v) => {
        if (v.id === params.vendorId || v.vendorId === params.vendorId) {
          const updatedBal = (v.currentBalance || 0) - params.amount;
          return {
            ...v,
            currentBalance: updatedBal,
            currentOutstanding: updatedBal,
            lastPaymentDate: payment.paymentDate,
          };
        }
        return v;
      }),
    });
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
