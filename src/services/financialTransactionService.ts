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
import { BUSINESS_RULES } from '../constants/rules';
import { staffStockService } from './staffStockService';

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

      // Read product documents for stock restoration / deduction (ALL READS before writes)
      type ProductRead = {
        ref: ReturnType<typeof doc>;
        productId: string;
        currentStock: number;
        orderedQty: number;
        deliveredQty: number;
        damagedQty: number;
      };
      const productReads: ProductRead[] = [];

      const itemMapByProductId = new Map<string, OrderItem>();
      for (const item of updatedItems) {
        itemMapByProductId.set(item.productId, item);
      }

      const allProductIds = Array.from(
        new Set([
          ...updatedItems.map((i) => i.productId),
          ...(existingOrder.items || []).map((i) => i.productId),
        ])
      );

      for (const prodId of allProductIds) {
        const productRef = doc(db, PRODUCTS_COLLECTION, prodId);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          const originalItem = (existingOrder.items || []).find((i) => i.productId === prodId);
          const updatedItem = itemMapByProductId.get(prodId);

          const orderedQty =
            updatedItem?.orderedQty !== undefined
              ? updatedItem.orderedQty
              : (originalItem?.orderedQty || 0);
          const deliveredQty = updatedItem ? updatedItem.deliveredQty || 0 : 0;
          const damagedQty = updatedItem ? updatedItem.damagedQty || 0 : 0;

          productReads.push({
            ref: productRef,
            productId: prodId,
            currentStock: product.stockQty || 0,
            orderedQty,
            deliveredQty,
            damagedQty,
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
      const TAX_RATE = BUSINESS_RULES.TAX_RATE || 0;
      const newTax = newSubtotal * TAX_RATE;
      const newTotalAmount = newSubtotal + newTax;

      // Determine delivery status from item-level exceptions
      const hasMissingOrDamaged = updatedItems.some(
        (item) => (item.missingDamagedQty || 0) > 0 || (item.damagedQty || 0) > 0
      );
      const finalStatus: OrderStatus = hasMissingOrDamaged
        ? 'PARTIALLY_DELIVERED'
        : 'DELIVERED';

      const nowStr = new Date().toISOString();
      const nowTimestamp = Date.now();

      // Vendor current balance (before this transaction)
      const vendorExists = vendorSnap.exists();
      const vendor = vendorExists ? (vendorSnap.data() as Vendor) : null;
      const currentVendorBalance = vendor ? vendor.currentBalance || 0 : 0;
      const vendorAdvanceAvailable =
        vendor?.advanceBalance && vendor.advanceBalance > 0
          ? vendor.advanceBalance
          : currentVendorBalance < 0
          ? Math.abs(currentVendorBalance)
          : 0;

      const totalAvailableAdvance = Math.max(
        existingOrder.advanceAdjusted || 0,
        vendorAdvanceAvailable,
        existingOrder.preferredPaymentMode === 'ADVANCE' || actualPaymentMode === 'ADVANCE'
          ? (existingOrder.totalAmount || newTotalAmount)
          : 0
      );
      const advanceAdjusted = Math.min(newTotalAmount, totalAvailableAdvance);
      const finalBillAmount = Math.max(0, newTotalAmount - advanceAdjusted);
      const isAdvanceCovered = advanceAdjusted >= newTotalAmount;

      const effectiveActualPaymentMode: PaymentMethod = isAdvanceCovered ? 'ADVANCE' : actualPaymentMode;
      const safePaidAmount = isAdvanceCovered ? 0 : Math.max(0, paidAmount);

      const newBalanceDue = Math.max(0, finalBillAmount - safePaidAmount);

      // After this delivery, vendor balance is updated by the invoice total minus cash collected
      const updatedVendorBalance = Math.round((currentVendorBalance + newTotalAmount - safePaidAmount) * 100) / 100;
      const currentOutstanding = Math.max(0, updatedVendorBalance);
      const advanceBalance = Math.max(0, -updatedVendorBalance);

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
          advanceAdjusted,
          finalBillAmount,
          status: finalStatus,
          actualPaymentMode: effectiveActualPaymentMode,
          paidAmount: safePaidAmount,
          balanceDue: newBalanceDue,
          deliveredAt: nowStr,
          deliveryFinalized: true,
          invoiceId: orderId,
          notes: notes !== undefined ? notes : existingOrder.notes || '',
          updatedAt: serverTimestamp(),
        })
      );

      // 2. Adjust warehouse stock (restore missing units, deduct extra delivered units)
      // Rule: Missing items (ordered > delivered) return to sellable stock (minus damaged).
      //       Extra delivered items (delivered > ordered) are deducted from stock.
      //       Damaged items are flagged but do NOT return to stock.
      const restoredStockMap: Record<string, number> = {};
      for (const { ref, productId, currentStock, orderedQty, deliveredQty, damagedQty } of productReads) {
        const stockDelta = orderedQty - deliveredQty - damagedQty;

        if (stockDelta !== 0) {
          const newStock = Math.max(0, currentStock + stockDelta);
          transaction.update(ref, {
            stockQty: newStock,
            availableStock: newStock,
            updatedAt: serverTimestamp(),
          });
          restoredStockMap[productId] = newStock;
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
          currentOutstanding,
          advanceBalance,
          updatedAt: serverTimestamp(),
        });
      }

      // 4. Write DEBIT ledger entry (invoice charge)
      //    runningBalance after DEBIT = prevBalance + invoiceTotal
      const debitNote =
        effectiveActualPaymentMode === 'ADVANCE'
          ? `Invoice for Order ${existingOrder.orderNumber} (Settled via Advance)`
          : advanceAdjusted > 0
          ? `Invoice for Order ${existingOrder.orderNumber} (₹${advanceAdjusted.toLocaleString('en-IN')} advance deducted)`
          : finalStatus === 'PARTIALLY_DELIVERED'
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
        runningBalance: Math.round((currentVendorBalance + newTotalAmount) * 100) / 100,
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
          runningBalance: Math.round((currentVendorBalance + newTotalAmount - safePaidAmount) * 100) / 100,
          referenceId: receiptNumber,
          referenceNo: receiptNumber,
          orderId: existingOrder.id,
          invoiceId: orderId,
          sourceType: 'PAYMENT',
          idempotencyKey: `${orderId}:CREDIT`,
          date: nowStr,
          note: `${effectiveActualPaymentMode} payment collected at delivery for ${existingOrder.orderNumber}`,
          paymentMethod: effectiveActualPaymentMode,
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
        advanceAdjusted,
        finalBillAmount,
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

    // 8. Update staff's on-hand vehicle stock session for today
    try {
      const deliveredPayload = updatedItems.map((it) => ({
        productId: it.productId,
        deliveredQty: it.deliveredQty || 0,
        damagedQty: it.damagedQty || 0,
      }));

      // We read the order to get the assigned staff ID
      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      const orderDoc = await import('firebase/firestore').then((m) => m.getDoc(orderRef));
      if (orderDoc.exists()) {
        const orderData = orderDoc.data() as Order;
        if (orderData.assignedStaffId) {
          await staffStockService.recordDeliveredUnits(
            orderData.assignedStaffId,
            deliveredPayload,
            undefined,
            orderId  // idempotency key: prevents double-counting if store already applied it
          );
        }
      }
    } catch (stockErr) {
      console.warn('[financialTransactionService] Could not update staff vehicle stock session:', stockErr);
    }
  },

  /**
   * Atomically creates and finalizes a Direct Spot Delivery when vendor did not place an order in advance.
   *
   * Writes:
   * 1. Creates Order doc in 'orders' (status: DELIVERED, deliveryFinalized: true)
   * 2. Writes DEBIT ledger entry (invoice charge for delivered products)
   * 3. Writes CREDIT ledger entry (if payment collected at delivery)
   * 4. Updates vendor currentBalance, currentOutstanding, advanceBalance, lastOrderDate, lastPaymentDate
   * 5. Creates Invoice doc in 'invoices'
   * 6. Writes AuditLog doc in 'auditLogs'
   * 7. Updates staff on-hand vehicle stock session (recordDeliveredUnits)
   */
  recordDirectSpotDelivery: async (params: {
    vendorId: string;
    staffId: string;
    staffName: string;
    staffPhone?: string;
    items: {
      productId: string;
      productName: string;
      unit: string;
      unitPrice: number;
      quantity: number;
    }[];
    paymentMode: PaymentMethod;
    paidAmount: number;
    notes?: string;
  }): Promise<Order> => {
    const {
      vendorId,
      staffId,
      staffName,
      staffPhone,
      items,
      paymentMode,
      paidAmount,
      notes,
    } = params;

    if (!items || items.length === 0) {
      throw new Error('Please select at least one product to deliver.');
    }

    const orderDocRef = doc(collection(db, ORDERS_COLLECTION));
    const orderId = orderDocRef.id;
    const nowStr = new Date().toISOString();
    const nowTimestamp = Date.now();
    const orderNumber = `ORD-2026-${nowTimestamp.toString().slice(-4)}`;
    const invoiceNumber = `INV-${orderNumber}`;
    const receiptNumber = `RCPT-${nowTimestamp.toString().slice(-6)}`;

    let createdOrder: Order | null = null;

    await runTransaction(db, async (transaction) => {
      // ── PHASE 1: READS ──
      const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
      const vendorSnap = await transaction.get(vendorRef);
      if (!vendorSnap.exists()) {
        throw new Error(`Vendor with ID ${vendorId} not found.`);
      }
      const vendor = vendorSnap.data() as Vendor;

      // ── PHASE 2: CALCULATIONS ──
      const subtotal = items.reduce(
        (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
        0
      );
      const TAX_RATE = BUSINESS_RULES.TAX_RATE || 0;
      const tax = subtotal * TAX_RATE;
      const totalAmount = subtotal + tax;

      const safePaidAmount = Math.max(0, paidAmount);
      const balanceDue = Math.max(0, totalAmount - safePaidAmount);

      const currentVendorBalance = vendor.currentBalance || 0;
      const updatedVendorBalance =
        Math.round((currentVendorBalance + totalAmount - safePaidAmount) * 100) / 100;
      const currentOutstanding = Math.max(0, updatedVendorBalance);
      const advanceBalance = Math.max(0, -updatedVendorBalance);

      const debitEntryId = `${orderId}_debit`;
      const creditEntryId = `${orderId}_credit`;
      const debitEntryRef = doc(db, LEDGER_COLLECTION, debitEntryId);
      const creditEntryRef = doc(db, LEDGER_COLLECTION, creditEntryId);
      const invoiceRef = doc(db, INVOICES_COLLECTION, orderId);
      const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));

      const invoiceStatus: InvoiceStatus =
        balanceDue === 0
          ? 'PAID'
          : safePaidAmount > 0
          ? 'PARTIALLY_PAID'
          : 'FINALIZED';

      const orderLineItems: OrderItem[] = items.map((it, idx) => ({
        id: `item-${idx}-${Date.now()}`,
        productId: it.productId,
        productName: it.productName,
        unit: it.unit,
        unitPrice: it.unitPrice,
        orderedQty: it.quantity,
        deliveredQty: it.quantity,
        missingDamagedQty: 0,
        damagedQty: 0,
        totalAmount: it.quantity * it.unitPrice,
      }));

      createdOrder = {
        id: orderId,
        orderId,
        orderNumber,
        vendorId: vendor.id,
        vendorName: vendor.name,
        shopName: vendor.shopName || vendor.name,
        phone: vendor.phone || '',
        address: vendor.address || '',
        locationUrl: vendor.locationUrl,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        routeId: vendor.routeId,
        routeName: vendor.routeName || vendor.area,
        assignedStaffId: staffId,
        assignedStaffName: staffName,
        assignedStaffPhone: staffPhone || '',
        items: orderLineItems,
        subtotal,
        tax,
        discount: 0,
        totalAmount,
        advanceAdjusted: 0,
        finalBillAmount: totalAmount,
        status: 'DELIVERED',
        preferredPaymentMode: paymentMode,
        actualPaymentMode: paymentMode,
        paidAmount: safePaidAmount,
        balanceDue,
        orderDate: nowStr,
        deliveryDate: nowStr,
        dispatchedAt: nowStr,
        deliveredAt: nowStr,
        deliveryFinalized: true,
        invoiceId: orderId,
        notes: notes || 'Direct Spot Delivery by Staff',
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      // ── PHASE 3: WRITES ──
      // 1. Order document
      transaction.set(
        orderDocRef,
        cleanFirestoreData({
          ...createdOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      // 2. Vendor document balance update
      transaction.update(
        vendorRef,
        cleanFirestoreData({
          currentBalance: updatedVendorBalance,
          currentOutstanding,
          advanceBalance,
          lastOrderDate: nowStr,
          ...(safePaidAmount > 0 ? { lastPaymentDate: nowStr } : {}),
          updatedAt: serverTimestamp(),
        })
      );

      // 3. DEBIT ledger entry (Invoice)
      const debitEntry: LedgerEntry = {
        id: debitEntryId,
        entryId: debitEntryId,
        accountType: 'vendor',
        accountId: vendor.id,
        partyId: vendor.id,
        partyName: vendor.shopName || vendor.name,
        partyType: 'VENDOR',
        type: 'DEBIT',
        transactionType: 'DEBIT',
        direction: 'debit',
        amount: totalAmount,
        runningBalance: Math.round((currentVendorBalance + totalAmount) * 100) / 100,
        referenceId: invoiceNumber,
        referenceNo: invoiceNumber,
        orderId,
        invoiceId: orderId,
        sourceType: 'INVOICE',
        idempotencyKey: `${orderId}:DEBIT`,
        date: nowStr,
        note: `Direct spot delivery invoice for ${orderNumber}`,
        createdBy: staffName,
        createdRole: 'STAFF',
        createdAt: nowStr,
      };
      transaction.set(
        debitEntryRef,
        cleanFirestoreData({ ...debitEntry, createdAt: serverTimestamp() })
      );

      // 4. CREDIT ledger entry (Payment received, if any)
      if (safePaidAmount > 0) {
        const creditEntry: LedgerEntry = {
          id: creditEntryId,
          entryId: creditEntryId,
          accountType: 'vendor',
          accountId: vendor.id,
          partyId: vendor.id,
          partyName: vendor.shopName || vendor.name,
          partyType: 'VENDOR',
          type: 'CREDIT',
          transactionType: 'CREDIT',
          direction: 'credit',
          amount: safePaidAmount,
          runningBalance: Math.round((currentVendorBalance + totalAmount - safePaidAmount) * 100) / 100,
          referenceId: receiptNumber,
          referenceNo: receiptNumber,
          orderId,
          invoiceId: orderId,
          sourceType: 'PAYMENT',
          idempotencyKey: `${orderId}:CREDIT`,
          date: nowStr,
          note: `${paymentMode} payment collected for direct spot delivery ${orderNumber}`,
          paymentMethod: paymentMode,
          createdBy: staffName,
          createdRole: 'STAFF',
          createdAt: nowStr,
        };
        transaction.set(
          creditEntryRef,
          cleanFirestoreData({ ...creditEntry, createdAt: serverTimestamp() })
        );
      }

      // 5. Invoice document
      const invoice: Invoice = {
        id: orderId,
        invoiceNumber,
        orderId,
        vendorId: vendor.id,
        vendorName: vendor.name,
        shopName: vendor.shopName || vendor.name,
        status: invoiceStatus,
        lineItems: orderLineItems,
        subtotal,
        taxAmount: tax,
        discountAmount: 0,
        totalAmount,
        paidAmount: safePaidAmount,
        balanceDue,
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

      // 6. Audit Log
      transaction.set(auditRef, {
        id: auditRef.id,
        action: 'DIRECT_SPOT_DELIVERY_RECORDED',
        performedBy: staffName,
        userRole: 'STAFF',
        entityType: 'ORDER',
        entityId: orderId,
        timestamp: nowStr,
        reason: `Direct spot delivery to ${vendor.shopName || vendor.name} recorded by ${staffName}`,
        details:
          `Invoice ${invoiceNumber} created. ` +
          `Status: DELIVERED. ` +
          `Total: ₹${totalAmount.toFixed(2)}, ` +
          `Paid: ₹${safePaidAmount.toFixed(2)}, ` +
          `Balance Due: ₹${balanceDue.toFixed(2)}`,
        createdAt: serverTimestamp(),
      });
    });

    // Update staff daily vehicle stock session
    if (staffId && items.length > 0) {
      try {
        const deliveredPayload = items.map((it) => ({
          productId: it.productId,
          deliveredQty: it.quantity || 0,
        }));
        await staffStockService.recordDeliveredUnits(staffId, deliveredPayload, undefined, orderId);
      } catch (stockErr) {
        console.warn('[financialTransactionService] Could not update staff vehicle stock session:', stockErr);
      }
    }

    return createdOrder!;
  },
};
