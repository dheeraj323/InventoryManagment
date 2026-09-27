import { create } from 'zustand';
import { Order, OrderStatus, PaymentMethod, OrderItem, LedgerEntry } from '../types';
import { orderService } from '../services/orderService';
import { BUSINESS_RULES } from '../constants/rules';
import { useVendorStore } from './useVendorStore';
import { useLedgerStore } from './useLedgerStore';
import { useStaffStockStore } from './useStaffStockStore';
import { useRouteStore } from './useRouteStore';
import { useStaffStore } from './useStaffStore';

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
  dispatchAllStaffOrders: (staffId: string) => Promise<void>;
  recordDelivery: (
    orderId: string,
    updatedItems: OrderItem[],
    actualPaymentMode: PaymentMethod,
    paidAmount: number,
    notes?: string
  ) => Promise<void>;
  recordDirectSpotDelivery: (params: {
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
  }) => Promise<Order>;
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
    const existing = get().getOrderById(orderId);
    let newStatus = status;
    let autoStaffId = existing?.assignedStaffId;
    let autoStaffName = existing?.assignedStaffName;
    let autoStaffPhone = existing?.assignedStaffPhone;
    let targetRouteId = existing?.routeId;
    let targetRouteName = existing?.routeName;

    if (status === 'APPROVED' || status === 'OUT_FOR_DELIVERY') {
      if (!targetRouteId && existing?.vendorId) {
        const vendor = useVendorStore.getState().getVendorById(existing.vendorId);
        targetRouteId = vendor?.routeId;
        targetRouteName = vendor?.routeName || vendor?.area;
      }

      if (targetRouteId) {
        const route = useRouteStore.getState().getRouteById(targetRouteId);
        if (route) {
          targetRouteName = targetRouteName || route.name;
          if (!autoStaffId && route.assignedStaffId) {
            autoStaffId = route.assignedStaffId;
            autoStaffName = route.assignedStaffName;
            autoStaffPhone = route.assignedStaffPhone;
          }
        }
      }

      if (!autoStaffId && targetRouteName) {
        const route = useRouteStore.getState().routes.find(
          (r) => r.name.toLowerCase() === targetRouteName?.toLowerCase()
        );
        if (route?.assignedStaffId) {
          targetRouteId = targetRouteId || route.id;
          autoStaffId = route.assignedStaffId;
          autoStaffName = route.assignedStaffName;
          autoStaffPhone = route.assignedStaffPhone;
        }
      }
    }

    const updatedOrders = get().orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: newStatus,
            ...(targetRouteId ? { routeId: targetRouteId } : {}),
            ...(targetRouteName ? { routeName: targetRouteName } : {}),
            ...(autoStaffId ? {
              assignedStaffId: autoStaffId,
              assignedStaffName: autoStaffName || 'Delivery Staff',
              assignedStaffPhone: autoStaffPhone || '',
            } : {}),
          }
        : o
    );

    set({ orders: updatedOrders });

    const targetStaffId = autoStaffId || existing?.assignedStaffId;
    if (targetStaffId) {
      useStaffStockStore.getState().syncOutForDeliveryStock(targetStaffId, updatedOrders).catch((err) => {
        console.warn('Error syncing out for delivery stock on updateOrderStatus:', err);
      });
    }

    try {
      await orderService.updateOrderStatus(orderId, status);
    } catch (err) {
      console.error(`Error updating status for order ${orderId}:`, err);
    }
  },

  assignStaffAndDispatch: async (orderId, staff) => {
    const updatedOrders = get().orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: 'APPROVED' as OrderStatus,
            assignedStaffId: staff.staffId,
            assignedStaffName: staff.name,
            assignedStaffPhone: staff.phone || '',
          }
        : o
    );

    set({ orders: updatedOrders });

    if (staff.staffId) {
      useStaffStockStore.getState().syncOutForDeliveryStock(staff.staffId, updatedOrders).catch((err) => {
        console.warn('Error syncing out for delivery stock on assignStaffAndDispatch:', err);
      });
    }

    try {
      await orderService.assignStaffAndDispatch(orderId, staff);
    } catch (err) {
      console.error(`Error assigning staff to order ${orderId}:`, err);
    }
  },

  dispatchAllStaffOrders: async (staffId: string) => {
    if (!staffId) return;
    const currentOrders = get().orders;
    const nowStr = new Date().toISOString();

    // Find all orders assigned to this staff (direct + route-based) that are approved or pending
    const staffOrders = get().getOrdersByStaff(staffId);
    const ordersToDispatch = staffOrders.filter(
      (o) => o.status === 'APPROVED' || o.status === 'PENDING'
    );

    if (ordersToDispatch.length === 0) {
      // Ensure real-time stock sync
      useStaffStockStore.getState().syncOutForDeliveryStock(staffId, currentOrders).catch((err) => {
        console.warn('Error syncing out for delivery stock on dispatchAllStaffOrders:', err);
      });
      return;
    }

    const updatedOrders = currentOrders.map((o) => {
      const shouldDispatch = ordersToDispatch.some((td) => td.id === o.id);
      if (shouldDispatch) {
        return {
          ...o,
          status: 'OUT_FOR_DELIVERY' as OrderStatus,
          assignedStaffId: o.assignedStaffId || staffId,
          dispatchedAt: o.dispatchedAt || nowStr,
        };
      }
      return o;
    });

    set({ orders: updatedOrders });

    // Sync out for delivery stock session records
    useStaffStockStore.getState().syncOutForDeliveryStock(staffId, updatedOrders).catch((err) => {
      console.warn('Error syncing out for delivery stock on dispatchAllStaffOrders:', err);
    });

    // Update orders in Firestore
    for (const ord of ordersToDispatch) {
      try {
        await orderService.updateOrderStatus(ord.id, 'OUT_FOR_DELIVERY');
      } catch (err) {
        console.warn(`Error dispatching order ${ord.id} to OUT_FOR_DELIVERY:`, err);
      }
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

    const rawAdvance =
      order.advanceAdjusted ||
      (order.preferredPaymentMode === 'ADVANCE' || actualPaymentMode === 'ADVANCE'
        ? (order.totalAmount || newTotalAmount)
        : 0);
    const advanceAdjusted = Math.min(newTotalAmount, rawAdvance);
    const finalBillAmount = Math.max(0, newTotalAmount - advanceAdjusted);
    const isAdvanceCovered = advanceAdjusted >= newTotalAmount;

    const effectiveActualPaymentMode: PaymentMethod = isAdvanceCovered ? 'ADVANCE' : actualPaymentMode;
    const safePaidAmount = isAdvanceCovered ? 0 : Math.max(0, paidAmount);

    const vendor = useVendorStore.getState().getVendorById(order.vendorId);
    const currentVendorBalance = vendor ? vendor.currentBalance || 0 : 0;
    const newBalanceDue = Math.max(0, finalBillAmount - safePaidAmount);

    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
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
              deliveredAt: new Date().toISOString(),
              notes: notes !== undefined ? notes : o.notes,
            }
          : o
      ),
    });

    // Optimistically update vendor balance
    if (vendor) {
      const updatedVendorBalance = Math.round((currentVendorBalance + newTotalAmount - safePaidAmount) * 100) / 100;
      const currentOutstanding = Math.max(0, updatedVendorBalance);
      const advanceBalance = Math.max(0, -updatedVendorBalance);
      useVendorStore.setState({
        vendors: useVendorStore.getState().vendors.map((v) =>
          v.id === order.vendorId || v.vendorId === order.vendorId
            ? {
                ...v,
                currentBalance: updatedVendorBalance,
                currentOutstanding,
                advanceBalance,
              }
            : v
        ),
      });
    }

    // Optimistically record ledger entry
    const debitNote =
      effectiveActualPaymentMode === 'ADVANCE'
        ? `Invoice for Order ${order.orderNumber} (Settled via Advance)`
        : advanceAdjusted > 0
        ? `Invoice for Order ${order.orderNumber} (₹${advanceAdjusted.toLocaleString('en-IN')} advance deducted)`
        : finalStatus === 'PARTIALLY_DELIVERED'
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
      runningBalance: Math.round((currentVendorBalance + newTotalAmount) * 100) / 100,
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
        runningBalance: Math.round((currentVendorBalance + newTotalAmount - safePaidAmount) * 100) / 100,
        referenceId: `RCPT-${Date.now().toString().slice(-6)}`,
        referenceNo: `RCPT-${Date.now().toString().slice(-6)}`,
        orderId: order.id,
        invoiceId: orderId,
        sourceType: 'PAYMENT',
        paymentMethod: effectiveActualPaymentMode,
        date: new Date().toISOString(),
        note: `${effectiveActualPaymentMode} payment collected at delivery for ${order.orderNumber}`,
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
      useStaffStockStore.getState().recordDeliveredUnits(order.assignedStaffId, deliveredItems, undefined, orderId);
    }

    try {
      await orderService.recordDelivery(
        orderId,
        updatedItems,
        effectiveActualPaymentMode,
        safePaidAmount,
        notes
      );
    } catch (err) {
      console.error(`Error recording delivery in Firestore for order ${orderId}:`, err);
    }
  },

  recordDirectSpotDelivery: async (params) => {
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

    const vendor = useVendorStore.getState().getVendorById(vendorId);
    const subtotal = items.reduce(
      (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
      0
    );
    const TAX_RATE = BUSINESS_RULES.TAX_RATE || 0;
    const tax = subtotal * TAX_RATE;
    const totalAmount = subtotal + tax;
    const safePaidAmount = Math.max(0, paidAmount);
    const balanceDue = Math.max(0, totalAmount - safePaidAmount);
    const currentVendorBalance = vendor ? vendor.currentBalance || 0 : 0;
    const updatedVendorBalance =
      Math.round((currentVendorBalance + totalAmount - safePaidAmount) * 100) / 100;
    const nowStr = new Date().toISOString();
    const tempOrderId = `spot-${Date.now()}`;
    const orderNumber = `ORD-2026-${Date.now().toString().slice(-4)}`;
    const invoiceNumber = `INV-${orderNumber}`;

    // Optimistic Order
    const optimisticOrder: Order = {
      id: tempOrderId,
      orderId: tempOrderId,
      orderNumber,
      vendorId,
      vendorName: vendor?.name || 'Vendor',
      shopName: vendor?.shopName || vendor?.name || 'Vendor Shop',
      phone: vendor?.phone || '',
      address: vendor?.address || '',
      locationUrl: vendor?.locationUrl,
      latitude: vendor?.latitude,
      longitude: vendor?.longitude,
      routeId: vendor?.routeId,
      routeName: vendor?.routeName || vendor?.area,
      assignedStaffId: staffId,
      assignedStaffName: staffName,
      assignedStaffPhone: staffPhone || '',
      items: items.map((it, idx) => ({
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
      })),
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
      invoiceId: tempOrderId,
      notes: notes || 'Direct Spot Delivery by Staff',
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    // 1. Optimistic Order Store
    set({ orders: [optimisticOrder, ...get().orders] });

    // 2. Optimistic Vendor Balance
    if (vendor) {
      useVendorStore.setState({
        vendors: useVendorStore.getState().vendors.map((v) =>
          v.id === vendorId || v.vendorId === vendorId
            ? {
                ...v,
                currentBalance: updatedVendorBalance,
                currentOutstanding: Math.max(0, updatedVendorBalance),
                advanceBalance: Math.max(0, -updatedVendorBalance),
                lastOrderDate: nowStr,
                ...(safePaidAmount > 0 ? { lastPaymentDate: nowStr } : {}),
              }
            : v
        ),
      });
    }

    // 3. Optimistic Ledger Entries
    const debitEntry: LedgerEntry = {
      id: `${tempOrderId}_debit`,
      entryId: `${tempOrderId}_debit`,
      accountType: 'vendor',
      accountId: vendorId,
      partyId: vendorId,
      partyName: vendor?.shopName || vendor?.name || 'Vendor',
      partyType: 'VENDOR',
      type: 'DEBIT',
      transactionType: 'DEBIT',
      direction: 'debit',
      amount: totalAmount,
      runningBalance: Math.round((currentVendorBalance + totalAmount) * 100) / 100,
      referenceId: invoiceNumber,
      referenceNo: invoiceNumber,
      orderId: tempOrderId,
      invoiceId: tempOrderId,
      sourceType: 'INVOICE',
      date: nowStr,
      note: `Direct spot delivery invoice for ${orderNumber}`,
      createdBy: staffName,
      createdRole: 'STAFF',
    };

    const newLedgerEntries: LedgerEntry[] = [debitEntry];
    if (safePaidAmount > 0) {
      const creditEntry: LedgerEntry = {
        id: `${tempOrderId}_credit`,
        entryId: `${tempOrderId}_credit`,
        accountType: 'vendor',
        accountId: vendorId,
        partyId: vendorId,
        partyName: vendor?.shopName || vendor?.name || 'Vendor',
        partyType: 'VENDOR',
        type: 'CREDIT',
        transactionType: 'CREDIT',
        direction: 'credit',
        amount: safePaidAmount,
        runningBalance: Math.round((currentVendorBalance + totalAmount - safePaidAmount) * 100) / 100,
        referenceId: `RCPT-${Date.now().toString().slice(-6)}`,
        referenceNo: `RCPT-${Date.now().toString().slice(-6)}`,
        orderId: tempOrderId,
        invoiceId: tempOrderId,
        sourceType: 'PAYMENT',
        paymentMethod: paymentMode,
        date: nowStr,
        note: `${paymentMode} payment collected for direct spot delivery ${orderNumber}`,
        createdBy: staffName,
        createdRole: 'STAFF',
      };
      newLedgerEntries.unshift(creditEntry);
    }
    useLedgerStore.setState({
      entries: [...newLedgerEntries, ...useLedgerStore.getState().entries],
    });

    // 4. Optimistic Staff Vehicle Stock Session Update
    if (staffId && items.length > 0) {
      const deliveredPayload = items.map((it) => ({
        productId: it.productId,
        deliveredQty: it.quantity || 0,
      }));
      useStaffStockStore.getState().recordDeliveredUnits(staffId, deliveredPayload);
    }

    // Call service to write to Firestore
    try {
      const actualOrder = await orderService.recordDirectSpotDelivery(params);
      // Replace optimistic order with Firestore order
      set({
        orders: get().orders.map((o) => (o.id === tempOrderId ? actualOrder : o)),
      });
      return actualOrder;
    } catch (err) {
      console.error('Error recording direct spot delivery in Firestore:', err);
      return optimisticOrder;
    }
  },

  getOrdersByVendor: (vendorId: string) => {
    return get().orders.filter((o) => o.vendorId === vendorId);
  },

  getOrdersByStaff: (staffId: string) => {
    if (!staffId) return [];

    // Find all routes assigned to this staff member
    const assignedRoutes = useRouteStore.getState().getRoutesByStaff(staffId);
    const routeIds = new Set(
      assignedRoutes.map((r) => r.id || r.routeId).filter(Boolean) as string[]
    );

    // Also check if staff record has assignedRouteId
    const staffMember = useStaffStore
      .getState()
      .staffList.find(
        (s) => s.id === staffId || s.staffId === staffId || s.userId === staffId
      );
    if (staffMember?.assignedRouteId) {
      routeIds.add(staffMember.assignedRouteId);
    }

    return get().orders.filter((o) => {
      if (o.status === 'CANCELLED') return false;
      // 1. Explicitly assigned staff match
      if (o.assignedStaffId === staffId) return true;
      // 2. Route assignment match (staff assigned to the order's route)
      if (o.routeId && routeIds.has(o.routeId)) return true;
      return false;
    });
  },

  getOrderById: (orderId: string) => {
    return get().orders.find((o) => o.id === orderId);
  },
}));
