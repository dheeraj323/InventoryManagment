import { create } from 'zustand';
import { Order, OrderStatus, PaymentMethod, OrderItem, LedgerEntry } from '../types';
import { orderService } from '../services/orderService';
import { BUSINESS_RULES } from '../constants/rules';
import { useVendorStore } from './useVendorStore';
import { useLedgerStore } from './useLedgerStore';
import { useStaffStockStore } from './useStaffStockStore';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  subscribeToOrders: (vendorId?: string, staffId?: string) => () => void;
  createOrder: (newOrder: Omit<Order, 'id' | 'orderNumber'>) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  assignStaffAndDispatch: (
    orderId: string,
    staff: { staffId: string; name: string; phone?: string }
  ) => Promise<void>;
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
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await orderService.getOrders();
      set({ orders: orders || [], isLoading: false });
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      set({ error: err.message || 'Failed to fetch orders', isLoading: false });
    }
  },

  subscribeToOrders: (vendorId?: string, staffId?: string) => {
    return orderService.subscribeOrders((firestoreOrders) => {
      set({ orders: firestoreOrders || [] });
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

  assignStaffAndDispatch: async (orderId, staff) => {
    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'OUT_FOR_DELIVERY',
              assignedStaffId: staff.staffId,
              assignedStaffName: staff.name,
              assignedStaffPhone: staff.phone || '',
              dispatchedAt: new Date().toISOString(),
            }
          : o
      ),
    });
    try {
      await orderService.assignStaffAndDispatch(orderId, staff);
    } catch (err) {
      console.error(`Error assigning staff and dispatching order ${orderId}:`, err);
    }
  },

  recordDelivery: async (orderId, updatedItems, actualPaymentMode, paidAmount, notes) => {
    const order = get().getOrderById(orderId);
    if (!order) return;

    // Local optimistic calculations
    const newSubtotal = updatedItems.reduce(
      (sum, item) => sum + item.deliveredQty * item.unitPrice,
      0
    );
    const newTax = newSubtotal * (BUSINESS_RULES.TAX_RATE || 0);
    const newTotalAmount = newSubtotal + newTax;

    const hasMissingOrDamaged = updatedItems.some(
      (item) => (item.missingDamagedQty || 0) > 0 || (item.damagedQty || 0) > 0
    );

    const isFullyDelivered = !hasMissingOrDamaged;
    const finalStatus: OrderStatus = isFullyDelivered
      ? 'DELIVERED'
      : 'PARTIALLY_DELIVERED';

    const safePaidAmount = Math.max(0, paidAmount);

    const vendor = useVendorStore.getState().getVendorById(order.vendorId);
    const currentVendorBalance = vendor ? vendor.currentBalance || 0 : 0;
    const newBalanceDue = Math.max(0, newTotalAmount - safePaidAmount);

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
              paidAmount: safePaidAmount,
              balanceDue: newBalanceDue,
              deliveredAt: new Date().toISOString(),
              notes: notes !== undefined ? notes : o.notes,
            }
          : o
      ),
    });

    // Optimistically update vendor balance
    if (vendor) {
      const updatedVendorBalance = Math.max(0, currentVendorBalance + newTotalAmount - safePaidAmount);
      useVendorStore.setState({
        vendors: useVendorStore.getState().vendors.map((v) =>
          v.id === order.vendorId || v.vendorId === order.vendorId
            ? { ...v, currentBalance: updatedVendorBalance, currentOutstanding: updatedVendorBalance }
            : v
        ),
      });
    }

    // Optimistically record ledger entry
    const debitNote =
      finalStatus === 'PARTIALLY_DELIVERED'
        ? `Invoice for Order ${order.orderNumber} (Partial delivery)`
        : `Invoice for Order ${order.orderNumber}`;

    const invoiceNumber = `INV-${order.orderNumber}`;
    const debitEntry: LedgerEntry = {
      id: `${orderId}_debit`,
      entryId: `${orderId}_debit`,
      accountType: 'vendor',
      accountId: order.vendorId,
      partyId: order.vendorId,
      partyName: order.shopName || order.vendorName,
      partyType: 'VENDOR',
      type: 'DEBIT',
      transactionType: 'DEBIT',
      direction: 'debit',
      amount: newTotalAmount,
      runningBalance: currentVendorBalance + newTotalAmount,
      referenceId: invoiceNumber,
      referenceNo: invoiceNumber,
      orderId: order.id,
      invoiceId: orderId,
      sourceType: 'INVOICE',
      date: new Date().toISOString(),
      note: debitNote,
      createdBy: order.assignedStaffName || 'Staff',
      createdRole: 'STAFF',
    };

    const existingEntries = useLedgerStore.getState().entries;
    const filteredEntries = existingEntries.filter(
      (e) =>
        e.id !== `${orderId}_debit` &&
        e.id !== `${orderId}_credit` &&
        e.id !== `${orderId}_advance_credit`
    );
    const newEntries: LedgerEntry[] = [debitEntry];

    if (safePaidAmount > 0) {
      const creditEntry: LedgerEntry = {
        id: `${orderId}_credit`,
        entryId: `${orderId}_credit`,
        accountType: 'vendor',
        accountId: order.vendorId,
        partyId: order.vendorId,
        partyName: order.shopName || order.vendorName,
        partyType: 'VENDOR',
        type: 'CREDIT',
        transactionType: 'CREDIT',
        direction: 'credit',
        amount: safePaidAmount,
        runningBalance: currentVendorBalance + newTotalAmount - safePaidAmount,
        referenceId: `RCPT-${Date.now().toString().slice(-6)}`,
        referenceNo: `RCPT-${Date.now().toString().slice(-6)}`,
        orderId: order.id,
        invoiceId: orderId,
        sourceType: 'PAYMENT',
        paymentMethod: actualPaymentMode,
        date: new Date().toISOString(),
        note: `${actualPaymentMode} payment collected at delivery for ${order.orderNumber}`,
        createdBy: order.assignedStaffName || 'Staff',
        createdRole: 'STAFF',
      };
      newEntries.unshift(creditEntry);
    }

    useLedgerStore.setState({ entries: [...newEntries, ...filteredEntries] });

    // Optimistically update assigned staff's vehicle stock
    if (order.assignedStaffId) {
      const deliveredItems = updatedItems.map((item) => ({
        productId: item.productId,
        deliveredQty: item.deliveredQty || 0,
        damagedQty: item.damagedQty || 0,
      }));
      useStaffStockStore.getState().recordDeliveredUnits(order.assignedStaffId, deliveredItems);
    }

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
    return get().orders.filter(
      (o) => o.assignedStaffId === staffId && o.status !== 'PENDING' && o.status !== 'CANCELLED'
    );
  },

  getOrderById: (orderId: string) => {
    return get().orders.find((o) => o.id === orderId);
  },
}));
