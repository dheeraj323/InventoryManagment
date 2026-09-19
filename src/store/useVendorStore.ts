import { create } from 'zustand';
import { Vendor } from '../types';
import { vendorService } from '../services/vendorService';

interface VendorState {
  vendors: Vendor[];
  isLoading: boolean;
  subscribeVendors: () => () => void;
  fetchVendors: () => Promise<void>;
  getVendorById: (id: string) => Vendor | undefined;
  updatePayLaterAccess: (vendorId: string, payLaterEligible: boolean) => Promise<void>;
}

export const useVendorStore = create<VendorState>((set, get) => ({
  vendors: [],
  isLoading: false,

  fetchVendors: async () => {
    set({ isLoading: true });
    try {
      const vendors = await vendorService.getVendors();
      set({ vendors, isLoading: false });
    } catch (err) {
      console.error('Error fetching vendors from Firestore:', err);
      set({ isLoading: false });
    }
  },

  subscribeVendors: () => {
    return vendorService.subscribeVendors((firestoreVendors) => {
      if (firestoreVendors && firestoreVendors.length > 0) {
        set({ vendors: firestoreVendors });
      }
    });
  },

  getVendorById: (id: string) => {
    return get().vendors.find((v) => v.id === id || v.vendorId === id);
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
