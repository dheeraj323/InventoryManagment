import { create } from 'zustand';
import { CashSettlement } from '../types';
import { MOCK_CASH_SETTLEMENTS } from '../constants/mockData';
import { settlementService } from '../services/settlementService';

interface CashState {
  settlements: CashSettlement[];
  isLoading: boolean;
  subscribeSettlements: () => () => void;
  submitSettlement: (
    staffId: string,
    staffName: string,
    collectedCash: number,
    handedOverCash: number,
    notes?: string
  ) => Promise<CashSettlement>;
  verifySettlement: (settlementId: string, adminName: string) => Promise<void>;
  getPendingSettlements: () => CashSettlement[];
  getStaffCashInHand: (staffId: string, orders?: any[]) => number;
}

export const useCashStore = create<CashState>((set, get) => ({
  settlements: MOCK_CASH_SETTLEMENTS,
  isLoading: false,

  getStaffCashInHand: (staffId: string, orders?: any[]) => {
    // Baseline gross cash collected by staff
    const baselineCollections = 6888;

    // Additional cash collected from orders in state if any
    const orderCollections = orders
      ? orders
          .filter(
            (o) =>
              (o.assignedStaffId === staffId || !o.assignedStaffId) &&
              (o.actualPaymentMode === 'CASH' || o.preferredPaymentMode === 'CASH') &&
              (o.status === 'DELIVERED' || o.status === 'PARTIALLY_DELIVERED')
          )
          .reduce((sum, o) => sum + (o.paidAmount || 0), 0)
      : 0;

    const totalGrossCollected = baselineCollections + orderCollections;

    // Total cash handed over across all submitted and verified settlements for this staff
    const totalHandedOver = get().settlements
      .filter((s) => s.staffId === staffId)
      .reduce(
        (sum, s) =>
          sum + (s.handedOverCash || s.amountHandedOver || s.totalCashCollected || 0),
        0
      );

    return Math.max(0, totalGrossCollected - totalHandedOver);
  },

  subscribeSettlements: () => {
    return settlementService.subscribeSettlements((firestoreSettlements) => {
      if (firestoreSettlements && firestoreSettlements.length > 0) {
        set({ settlements: firestoreSettlements });
      }
    });
  },

  submitSettlement: async (staffId, staffName, collectedCash, handedOverCash, notes) => {
    const variance = handedOverCash - collectedCash;
    const num = get().settlements.length + 10;
    const settlementNumber = `STL-2026-${num}`;

    const newSettlement: CashSettlement = {
      id: `set-${Date.now()}`,
      settlementNumber,
      staffId,
      staffName,
      date: new Date().toISOString().split('T')[0],
      totalCashCollected: collectedCash,
      handedOverCash,
      variance,
      status: 'PENDING_VERIFICATION',
      notes,
    };

    set({ settlements: [newSettlement, ...get().settlements] });

    try {
      const savedDoc = await settlementService.submitSettlement(
        staffId,
        staffName,
        collectedCash,
        handedOverCash,
        notes
      );
      return savedDoc;
    } catch (err) {
      console.error('Error submitting cash settlement to Firestore:', err);
      return newSettlement;
    }
  },

  verifySettlement: async (settlementId: string, adminName: string) => {
    set({
      settlements: get().settlements.map((s) =>
        s.id === settlementId
          ? {
              ...s,
              status: 'VERIFIED',
              verifiedBy: adminName,
              verifiedAt: new Date().toISOString(),
            }
          : s
      ),
    });

    try {
      await settlementService.verifySettlement(settlementId, adminName);
    } catch (err) {
      console.error('Error verifying settlement in Firestore:', err);
    }
  },

  getPendingSettlements: () => {
    return get().settlements.filter((s) => s.status === 'PENDING_VERIFICATION');
  },
}));
