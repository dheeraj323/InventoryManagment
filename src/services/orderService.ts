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

const ROUTES_COLLECTION = 'routes';
const STAFF_COLLECTION = 'staff';

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
    }
    // Note: For staff, we subscribe to all orders so client-side store can dynamically match orders by both assignedStaffId AND assigned routeIds

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
      const vendor = vendorSnap.exists() ? (vendorSnap.data() as Vendor) : null;

      // 2. Resolve Route & Assigned Staff for the Order
      const targetRouteId = orderData.routeId || vendor?.routeId;
      let targetRouteName = orderData.routeName || vendor?.routeName || vendor?.area;
      let autoStaffId = orderData.assignedStaffId;
      let autoStaffName = orderData.assignedStaffName;
      let autoStaffPhone = orderData.assignedStaffPhone;

      if (targetRouteId) {
        const routeRef = doc(db, ROUTES_COLLECTION, targetRouteId);
        const routeSnap = await transaction.get(routeRef);
        if (routeSnap.exists()) {
          const routeData = routeSnap.data();
          targetRouteName = targetRouteName || routeData.name;
          if (!autoStaffId && routeData.assignedStaffId) {
            autoStaffId = routeData.assignedStaffId;
            autoStaffName = routeData.assignedStaffName || 'Delivery Staff';
            autoStaffPhone = routeData.assignedStaffPhone || '';
          }
        }
      }

      // 3. Fetch and validate stock for all items first (ALL READS)
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

      // 4. NOW PERFORM ALL WRITES
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

      // Credit limit check
      let pendingAdminOverride = false;
      if (
        orderData.preferredPaymentMode === 'PAY_LATER' &&
        vendorSnap.exists()
      ) {
        const limit = vendor?.creditLimit || 0;
        if (limit > 0) {
          const currentOutstanding = vendor?.currentBalance || 0;
          if (currentOutstanding + orderData.totalAmount > limit) {
            pendingAdminOverride = true;
          }
        }
      }

      const finalAddress = orderData.address || vendor?.address || '';
      const finalLocationUrl = orderData.locationUrl || vendor?.locationUrl || undefined;
      const finalLat = orderData.latitude !== undefined ? orderData.latitude : vendor?.latitude;
      const finalLng = orderData.longitude !== undefined ? orderData.longitude : vendor?.longitude;

      const newOrder: Order = {
        ...orderData,
        routeId: targetRouteId || undefined,
        routeName: targetRouteName || undefined,
        assignedStaffId: autoStaffId || undefined,
        assignedStaffName: autoStaffName || undefined,
        assignedStaffPhone: autoStaffPhone || undefined,
        address: finalAddress,
        locationUrl: finalLocationUrl,
        latitude: finalLat,
        longitude: finalLng,
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

    if (status === 'APPROVED' || status === 'OUT_FOR_DELIVERY') {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const orderData = snap.data();
          let assignedStaffId = orderData.assignedStaffId;
          let assignedStaffName = orderData.assignedStaffName;
          let assignedStaffPhone = orderData.assignedStaffPhone;
          let routeId = orderData.routeId;
          let routeName = orderData.routeName;

          // 1. If no routeId on order, resolve from vendor
          if (!routeId && orderData.vendorId) {
            const vendorRef = doc(db, 'vendors', orderData.vendorId);
            const vSnap = await getDoc(vendorRef);
            if (vSnap.exists()) {
              const vData = vSnap.data();
              routeId = vData.routeId || routeId;
              routeName = vData.routeName || vData.area || routeName;
            }
          }

          // 2. If still no routeId, check if any route matches order area/name
          if (!routeId && (orderData.area || routeName)) {
            const matchName = (orderData.area || routeName || '').toLowerCase().trim();
            if (matchName) {
              const routesSnap = await getDocs(collection(db, ROUTES_COLLECTION));
              const matched = routesSnap.docs.find(
                (d) => (d.data().name || '').toLowerCase().trim() === matchName
              );
              if (matched) {
                routeId = matched.id;
                routeName = matched.data().name;
              }
            }
          }

          // 3. Resolve assigned staff from the Route
          if (routeId) {
            const routeRef = doc(db, ROUTES_COLLECTION, routeId);
            const routeSnap = await getDoc(routeRef);
            if (routeSnap.exists()) {
              const rData = routeSnap.data();
              routeName = routeName || rData.name;
              if (rData.assignedStaffId) {
                assignedStaffId = rData.assignedStaffId;
                assignedStaffName = rData.assignedStaffName;
                assignedStaffPhone = rData.assignedStaffPhone;
              }
            }
          }

          // 4. If still no staff, check staff collection directly by routeId
          if (!assignedStaffId && routeId) {
            const staffSnap = await getDocs(collection(db, STAFF_COLLECTION));
            const matchedStaff = staffSnap.docs.find(
              (d) => d.data().assignedRouteId === routeId || (routeName && (d.data().activeArea || '').toLowerCase() === routeName.toLowerCase())
            );
            if (matchedStaff) {
              const sData = matchedStaff.data();
              assignedStaffId = sData.staffId || matchedStaff.id;
              assignedStaffName = sData.name;
              assignedStaffPhone = sData.phone || '';
            }
          }

          // If staff is resolved, directly dispatch to OUT_FOR_DELIVERY
          if (assignedStaffId) {
            await updateDoc(docRef, {
              status: 'OUT_FOR_DELIVERY',
              assignedStaffId,
              assignedStaffName: assignedStaffName || 'Delivery Staff',
              assignedStaffPhone: assignedStaffPhone || '',
              ...(routeId ? { routeId } : {}),
              ...(routeName ? { routeName } : {}),
              dispatchedAt: orderData.dispatchedAt || new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
            return;
          }
        }
      } catch (e) {
        console.error('Error auto-dispatching approved order:', e);
      }
    }

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
