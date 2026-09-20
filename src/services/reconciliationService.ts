/**
 * reconciliationService.ts
 *
 * DIAGNOSTIC-ONLY service. Read-only queries that detect financial data integrity
 * issues in Firestore (does NOT modify any data).
 *
 * Designed to help the Admin identify pre-existing duplicate entries created
 * before the financialTransactionService idempotency fix was deployed.
 */

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { LedgerEntry, Order } from '../types';

const LEDGER_COLLECTION = 'ledgerEntries';
const ORDERS_COLLECTION = 'orders';

export interface DuplicateEntryReport {
  orderId: string;
  orderNumber: string;
  vendorId: string;
  debitCount: number;
  creditCount: number;
  debitEntries: Pick<LedgerEntry, 'id' | 'amount' | 'date' | 'createdAt' | 'idempotencyKey'>[];
}

export interface UnfinalizedOrderReport {
  orderId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  deliveredAt?: string;
  totalAmount: number;
}

export interface ReconciliationReport {
  generatedAt: string;
  duplicateEntries: DuplicateEntryReport[];
  unfinalizedDeliveries: UnfinalizedOrderReport[];
  summary: {
    totalDuplicateOrders: number;
    totalUnfinalizedOrders: number;
    isClean: boolean;
  };
}

export const reconciliationService = {
  /**
   * Detects orders where more than one DEBIT ledger entry exists.
   * This happens when both CheckoutScreen and orderService wrote entries
   * for the same order before the idempotency fix was deployed.
   */
  detectDuplicateLedgerEntries: async (): Promise<DuplicateEntryReport[]> => {
    try {
      const ledgerSnap = await getDocs(
        query(
          collection(db, LEDGER_COLLECTION),
          where('partyType', '==', 'VENDOR'),
          where('type', '==', 'DEBIT')
        )
      );

      const entries = ledgerSnap.docs.map((d) => ({
        ...(d.data() as LedgerEntry),
        id: d.id,
      }));

      // Group by orderId
      const byOrderId: Record<string, typeof entries> = {};
      for (const entry of entries) {
        if (entry.orderId) {
          if (!byOrderId[entry.orderId]) byOrderId[entry.orderId] = [];
          byOrderId[entry.orderId].push(entry);
        }
      }

      const duplicates: DuplicateEntryReport[] = [];
      for (const [orderId, orderEntries] of Object.entries(byOrderId)) {
        if (orderEntries.length > 1) {
          // More than one DEBIT for same order = duplicate
          const creditEntries = entries.filter(
            (e) => e.orderId === orderId && e.type === 'CREDIT'
          );
          duplicates.push({
            orderId,
            orderNumber: orderEntries[0]?.referenceNo || orderId,
            vendorId: orderEntries[0]?.partyId || '',
            debitCount: orderEntries.length,
            creditCount: creditEntries.length,
            debitEntries: orderEntries.map((e) => ({
              id: e.id,
              amount: e.amount,
              date: e.date,
              createdAt: e.createdAt,
              idempotencyKey: e.idempotencyKey,
            })),
          });
        }
      }

      return duplicates;
    } catch (error) {
      console.error('[reconciliationService] detectDuplicateLedgerEntries error:', error);
      return [];
    }
  },

  /**
   * Finds orders with DELIVERED or PARTIALLY_DELIVERED status but without
   * the `deliveryFinalized` flag set to true. These orders were confirmed
   * before the new financial system was deployed and may need manual review.
   */
  detectUnfinalizedDeliveredOrders: async (): Promise<UnfinalizedOrderReport[]> => {
    try {
      const deliveredSnap = await getDocs(
        query(
          collection(db, ORDERS_COLLECTION),
          where('status', 'in', ['DELIVERED', 'PARTIALLY_DELIVERED']),
          orderBy('deliveredAt', 'desc')
        )
      );

      const unfinalized: UnfinalizedOrderReport[] = [];
      for (const d of deliveredSnap.docs) {
        const order = d.data() as Order;
        // deliveryFinalized missing or explicitly false
        if (!order.deliveryFinalized) {
          unfinalized.push({
            orderId: d.id,
            orderNumber: order.orderNumber,
            vendorId: order.vendorId,
            vendorName: order.shopName || order.vendorName,
            status: order.status,
            deliveredAt: order.deliveredAt,
            totalAmount: order.totalAmount,
          });
        }
      }

      return unfinalized;
    } catch (error) {
      console.error('[reconciliationService] detectUnfinalizedDeliveredOrders error:', error);
      return [];
    }
  },

  /**
   * Generates a full reconciliation report.
   * This is a read-only diagnostic — no data is modified.
   */
  generateReport: async (): Promise<ReconciliationReport> => {
    const [duplicateEntries, unfinalizedDeliveries] = await Promise.all([
      reconciliationService.detectDuplicateLedgerEntries(),
      reconciliationService.detectUnfinalizedDeliveredOrders(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      duplicateEntries,
      unfinalizedDeliveries,
      summary: {
        totalDuplicateOrders: duplicateEntries.length,
        totalUnfinalizedOrders: unfinalizedDeliveries.length,
        isClean: duplicateEntries.length === 0 && unfinalizedDeliveries.length === 0,
      },
    };
  },
};
