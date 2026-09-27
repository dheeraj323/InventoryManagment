import { create } from 'zustand';
import { StaffDailyStockSession, StaffStockItem } from '../types';
import { staffStockService, getTodayDateStr } from '../services/staffStockService';
import { useInventoryStore } from './useInventoryStore';

interface StaffStockState {
  todaySession: StaffDailyStockSession | null;
  allSessions: StaffDailyStockSession[];
  isLoading: boolean;
  isSaving: boolean;
  selectedDate: string;
  todayUnsub: (() => void) | null;
  allUnsub: (() => void) | null;

  setSelectedDate: (date: string) => void;
  subscribeTodaySession: (staffId: string, date?: string) => () => void;
  subscribeAllSessions: (date?: string) => () => void;
  unsubscribeAll: () => void;

  loadMorningStock: (params: {
    staffId: string;
    staffName: string;
    items: {
      productId: string;
      productName: string;
      unit: string;
      sku?: string;
      price?: number;
      preOrderedQty?: number;
      extraLoadedQty: number;
    }[];
    notes?: string;
    date?: string;
  }) => Promise<StaffDailyStockSession>;

  returnEveningStock: (params: {
    staffId: string;
    items: {
      productId: string;
      returnedQty: number;
      damagedQty?: number;
      missingQty?: number;
    }[];
    notes?: string;
    date?: string;
  }) => Promise<StaffDailyStockSession>;

  recordDeliveredUnits: (
    staffId: string,
    deliveredItems: {
      productId: string;
      deliveredQty: number;
      damagedQty?: number;
      missingQty?: number;
    }[],
    date?: string
  ) => Promise<void>;

  syncOutForDeliveryStock: (staffId: string, orders: any[], date?: string) => Promise<void>;
}

export const useStaffStockStore = create<StaffStockState>((set, get) => ({
  todaySession: null,
  allSessions: [],
  isLoading: false,
  isSaving: false,
  selectedDate: getTodayDateStr(),
  todayUnsub: null,
  allUnsub: null,

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
  },

  subscribeTodaySession: (staffId: string, dateParam?: string) => {
    const existing = get().todayUnsub;
    if (existing) existing();

    const date = dateParam || getTodayDateStr();
    set({ isLoading: true });

    const unsub = staffStockService.subscribeTodaySession(staffId, date, (session) => {
      set({ todaySession: session, isLoading: false });
    });

    set({ todayUnsub: unsub });
    return unsub;
  },

  subscribeAllSessions: (dateParam?: string) => {
    const existing = get().allUnsub;
    if (existing) existing();

    set({ isLoading: true });
    const unsub = staffStockService.subscribeAllSessions(dateParam, (sessions) => {
      set({ allSessions: sessions, isLoading: false });
    });

    set({ allUnsub: unsub });
    return unsub;
  },

  unsubscribeAll: () => {
    const { todayUnsub, allUnsub } = get();
    if (todayUnsub) todayUnsub();
    if (allUnsub) allUnsub();
    set({ todayUnsub: null, allUnsub: null });
  },

  loadMorningStock: async ({ staffId, staffName, items, notes, date }) => {
    set({ isSaving: true });
    try {
      const session = await staffStockService.loadMorningStock(
        staffId,
        staffName,
        items,
        notes,
        date
      );

      // Optimistic update
      set({ todaySession: session, isSaving: false });

      // Optimistically deduct ONLY extraLoadedQty from in-memory inventory store
      const inventoryState = useInventoryStore.getState();
      const currentProducts = inventoryState.products;
      const extraMap = new Map(items.map((i) => [i.productId, i.extraLoadedQty || 0]));

      const updatedProducts = currentProducts.map((p) => {
        const extra = extraMap.get(p.id) || 0;
        if (extra > 0) {
          const newQty = Math.max(0, p.stockQty - extra);
          return {
            ...p,
            stockQty: newQty,
            availableStock: newQty,
          };
        }
        return p;
      });

      useInventoryStore.setState({ products: updatedProducts });

      return session;
    } catch (err) {
      set({ isSaving: false });
      throw err;
    }
  },

  returnEveningStock: async ({ staffId, items, notes, date }) => {
    set({ isSaving: true });
    try {
      const session = await staffStockService.returnEveningStock(
        staffId,
        items,
        notes,
        date
      );

      // Optimistic update
      set({ todaySession: session, isSaving: false });

      // Optimistically add ONLY returnedQty (good condition) back to in-memory inventory store
      // Damaged and missing items are NOT added to inventory!
      const inventoryState = useInventoryStore.getState();
      const currentProducts = inventoryState.products;
      const returnMap = new Map(items.map((i) => [i.productId, i.returnedQty || 0]));

      const updatedProducts = currentProducts.map((p) => {
        const returned = returnMap.get(p.id) || 0;
        if (returned > 0) {
          const newQty = (p.stockQty || 0) + returned;
          return {
            ...p,
            stockQty: newQty,
            availableStock: newQty,
          };
        }
        return p;
      });

      useInventoryStore.setState({ products: updatedProducts });

      return session;
    } catch (err) {
      set({ isSaving: false });
      throw err;
    }
  },

  recordDeliveredUnits: async (staffId, deliveredItems, date) => {
    try {
      // Optimistically update todaySession if loaded in memory
      const currentSession = get().todaySession;
      if (currentSession && currentSession.staffId === staffId) {
        const itemsMap: Record<string, StaffStockItem> = {};
        (currentSession.items || []).forEach((it) => {
          itemsMap[it.productId] = { ...it };
        });

        for (const d of deliveredItems) {
          if (itemsMap[d.productId]) {
            const item = itemsMap[d.productId];
            const newDelivered = item.deliveredQty + (d.deliveredQty || 0);
            const newDamaged = (item.damagedQty || 0) + (d.damagedQty || 0);
            const newMissing = (item.missingQty || 0) + (d.missingQty || 0);
            const curStock = Math.max(
              0,
              item.loadedQty - newDelivered - (item.returnedQty || 0) - newDamaged - newMissing
            );
            itemsMap[d.productId] = {
              ...item,
              deliveredQty: newDelivered,
              damagedQty: newDamaged,
              missingQty: newMissing,
              currentStock: curStock,
            };
          }
        }

        const updatedItems = Object.values(itemsMap);
        const totalDelivered = updatedItems.reduce((sum, it) => sum + it.deliveredQty, 0);
        const totalDamaged = updatedItems.reduce((sum, it) => sum + (it.damagedQty || 0), 0);
        const totalMissing = updatedItems.reduce((sum, it) => sum + (it.missingQty || 0), 0);

        set({
          todaySession: {
            ...currentSession,
            items: updatedItems,
            totalDeliveredUnits: totalDelivered,
            totalDamagedUnits: totalDamaged,
            totalMissingUnits: totalMissing,
          },
        });
      }

      await staffStockService.recordDeliveredUnits(staffId, deliveredItems, date);
    } catch (err) {
      console.warn('Error recording delivered units in staff stock session:', err);
    }
  },

  syncOutForDeliveryStock: async (staffId, orders, date) => {
    try {
      await staffStockService.syncOutForDeliveryStock(staffId, orders, date);
    } catch (err) {
      console.warn('Error syncing out for delivery stock:', err);
    }
  },
}));
