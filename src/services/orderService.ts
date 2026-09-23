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
import { Order, OrderStatus, PaymentMethod, OrderItem, Vendor, Product } from '../types';
import { financialTransactionService } from './financialTransactionService';

const ORDERS_COLLECTION = 'orders';
const VENDORS_COLLECTION = 'vendors';
const PRODUCTS_COLLECTION = 'products';

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

const normalizeOrder = (docSnap: any): Order => {
  const data = docSnap.data();
  const order: Order = {
    id: docSnap.id,
    orderId: docSnap.id,
    ...data,
  };
  // Pending orders are unapproved by definition and cannot have assigned delivery staff
  if (order.status === 'PENDING') {
    order.assignedStaffId = undefined;
    order.assignedStaffName = undefined;
    order.assignedStaffPhone = undefined;
  }
  return order;
};

export const orderService = {
  // Fetch all orders
  getOrders: async (): Promise<Order[]> => {
    try {
      const q = query(collection(db, ORDERS_COLLECTION), orderBy('orderDate', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(normalizeOrder);
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
      const orders = snapshot.docs.map(normalizeOrder);
      // Client-side sort by date descending
      orders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      callback(orders);
    }, (error) => {
      console.error('Real-time orders subscription error:', error);
    });
  },

  // Create Order with atomic stock decrement in Firestore Transaction
  createOrder: async (orderData: Omit<Order, 'id' | 'orderNumber'>): Promise<Order> => {
    const newOrderRef = doc(collection(db, ORDERS_COLLECTION));

    return await runTransaction(db, async (transaction) => {
      // 1. Fetch Vendor Document
      const vendorRef = doc(db, VENDORS_COLLECTION, orderData.vendorId);
      const vendorSnap = await transaction.get(vendorRef);

      // 2. Fetch and validate stock for all items first (ALL READS)
      const productUpdates: { ref: any; productId: string; newStock: number }[] = [];
      for (const item of orderData.items) {
        const productRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const productSnap = await transaction.get(productRef);
        if (productSnap.exists()) {
          const product = productSnap.data() as Product;
          if (product.stockQty < item.orderedQty) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stockQty}, Requested: ${item.orderedQty}`);
          }
          const newStock = product.stockQty - item.orderedQty;
          productUpdates.push({ ref: productRef, productId: item.productId, newStock });
        }
      }

      // 3. NOW PERFORM ALL WRITES
      const liveStockUpdates: Record<string, number> = {};
      for (const pUpdate of productUpdates) {
        transaction.update(pUpdate.ref, {
          stockQty: pUpdate.newStock,
          availableStock: pUpdate.newStock,
          updatedAt: serverTimestamp(),
        });
        liveStockUpdates[pUpdate.productId] = pUpdate.newStock;
      }

      // Update consolidated Live Stock Map in transaction
      if (Object.keys(liveStockUpdates).length > 0) {
        const stockRef = doc(db, 'system', 'live_stock');
        transaction.set(stockRef, liveStockUpdates, { merge: true });
      }

      const timestampPart = Date.now().toString().slice(-4);
      const orderNumber = `ORD-2026-${timestampPart}`;

      // Credit limit check: if PAY_LATER order would exceed the vendor's credit limit,
      // flag it as pendingAdminOverride instead of blocking the order outright.
      // The Admin must then approve or reject the override before the order proceeds.
      let pendingAdminOverride = false;
      if (
        orderData.preferredPaymentMode === 'PAY_LATER' &&
        vendorSnap.exists()
      ) {
        const vendor = vendorSnap.data() as Vendor;
        const limit = vendor.creditLimit || 0;
        if (limit > 0) {
          const currentOutstanding = vendor.currentBalance || 0;
          if (currentOutstanding + orderData.totalAmount > limit) {
            pendingAdminOverride = true;
          }
        }
      }

      const newOrder: Order = {
        ...orderData,
        id: newOrderRef.id,
        orderId: newOrderRef.id,
        orderNumber,
        notes: orderData.notes || '',
        pendingAdminOverride,
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

  // Assign Delivery Staff and Dispatch Order (Status -> OUT_FOR_DELIVERY)
  assignStaffAndDispatch: async (
    orderId: string,
    staff: { staffId: string; name: string; phone?: string }
  ): Promise<void> => {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(docRef, {
      status: 'OUT_FOR_DELIVERY',
      assignedStaffId: staff.staffId,
      assignedStaffName: staff.name,
      assignedStaffPhone: staff.phone || '',
      dispatchedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Record Delivery — delegates all financial writes to financialTransactionService.
   *
   * The financial service:
   * - Checks the idempotency guard (deliveryFinalized flag)
   * - Recalculates totals from delivered quantities
   * - Restores missing stock to inventory
   * - Writes DEBIT ledger entry (invoice)
   * - Writes CREDIT ledger entry (if payment collected)
   * - Updates vendor outstanding balance
   * - Creates Invoice document
   * - Creates AuditLog
   *
   * This function no longer contains any inline ledger writes.
   */
  recordDelivery: async (
    orderId: string,
    updatedItems: OrderItem[],
    actualPaymentMode: PaymentMethod,
    paidAmount: number,
    notes?: string
  ): Promise<void> => {
    await financialTransactionService.finalizeDelivery(
      orderId,
      updatedItems,
      actualPaymentMode,
      paidAmount,
      notes
    );
  },
};
