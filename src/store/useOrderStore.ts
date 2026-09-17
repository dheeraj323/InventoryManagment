import { create } from 'zustand';
import { Order, OrderStatus, PaymentMethod, OrderItem } from '../types';
import { MOCK_ORDERS } from '../constants/mockData';
import { orderService } from '../services/orderService';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  subscribeToOrders: (vendorId?: string, staffId?: string) => () => void;
  createOrder: (newOrder: Omit<Order, 'id' | 'orderNumber'>) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  recordDelivery: (
    orderId: string,
    updatedItems: OrderItem[],
    actualPaymentMode: PaymentMethod,
    paidAmount: number,
    notes?: string
  ) => Promise<void>;
  getOrdersByVendor: (vendorId: string) => Order[];
  getOrdersByStaff: (staffId: string) => Order[];
  getOrderById: (orderId: string) => Order | undefined;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: MOCK_ORDERS,
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await orderService.getOrders();
      if (orders.length > 0) {
        set({ orders, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      set({ error: err.message || 'Failed to fetch orders', isLoading: false });
    }
  },

  subscribeToOrders: (vendorId?: string, staffId?: string) => {
    return orderService.subscribeOrders((firestoreOrders) => {
      if (firestoreOrders && firestoreOrders.length > 0) {
        set({ orders: firestoreOrders });
      }
    }, vendorId, staffId);
  },

  createOrder: async (orderData) => {
    try {
      const newOrder = await orderService.createOrder(orderData);
      set({ orders: [newOrder, ...get().orders] });
      return newOrder;
    } catch (err: any) {
      console.error('Error creating order:', err);
      // Fallback local creation if Firestore offline
      const nextNum = get().orders.length + 102;
      const orderNumber = `ORD-2026-${nextNum}`;
      const id = `ord-${Date.now()}`;
      const fallbackOrder: Order = {
        ...orderData,
        id,
        orderNumber,
      };
      set({ orders: [fallbackOrder, ...get().orders] });
      return fallbackOrder;
    }
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus) => {
    set({
      orders: get().orders.map((o) =>
        o.id === orderId ? { ...o, status } : o
      ),
    });
    try {
      await orderService.updateOrderStatus(orderId, status);
    } catch (err) {
      console.error(`Error updating status for order ${orderId}:`, err);
    }
  },

  recordDelivery: async (orderId, updatedItems, actualPaymentMode, paidAmount, notes) => {
    const order = get().getOrderById(orderId);
    if (!order) return;

    // Local optimistic update
    const newSubtotal = updatedItems.reduce(
      (sum, item) => sum + item.deliveredQty * item.unitPrice,
      0
    );
    const newTax = newSubtotal * 0.05;
    const newTotalAmount = newSubtotal + newTax;

    const hasMissingOrDamaged = updatedItems.some(
      (item) => item.missingDamagedQty > 0
    );

    const isFullyDelivered = !hasMissingOrDamaged;
    const finalStatus: OrderStatus = isFullyDelivered
      ? 'DELIVERED'
      : 'PARTIALLY_DELIVERED';

    const newBalanceDue = Math.max(0, newTotalAmount - paidAmount);

    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              items: updatedItems,
              subtotal: newSubtotal,
              tax: newTax,
              totalAmount: newTotalAmount,
              status: finalStatus,
              actualPaymentMode,
              paidAmount,
              balanceDue: newBalanceDue,
              deliveredAt: new Date().toISOString(),
              notes: notes || o.notes,
            }
          : o
      ),
    });

    try {
      await orderService.recordDelivery(
        orderId,
        updatedItems,
        actualPaymentMode,
        paidAmount,
        notes
      );
    } catch (err) {
      console.error(`Error recording delivery in Firestore for order ${orderId}:`, err);
    }
  },

  getOrdersByVendor: (vendorId: string) => {
    return get().orders.filter((o) => o.vendorId === vendorId);
  },

  getOrdersByStaff: (staffId: string) => {
    return get().orders.filter((o) => o.assignedStaffId === staffId);
  },

  getOrderById: (orderId: string) => {
    return get().orders.find((o) => o.id === orderId);
  },
}));
