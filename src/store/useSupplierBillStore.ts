import { create } from 'zustand';
import {
  SupplierBill,
  BillAuditRecord,
  SupplierPurchaseStats,
} from '../types';
import { supplierBillService } from '../services/supplierBillService';
import {
  cloudinaryService,
  CloudinaryUploadResult,
  UploadBillAttachmentParams,
} from '../services/cloudinaryService';

export interface SupplierPurchasedProductSummary {
  productName: string;
  totalPurchasedQty: number;
  unit: string;
  totalSpend: number;
  lastPrice: number;
  lastPurchaseDate: string;
  billCount: number;
}

interface SupplierBillState {
  bills: Record<string, SupplierBill[]>; // Keyed by supplierId
  selectedBill: SupplierBill | null;
  billHistory: Record<string, BillAuditRecord[]>; // Keyed by billId
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;

  // Actions
  subscribeSupplierBills: (supplierId: string) => () => void;
  subscribeBillHistory: (supplierId: string, billId: string) => () => void;
  fetchSupplierBills: (supplierId: string) => Promise<SupplierBill[]>;
  fetchBillDetails: (supplierId: string, billId: string) => Promise<SupplierBill | null>;
  createBill: (
    supplierId: string,
    billData: Omit<SupplierBill, 'id' | 'billId'>,
    user: { uid: string; name?: string }
  ) => Promise<SupplierBill>;
  updateBill: (
    supplierId: string,
    billId: string,
    updates: Partial<SupplierBill>,
    audit: {
      action: any;
      description: string;
      field?: string;
      oldValue?: any;
      newValue?: any;
      changedBy: string;
      changedByName?: string;
    }
  ) => Promise<void>;
  replaceAttachment: (
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
  ) => Promise<void>;
  softDeleteBill: (
    supplierId: string,
    billId: string,
    user: { uid: string; name?: string; invoiceNumber?: string }
  ) => Promise<void>;
  uploadToCloudinary: (params: UploadBillAttachmentParams) => Promise<CloudinaryUploadResult>;
  getSupplierStats: (supplierId: string, currentBalancePayable?: number) => SupplierPurchaseStats;
  getSupplierProductsSummary: (supplierId: string) => SupplierPurchasedProductSummary[];
}

export const useSupplierBillStore = create<SupplierBillState>((set, get) => ({
  bills: {},
  selectedBill: null,
  billHistory: {},
  isLoading: false,
  isUploading: false,
  error: null,

  subscribeSupplierBills: (supplierId: string) => {
    return supplierBillService.subscribeSupplierBills(supplierId, (supplierBills) => {
      set((state) => ({
        bills: {
          ...state.bills,
          [supplierId]: supplierBills,
        },
      }));
    });
  },

  subscribeBillHistory: (supplierId: string, billId: string) => {
    return supplierBillService.subscribeBillHistory(supplierId, billId, (records) => {
      set((state) => ({
        billHistory: {
          ...state.billHistory,
          [billId]: records,
        },
      }));
    });
  },

  fetchSupplierBills: async (supplierId: string) => {
    set({ isLoading: true, error: null });
    try {
      const fetchedBills = await supplierBillService.getSupplierBills(supplierId);
      set((state) => ({
        bills: {
          ...state.bills,
          [supplierId]: fetchedBills,
        },
        isLoading: false,
      }));
      return fetchedBills;
    } catch (err: any) {
      console.error('Error in fetchSupplierBills:', err);
      set({ error: err.message || 'Failed to load bills', isLoading: false });
      return [];
    }
  },

  fetchBillDetails: async (supplierId: string, billId: string) => {
    set({ isLoading: true, error: null });
    try {
      const bill = await supplierBillService.getBillById(supplierId, billId);
      if (bill) {
        set({ selectedBill: bill, isLoading: false });
      }
      return bill;
    } catch (err: any) {
      console.error('Error in fetchBillDetails:', err);
      set({ error: err.message || 'Failed to load bill details', isLoading: false });
      return null;
    }
  },

  createBill: async (supplierId, billData, user) => {
    set({ isLoading: true, error: null });
    try {
      const createdBill = await supplierBillService.addBill(supplierId, billData, user);
      
      // Optimistically add to state
      const currentSupplierBills = get().bills[supplierId] || [];
      set((state) => ({
        bills: {
          ...state.bills,
          [supplierId]: [createdBill, ...currentSupplierBills],
        },
        isLoading: false,
      }));

      return createdBill;
    } catch (err: any) {
      console.error('Error creating bill:', err);
      set({ error: err.message || 'Failed to create bill', isLoading: false });
      throw err;
    }
  },

  updateBill: async (supplierId, billId, updates, audit) => {
    set({ isLoading: true, error: null });
    try {
      await supplierBillService.updateBill(supplierId, billId, updates, audit);

      // Optimistic update
      const supplierBills = get().bills[supplierId] || [];
      const updated = supplierBills.map((b) =>
        b.id === billId || b.billId === billId ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
      );

      set((state) => ({
        bills: {
          ...state.bills,
          [supplierId]: updated,
        },
        selectedBill:
          state.selectedBill && (state.selectedBill.id === billId || state.selectedBill.billId === billId)
            ? { ...state.selectedBill, ...updates }
            : state.selectedBill,
        isLoading: false,
      }));
    } catch (err: any) {
      console.error('Error updating bill:', err);
      set({ error: err.message || 'Failed to update bill', isLoading: false });
      throw err;
    }
  },

  replaceAttachment: async (supplierId, billId, newAttachment, user) => {
    set({ isLoading: true, error: null });
    try {
      await supplierBillService.replaceAttachment(supplierId, billId, newAttachment, user);

      const supplierBills = get().bills[supplierId] || [];
      const updated = supplierBills.map((b) =>
        b.id === billId || b.billId === billId
          ? {
              ...b,
              ...newAttachment,
              updatedAt: new Date().toISOString(),
            }
          : b
      );

      set((state) => ({
        bills: {
          ...state.bills,
          [supplierId]: updated,
        },
        selectedBill:
          state.selectedBill && (state.selectedBill.id === billId || state.selectedBill.billId === billId)
            ? { ...state.selectedBill, ...newAttachment }
            : state.selectedBill,
        isLoading: false,
      }));
    } catch (err: any) {
      console.error('Error replacing attachment:', err);
      set({ error: err.message || 'Failed to replace attachment', isLoading: false });
      throw err;
    }
  },

  softDeleteBill: async (supplierId, billId, user) => {
    set({ isLoading: true, error: null });
    try {
      await supplierBillService.softDeleteBill(supplierId, billId, user);

      const supplierBills = get().bills[supplierId] || [];
      const updated = supplierBills.filter((b) => b.id !== billId && b.billId !== billId);

      set((state) => ({
        bills: {
          ...state.bills,
          [supplierId]: updated,
        },
        selectedBill: null,
        isLoading: false,
      }));
    } catch (err: any) {
      console.error('Error soft-deleting bill:', err);
      set({ error: err.message || 'Failed to delete bill', isLoading: false });
      throw err;
    }
  },

  uploadToCloudinary: async (params: UploadBillAttachmentParams) => {
    set({ isUploading: true, error: null });
    try {
      const result = await cloudinaryService.uploadBillAttachment(params);
      set({ isUploading: false });
      return result;
    } catch (err: any) {
      console.error('Error uploading to Cloudinary:', err);
      set({ error: err.message || 'Cloudinary upload failed', isUploading: false });
      throw err;
    }
  },

  getSupplierStats: (supplierId: string, currentBalancePayable: number = 0) => {
    const bills = get().bills[supplierId] || [];
    return supplierBillService.calculateSupplierStats(bills, currentBalancePayable);
  },

  getSupplierProductsSummary: (supplierId: string) => {
    const bills = (get().bills[supplierId] || []).filter((b) => !b.isDeleted);
    const summaryMap: Record<string, SupplierPurchasedProductSummary> = {};

    for (const bill of bills) {
      const bDate = bill.billDate || '';
      for (const item of bill.items || []) {
        const pName = (item.productName || '').trim();
        if (!pName) continue;
        const key = pName.toLowerCase();

        if (!summaryMap[key]) {
          summaryMap[key] = {
            productName: pName,
            totalPurchasedQty: 0,
            unit: item.unit || 'unit',
            totalSpend: 0,
            lastPrice: item.unitPrice || 0,
            lastPurchaseDate: bDate,
            billCount: 0,
          };
        }

        const summary = summaryMap[key];
        summary.totalPurchasedQty += Number(item.quantity) || 0;
        summary.totalSpend += Number(item.amount) || 0;
        summary.billCount += 1;

        if (!summary.lastPurchaseDate || bDate > summary.lastPurchaseDate) {
          summary.lastPurchaseDate = bDate;
          summary.lastPrice = item.unitPrice || summary.lastPrice;
          summary.unit = item.unit || summary.unit;
        }
      }
    }

    return Object.values(summaryMap).sort((a, b) => b.totalSpend - a.totalSpend);
  },
}));
