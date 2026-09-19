import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, OrderStatus, PaymentMethod, OrderItem, Vendor, Product, LedgerEntry } from '../types';

const ORDERS_COLLECTION = 'orders';
const VENDORS_COLLECTION = 'vendors';
const PRODUCTS_COLLECTION = 'products';
const LEDGER_COLLECTION = 'ledgerEntries';

function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanFirestoreData(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export const orderService = {
  // Fetch all orders
  getOrders: async (): Promise<Order[]> => {
    try {
      const q = query(collection(db, ORDERS_COLLECTION), orderBy('orderDate', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        orderId: docSnap.id,
        ...docSnap.data(),
      })) as Order[];
    } catch (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
  },

  // Subscribe to real-time order updates
  subscribeOrders: (callback: (orders: Order[]) => void, vendorId?: string, staffId?: string) => {
    let q = query(collection(db, ORDERS_COLLECTION));
    if (vendorId) {
      q = query(collection(db, ORDERS_COLLECTION), where('vendorId', '==', vendorId));
    } else if (staffId) {
      q = query(collection(db, ORDERS_COLLECTION), where('assignedStaffId', '==', staffId));
    }

    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        orderId: docSnap.id,
        ...docSnap.data(),
      })) as Order[];
      // Client-side sort by date descending
      orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      callback(orders);
    }, (error) => {
      console.error('Real-time orders subscription error:', error);
    });
  },

  // Create Order with Credit Limit validation & atomic stock decrement in Firestore Transaction
  createOrder: async (orderData: Omit<Order, 'id' | 'orderNumber'>): Promise<Order> => {
    const newOrderRef = doc(collection(db, ORDERS_COLLECTION));

    return await runTransaction(db, async (transaction) => {
      // 1. Fetch Vendor Document to validate Pay Later eligibility & Credit Limit (READ)
      const vendorRef = doc(db, VENDORS_COLLECTION, orderData.vendorId);
      const vendorSnap = await transaction.get(vendorRef);

      if (vendorSnap.exists()) {
        const vendor = vendorSnap.data() as Vendor;
        if (orderData.preferredPaymentMode === 'PAY_LATER') {
          if (!vendor.payLaterEligible && !vendor.payLaterEnabled) {
            throw new Error('Pay Later is not enabled for this vendor account.');
          }
          const projectedBalance = (vendor.currentBalance || 0) + orderData.totalAmount;
          if (projectedBalance > vendor.creditLimit) {
            throw new Error(
              `Credit Limit Exceeded! Current Outstanding: $${vendor.currentBalance || 0}, Order: $${orderData.totalAmount}, Limit: $${vendor.creditLimit}`
            );
          }
        }
      }

      // 2. Fetch and validate stock for all items first (ALL READS)
      const productUpdates: { ref: any; newStock: number }[] = [];
      for (const item of orderData.items) {
        const productRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          if (product.stockQty < item.orderedQty) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stockQty}, Requested: ${item.orderedQty}`);
          }
          const newStock = product.stockQty - item.orderedQty;
          productUpdates.push({ ref: productRef, newStock });
        }
      }

      // 3. NOW PERFORM ALL WRITES
      for (const pUpdate of productUpdates) {
        transaction.update(pUpdate.ref, {
          stockQty: pUpdate.newStock,
          availableStock: pUpdate.newStock,
          updatedAt: serverTimestamp(),
        });
      }

      const timestampPart = Date.now().toString().slice(-4);
      const orderNumber = `ORD-2026-${timestampPart}`;

      const newOrder: Order = {
        ...orderData,
        id: newOrderRef.id,
        orderId: newOrderRef.id,
        orderNumber,
        notes: orderData.notes || '',
        createdAt: new Date().toISOString(),
      };

      const orderPayload = cleanFirestoreData({
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      transaction.set(newOrderRef, orderPayload);

      return newOrder;
    });
  },

  // Update Order Status
  updateOrderStatus: async (orderId: string, status: OrderStatus): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  },

  // Record Delivery (Staff Action) with atomic balance and ledger recording
  recordDelivery: async (
    orderId: string,
    updatedItems: OrderItem[],
    actualPaymentMode: PaymentMethod,
    paidAmount: number,
    notes?: string
  ): Promise<void> => {
    await runTransaction(db, async (transaction) => {
      // --- PHASE 1: ALL READS FIRST ---
      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists()) {
        throw new Error('Order not found.');
      }

      const existingOrder = orderSnap.data() as Order;

      // Fetch Vendor Document before any writes
      const vendorRef = doc(db, VENDORS_COLLECTION, existingOrder.vendorId);
      const vendorSnap = await transaction.get(vendorRef);

      // --- PHASE 2: CALCULATIONS & PREPARATIONS ---
      // Recalculate delivered totals
      const newSubtotal = updatedItems.reduce(
        (sum, item) => sum + item.deliveredQty * item.unitPrice,
        0
      );
      const newTax = newSubtotal * 0.05;
      const newTotalAmount = newSubtotal + newTax;

      const hasMissingOrDamaged = updatedItems.some(
        (item) => item.missingDamagedQty > 0
      );
      const finalStatus: OrderStatus = !hasMissingOrDamaged
        ? 'DELIVERED'
        : 'PARTIALLY_DELIVERED';

      const safePaidAmount = Math.max(0, paidAmount);
      const newBalanceDue = Math.max(0, newTotalAmount - safePaidAmount);
      const nowStr = new Date().toISOString();

      // --- PHASE 3: ALL WRITES ---
      // 1. Update Order Document
      const orderUpdatePayload = cleanFirestoreData({
        items: updatedItems,
        subtotal: newSubtotal,
        tax: newTax,
        totalAmount: newTotalAmount,
        status: finalStatus,
        actualPaymentMode,
        paidAmount: safePaidAmount,
        balanceDue: newBalanceDue,
        deliveredAt: nowStr,
        notes: notes || existingOrder.notes || '',
        updatedAt: serverTimestamp(),
      });

      transaction.update(orderRef, orderUpdatePayload);

      // 2. If vendor exists, update outstanding balance and write ledger entries
      if (vendorSnap.exists()) {
        const vendor = vendorSnap.data() as Vendor;
        const currentBal = vendor.currentBalance || 0;
        // Vendor balance increases by balance due (Receivable)
        const updatedVendorBalance = currentBal + newBalanceDue;

        transaction.update(vendorRef, {
          currentBalance: updatedVendorBalance,
          currentOutstanding: updatedVendorBalance,
          updatedAt: serverTimestamp(),
        });

        // 3. Record Debit Ledger Entry for the Order Invoice
        const ledgerRef = doc(collection(db, LEDGER_COLLECTION));
        const debitEntry: LedgerEntry = {
          id: ledgerRef.id,
          entryId: ledgerRef.id,
          accountType: 'vendor',
          accountId: existingOrder.vendorId,
          partyId: existingOrder.vendorId,
          partyName: existingOrder.shopName || existingOrder.vendorName,
          partyType: 'VENDOR',
          type: 'DEBIT',
          transactionType: 'DEBIT',
          direction: 'debit',
          amount: newTotalAmount,
          runningBalance: currentBal + newTotalAmount,
          referenceId: existingOrder.orderNumber,
          referenceNo: existingOrder.orderNumber,
          orderId: existingOrder.id,
          date: nowStr,
          note: `Invoice for Order ${existingOrder.orderNumber}`,
          createdBy: existingOrder.assignedStaffName || 'Delivery Executive',
          createdRole: 'STAFF',
          createdAt: nowStr,
        };

        transaction.set(ledgerRef, cleanFirestoreData({
          ...debitEntry,
          createdAt: serverTimestamp(),
        }));

        // 4. Record Credit Ledger Entry if payment was collected at delivery
        if (safePaidAmount > 0) {
          const creditLedgerRef = doc(collection(db, LEDGER_COLLECTION));
          const creditEntry: LedgerEntry = {
            id: creditLedgerRef.id,
            entryId: creditLedgerRef.id,
            accountType: 'vendor',
            accountId: existingOrder.vendorId,
            partyId: existingOrder.vendorId,
            partyName: existingOrder.shopName || existingOrder.vendorName,
            partyType: 'VENDOR',
            type: 'CREDIT',
            transactionType: 'CREDIT',
            direction: 'credit',
            amount: safePaidAmount,
            runningBalance: currentBal + newTotalAmount - safePaidAmount,
            referenceId: `RCPT-${Date.now().toString().slice(-4)}`,
            referenceNo: `RCPT-${Date.now().toString().slice(-4)}`,
            orderId: existingOrder.id,
            date: nowStr,
            note: `${actualPaymentMode} payment collected at delivery`,
            paymentMethod: actualPaymentMode,
            createdBy: existingOrder.assignedStaffName || 'Delivery Executive',
            createdRole: 'STAFF',
            createdAt: nowStr,
          };

          transaction.set(creditLedgerRef, cleanFirestoreData({
            ...creditEntry,
            createdAt: serverTimestamp(),
          }));
        }
      }
    });
  },
};
