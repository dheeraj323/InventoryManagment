import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  MOCK_USERS,
  MOCK_VENDORS,
  MOCK_STAFF,
  MOCK_PRODUCTS,
  MOCK_SUPPLIERS,
  MOCK_ORDERS,
  MOCK_LEDGER_ENTRIES,
  MOCK_CASH_SETTLEMENTS,
  MOCK_AUDIT_LOGS,
  MOCK_NOTIFICATIONS,
} from '../constants/mockData';

export const seedFirestoreIfEmpty = async (): Promise<void> => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (!usersSnap.empty) {
      console.log('Firestore already contains data. Skipping initial seeding.');
      return;
    }

    console.log('Seeding initial Firestore database collections from mock datasets...');
    const batch = writeBatch(db);

    // 1. Users
    MOCK_USERS.forEach((u) => {
      const ref = doc(db, 'users', u.id);
      batch.set(ref, { ...u, active: true, createdAt: new Date().toISOString() });
    });

    // 2. Vendors
    MOCK_VENDORS.forEach((v) => {
      const ref = doc(db, 'vendors', v.id);
      batch.set(ref, {
        ...v,
        vendorId: v.id,
        ownerName: v.name,
        businessName: v.shopName,
        currentOutstanding: v.currentBalance,
        payLaterEnabled: v.payLaterEligible,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });

    // 3. Staff
    MOCK_STAFF.forEach((s) => {
      const ref = doc(db, 'staff', s.id);
      batch.set(ref, { ...s, staffId: s.id, active: true, createdAt: new Date().toISOString() });
    });

    // 4. Products
    MOCK_PRODUCTS.forEach((p) => {
      const ref = doc(db, 'products', p.id);
      batch.set(ref, {
        ...p,
        productId: p.id,
        sellingPrice: p.price,
        availableStock: p.stockQty,
        minimumStock: p.lowStockThreshold,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });

    // 5. Suppliers
    MOCK_SUPPLIERS.forEach((sup) => {
      const ref = doc(db, 'suppliers', sup.id);
      batch.set(ref, {
        ...sup,
        supplierId: sup.id,
        businessName: sup.name,
        outstandingPayable: sup.balancePayable,
        active: true,
        createdAt: new Date().toISOString(),
      });
    });

    // 6. Orders
    MOCK_ORDERS.forEach((o) => {
      const ref = doc(db, 'orders', o.id);
      batch.set(ref, { ...o, orderId: o.id, createdAt: o.orderDate });
    });

    // 7. Ledger Entries
    MOCK_LEDGER_ENTRIES.forEach((l) => {
      const ref = doc(db, 'ledgerEntries', l.id);
      batch.set(ref, {
        ...l,
        entryId: l.id,
        accountId: l.partyId,
        accountType: 'vendor',
        transactionType: l.type,
        direction: l.type.toLowerCase(),
        createdAt: l.date,
      });
    });

    // 8. Cash Settlements
    MOCK_CASH_SETTLEMENTS.forEach((cs) => {
      const ref = doc(db, 'cashSettlements', cs.id);
      batch.set(ref, {
        ...cs,
        settlementId: cs.id,
        amountCollected: cs.totalCashCollected,
        amountHandedOver: cs.handedOverCash,
        difference: cs.variance,
        settlementDate: cs.date,
        createdAt: cs.date,
      });
    });

    // 9. Audit Logs
    MOCK_AUDIT_LOGS.forEach((al) => {
      const ref = doc(db, 'auditLogs', al.id);
      batch.set(ref, { ...al, logId: al.id, createdAt: al.timestamp });
    });

    // 10. Notifications
    MOCK_NOTIFICATIONS.forEach((n) => {
      const ref = doc(db, 'notifications', n.id);
      batch.set(ref, { ...n, notificationId: n.id, createdAt: new Date().toISOString() });
    });

    await batch.commit();
    console.log('Successfully seeded Firestore database with initial data.');
  } catch (error) {
    console.error('Error seeding Firestore database:', error);
  }
};
