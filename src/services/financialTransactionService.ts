/**
 * financialTransactionService.ts
 *
 * The single, canonical source of truth for all financial writes in the DMS.
 *
 * ALL debit/credit ledger entries, invoice creation, and vendor balance updates
 * MUST go through this service. No other code path should write to `ledgerEntries`,
 * `invoices`, or update `vendors.currentBalance` during order fulfillment.
 *
 * Design decisions:
 * - Uses deterministic Firestore document IDs derived from orderId so that `setDoc`
 *   is naturally idempotent (retries cannot create duplicate documents).
 * - An additional `deliveryFinalized` boolean flag on the order document acts as a
 *   fast-path idempotency guard checked at the top of the transaction.
 * - All Firestore reads precede all writes (Firestore transaction requirement).
 */

import {
  runTransaction,
  doc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Order,
  OrderItem,
  Vendor,
  Product,
  LedgerEntry,
  Invoice,
  InvoiceStatus,
  PaymentMethod,
  OrderStatus,
} from '../types';

const ORDERS_COLLECTION = 'orders';
const VENDORS_COLLECTION = 'vendors';
const PRODUCTS_COLLECTION = 'products';
const LEDGER_COLLECTION = 'ledgerEntries';
const INVOICES_COLLECTION = 'invoices';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

/** Strips `undefined` values from objects before Firestore writes. */
function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        cleaned[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? cleanFirestoreData(item)
            : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export const financialTransactionService = {
  /**
   * Atomically finalizes a delivery. This is the ONLY place that:
   * 1. Writes a DEBIT ledger entry (invoice) for a vendor
   * 2. Writes a CREDIT ledger entry (payment collected at delivery)
   * 3. Updates vendor.currentBalance
   * 4. Creates an Invoice document
   * 5. Restores missing (non-damaged) stock to inventory
   *
   * Idempotency: If `order.deliveryFinalized === true`, the function exits
   * immediately without writing any data. Deterministic doc IDs also prevent
   * duplicate Firestore documents even if called multiple times.
   *
   * @param orderId        - The order document ID to finalize
   * @param updatedItems   - Final delivered quantities per line item
   * @param actualPaymentMode - The payment method actually used at delivery
   * @param paidAmount     - Cash/Online amount collected (0 if PAY_LATER)
   * @param notes          - Optional delivery notes from staff
   */
  finalizeDelivery: async (
    orderId: string,
    updatedItems: OrderItem[],
    actualPaymentMode: PaymentMethod,
    paidAmount: number,
    notes?: string
  ): Promise<void> => {
    await runTransaction(db, async (transaction) => {
      // ────────────────────────────────────────────────────────────────────
      // PHASE 1: ALL READS FIRST (Firestore transaction requirement)
      // ────────────────────────────────────────────────────────────────────

      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists()) {
        throw new Error(`Order ${orderId} not found.`);
      }

      const existingOrder = orderSnap.data() as Order;

      // ── IDEMPOTENCY GUARD ─────────────────────────────────────────────
      // If already finalized, exit immediately. This prevents double-billing
      // from UI retries or duplicate calls in ActualPaymentScreen.
      if (existingOrder.deliveryFinalized === true) {
        console.warn(
          `[financialTransactionService] Order ${orderId} already finalized — skipping duplicate write.`
        );
        return;
      }

      const vendorRef = doc(db, VENDORS_COLLECTION, existingOrder.vendorId);
      const vendorSnap = await transaction.get(vendorRef);

      // Read product documents for stock restoration (ALL READS before writes)
      type ProductRead = { ref: ReturnType<typeof doc>; currentStock: number; item: OrderItem };
      const productReads: ProductRead[] = [];

      for (const item of updatedItems) {
        const productRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          productReads.push({
            ref: productRef,
            currentStock: product.stockQty || 0,
            item,
          });
        }
      }

      // ────────────────────────────────────────────────────────────────────
      // PHASE 2: CALCULATIONS (no Firestore reads after this point)
      // ────────────────────────────────────────────────────────────────────

      // Recalculate totals based on DELIVERED quantities only
      const newSubtotal = updatedItems.reduce(
        (sum, item) => sum + item.deliveredQty * item.unitPrice,
        0
      );
      const TAX_RATE = 0.05;
      const newTax = newSubtotal * TAX_RATE;
      const newTotalAmount = newSubtotal + newTax;

      // Determine delivery status from item-level exceptions
      const hasMissingOrDamaged = updatedItems.some(
        (item) => (item.missingDamagedQty || 0) > 0 || (item.damagedQty || 0) > 0
      );
      const finalStatus: OrderStatus = hasMissingOrDamaged
        ? 'PARTIALLY_DELIVERED'
        : 'DELIVERED';

      const safePaidAmount = Math.max(0, paidAmount);

      const nowStr = new Date().toISOString();
      const nowTimestamp = Date.now();

      // Vendor current balance (before this transaction)
      const vendorExists = vendorSnap.exists();
      const vendor = vendorExists ? (vendorSnap.data() as Vendor) : null;
      const currentVendorBalance = vendor ? vendor.currentBalance || 0 : 0;

      const newBalanceDue = Math.max(0, newTotalAmount - safePaidAmount);

      // After this delivery, vendor balance is updated by the invoice total minus cash collected
      const updatedVendorBalance = Math.max(0, currentVendorBalance + newTotalAmount - safePaidAmount);

      // ── Deterministic Document IDs ────────────────────────────────────
      // Using orderId-derived IDs makes setDoc idempotent:
      // repeated calls overwrite the same document rather than creating duplicates.
      const debitEntryId = `${orderId}_debit`;
      const creditEntryId = `${orderId}_credit`;
      const debitEntryRef = doc(db, LEDGER_COLLECTION, debitEntryId);
      const creditEntryRef = doc(db, LEDGER_COLLECTION, creditEntryId);
      const invoiceRef = doc(db, INVOICES_COLLECTION, orderId);
      const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

      const invoiceNumber = `INV-${existingOrder.orderNumber}`;
      const receiptNumber = `RCPT-${nowTimestamp.toString().slice(-6)}`;

      // Invoice status based on payment
      const invoiceStatus: InvoiceStatus =
        newBalanceDue === 0
          ? 'PAID'
          : safePaidAmount > 0
          ? 'PARTIALLY_PAID'
          : 'FINALIZED';

      const staffName =
        existingOrder.assignedStaffName || 'Delivery Executive';

      // ────────────────────────────────────────────────────────────────────
      // PHASE 3: ALL WRITES (atomic block)
      // ────────────────────────────────────────────────────────────────────

      // 1. Update Order document — mark as finalized
      transaction.update(
        orderRef,
        cleanFirestoreData({
          items: updatedItems,
          subtotal: newSubtotal,
          tax: newTax,
          totalAmount: newTotalAmount,
          status: finalStatus,
          actualPaymentMode,
          paidAmount: safePaidAmount,
          balanceDue: newBalanceDue,
          deliveredAt: nowStr,
          deliveryFinalized: true,
          invoiceId: orderId,
          notes: notes !== undefined ? notes : existingOrder.notes || '',
          updatedAt: serverTimestamp(),
        })
      );

      // 2. Restore MISSING (non-damaged) stock to inventory
      // Rule: Missing items (lost in transit) return to sellable stock.
      //       Damaged items are flagged but do NOT return to stock.
      const restoredStockMap: Record<string, number> = {};
      for (const { ref, currentStock, item } of productReads) {
        const damagedQty = item.damagedQty || 0;
        // missingQty = items that were ordered, not delivered, and not damaged
        const missingQty = Math.max(
          0,
          item.orderedQty - item.deliveredQty - damagedQty
        );

        if (missingQty > 0) {
          const restoredStock = currentStock + missingQty;
          transaction.update(ref, {
            stockQty: restoredStock,
            availableStock: restoredStock,
            updatedAt: serverTimestamp(),
          });
          restoredStockMap[item.productId] = restoredStock;
        }
      }

      // Update consolidated Live Stock Map in transaction
      if (Object.keys(restoredStockMap).length > 0) {
        const stockRef = doc(db, 'system', 'live_stock');
        transaction.set(stockRef, restoredStockMap, { merge: true });
      }

      // 3. Update vendor outstanding balance
      if (vendorExists) {
        transaction.update(vendorRef, {
          currentBalance: updatedVendorBalance,
          currentOutstanding: updatedVendorBalance,
          updatedAt: serverTimestamp(),
        });
      }

      // 4. Write DEBIT ledger entry (invoice charge)
      //    runningBalance after DEBIT = prevBalance + invoiceTotal
      const debitNote =
        finalStatus === 'PARTIALLY_DELIVERED'
          ? `Invoice for Order ${existingOrder.orderNumber} (Partial delivery)`
          : `Invoice for Order ${existingOrder.orderNumber}`;

      const debitEntry: LedgerEntry = {
        id: debitEntryId,
        entryId: debitEntryId,
        accountType: 'vendor',
        accountId: existingOrder.vendorId,
        partyId: existingOrder.vendorId,
        partyName: existingOrder.shopName || existingOrder.vendorName,
        partyType: 'VENDOR',
        type: 'DEBIT',
        transactionType: 'DEBIT',
        direction: 'debit',
        amount: newTotalAmount,
        runningBalance: currentVendorBalance + newTotalAmount,
        referenceId: invoiceNumber,
        referenceNo: invoiceNumber,
        orderId: existingOrder.id,
        invoiceId: orderId,
        sourceType: 'INVOICE',
        idempotencyKey: `${orderId}:DEBIT`,
        date: nowStr,
        note: debitNote,
        createdBy: staffName,
        createdRole: 'STAFF',
        createdAt: nowStr,
      };

      transaction.set(
        debitEntryRef,
        cleanFirestoreData({ ...debitEntry, createdAt: serverTimestamp() })
      );

      // 5. Write CREDIT ledger entry if payment was collected at delivery
      //    runningBalance after CREDIT = prevBalance + invoiceTotal - paidAmount
      if (safePaidAmount > 0) {
        const creditEntry: LedgerEntry = {
          id: creditEntryId,
          entryId: creditEntryId,
          accountType: 'vendor',
          accountId: existingOrder.vendorId,
          partyId: existingOrder.vendorId,
          partyName: existingOrder.shopName || existingOrder.vendorName,
          partyType: 'VENDOR',
          type: 'CREDIT',
          transactionType: 'CREDIT',
          direction: 'credit',
          amount: safePaidAmount,
          runningBalance: currentVendorBalance + newTotalAmount - safePaidAmount,
          referenceId: receiptNumber,
          referenceNo: receiptNumber,
          orderId: existingOrder.id,
          invoiceId: orderId,
          sourceType: 'PAYMENT',
          idempotencyKey: `${orderId}:CREDIT`,
          date: nowStr,
          note: `${actualPaymentMode} payment collected at delivery for ${existingOrder.orderNumber}`,
          paymentMethod: actualPaymentMode,
          createdBy: staffName,
          createdRole: 'STAFF',
          createdAt: nowStr,
        };

        transaction.set(
          creditEntryRef,
          cleanFirestoreData({ ...creditEntry, createdAt: serverTimestamp() })
        );
      }

      // 6. Create Invoice document (persisted record for invoice-level queries)
      const invoice: Invoice = {
        id: orderId,
        invoiceNumber,
        orderId,
        vendorId: existingOrder.vendorId,
        vendorName: existingOrder.vendorName,
        shopName: existingOrder.shopName,
        status: invoiceStatus,
        lineItems: updatedItems,
        subtotal: newSubtotal,
        taxAmount: newTax,
        discountAmount: existingOrder.discount || 0,
        totalAmount: newTotalAmount,
        paidAmount: safePaidAmount,
        balanceDue: newBalanceDue,
        invoiceDate: nowStr,
        deliveryFinalized: true,
        createdBy: staffName,
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      transaction.set(
        invoiceRef,
        cleanFirestoreData({
          ...invoice,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      // 7. Write AuditLog for traceability
      transaction.set(auditRef, {
        id: auditRef.id,
        action: 'DELIVERY_FINALIZED',
        performedBy: staffName,
        userRole: 'STAFF',
        entityType: 'ORDER',
        entityId: orderId,
        timestamp: nowStr,
        reason: `Order ${existingOrder.orderNumber} delivery confirmed by ${staffName}`,
        details:
          `Invoice ${invoiceNumber} created. ` +
          `Status: ${finalStatus}. ` +
          `Total: ₹${newTotalAmount.toFixed(2)}, ` +
          `Paid: ₹${safePaidAmount.toFixed(2)}, ` +
          `Balance: ₹${newBalanceDue.toFixed(2)}`,
        createdAt: serverTimestamp(),
      });
    });
  },
};
