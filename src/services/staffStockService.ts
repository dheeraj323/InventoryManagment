import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { StaffDailyStockSession, StaffStockItem, Order } from '../types';
import { productService } from './productService';

const STAFF_STOCK_COLLECTION = 'staffStockSessions';
const PRODUCTS_COLLECTION = 'products';
const SYSTEM_COLLECTION = 'system';
const LIVE_STOCK_DOC = 'live_stock';

export const getTodayDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Strips `undefined` values from objects before Firestore writes */
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
          typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export const staffStockService = {
  // ── 1. Subscribe to today's stock session for a staff member ──
  subscribeTodaySession: (
    staffId: string,
    date: string,
    callback: (session: StaffDailyStockSession | null) => void
  ): Unsubscribe => {
    if (!staffId) {
      callback(null);
      return () => {};
    }
    const docId = `stock_${staffId}_${date}`;
    const docRef = doc(db, STAFF_STOCK_COLLECTION, docId);

    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({
            id: snapshot.id,
            sessionId: snapshot.id,
            ...snapshot.data(),
          } as StaffDailyStockSession);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.warn(`Error subscribing to stock session ${docId}:`, error);
        callback(null);
      }
    );
  },

  // ── 2. Subscribe to all staff stock sessions (for Admin) ──
  subscribeAllSessions: (
    date: string | undefined,
    callback: (sessions: StaffDailyStockSession[]) => void
  ): Unsubscribe => {
    try {
      let q = query(
        collection(db, STAFF_STOCK_COLLECTION),
        orderBy('loadedAt', 'desc')
      );
      if (date) {
        q = query(
          collection(db, STAFF_STOCK_COLLECTION),
          where('date', '==', date),
          orderBy('loadedAt', 'desc')
        );
      }

      return onSnapshot(
        q,
        (snapshot) => {
          const sessions = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            sessionId: docSnap.id,
            ...docSnap.data(),
          })) as StaffDailyStockSession[];
          callback(sessions);
        },
        (error) => {
          console.warn('Error subscribing to all staff stock sessions:', error);
          callback([]);
        }
      );
    } catch (err) {
      console.warn('Fallback: listening to all staff stock sessions without composite order:', err);
      const q = date
        ? query(collection(db, STAFF_STOCK_COLLECTION), where('date', '==', date))
        : collection(db, STAFF_STOCK_COLLECTION);
      return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          sessionId: docSnap.id,
          ...docSnap.data(),
        })) as StaffDailyStockSession[];
        callback(sessions);
      });
    }
  },

  // ── 3. Fetch single session ──
  getSession: async (staffId: string, date: string): Promise<StaffDailyStockSession | null> => {
    try {
      const docId = `stock_${staffId}_${date}`;
      const docRef = doc(db, STAFF_STOCK_COLLECTION, docId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          sessionId: snapshot.id,
          ...snapshot.data(),
        } as StaffDailyStockSession;
      }
      return null;
    } catch (err) {
      console.error('Error fetching staff stock session:', err);
      return null;
    }
  },

  // ── 4. Load Morning Stock (Pre-Ordered Route Items + Extra Inventory Stock) ──
  loadMorningStock: async (
    staffId: string,
    staffName: string,
    loadedItems: {
      productId: string;
      productName: string;
      unit: string;
      sku?: string;
      price?: number;
      preOrderedQty?: number;
      extraLoadedQty: number;
    }[],
    notes?: string,
    dateParam?: string
  ): Promise<StaffDailyStockSession> => {
    const date = dateParam || getTodayDateStr();
    const docId = `stock_${staffId}_${date}`;
    const docRef = doc(db, STAFF_STOCK_COLLECTION, docId);

    // Filter valid items (preOrdered > 0 OR extraLoaded > 0)
    const validLoaded = loadedItems.filter(
      (item) => (item.preOrderedQty || 0) > 0 || (item.extraLoadedQty || 0) > 0
    );
    if (validLoaded.length === 0) {
      throw new Error('Please select at least one product with quantity greater than 0.');
    }

    // 1. Fetch current session if already exists (only merge if currently ACTIVE)
    const existingSnap = await getDoc(docRef);
    let updatedItemsMap: Record<string, StaffStockItem> = {};
    const isExistingActive =
      existingSnap.exists() && (existingSnap.data() as StaffDailyStockSession).status === 'ACTIVE';

    if (isExistingActive) {
      const existingData = existingSnap.data() as StaffDailyStockSession;
      (existingData.items || []).forEach((it) => {
        updatedItemsMap[it.productId] = { ...it };
      });
    }

    // Newly added extra quantities to deduct from warehouse stock
    const newExtraDeductions: { productId: string; extraQty: number }[] = [];

    // Merge or add new loaded items
    for (const newItem of validLoaded) {
      const preOrdered = Math.max(0, newItem.preOrderedQty || 0);
      const extraLoaded = Math.max(0, newItem.extraLoadedQty || 0);
      const totalLoadedForItem = preOrdered + extraLoaded;

      if (isExistingActive && updatedItemsMap[newItem.productId]) {
        const existing = updatedItemsMap[newItem.productId];
        // Calculate additional extra being added in this call
        const additionalExtra = Math.max(0, extraLoaded - (existing.extraLoadedQty || 0));
        if (additionalExtra > 0) {
          newExtraDeductions.push({ productId: newItem.productId, extraQty: additionalExtra });
        }

        const newPreOrdered = Math.max(existing.preOrderedQty || 0, preOrdered);
        const newExtraLoaded = Math.max(existing.extraLoadedQty || 0, extraLoaded);
        const newTotalLoaded = newPreOrdered + newExtraLoaded;

        const curStock = Math.max(
          0,
          newTotalLoaded -
            existing.deliveredQty -
            (existing.returnedQty || 0) -
            (existing.damagedQty || 0) -
            (existing.missingQty || 0)
        );

        updatedItemsMap[newItem.productId] = {
          ...existing,
          preOrderedQty: newPreOrdered,
          extraLoadedQty: newExtraLoaded,
          loadedQty: newTotalLoaded,
          currentStock: curStock,
        };
      } else {
        if (extraLoaded > 0) {
          newExtraDeductions.push({ productId: newItem.productId, extraQty: extraLoaded });
        }

        updatedItemsMap[newItem.productId] = {
          productId: newItem.productId,
          productName: newItem.productName,
          unit: newItem.unit,
          sku: newItem.sku || '',
          price: newItem.price || 0,
          preOrderedQty: preOrdered,
          extraLoadedQty: extraLoaded,
          loadedQty: totalLoadedForItem,
          deliveredQty: 0,
          returnedQty: 0,
          damagedQty: 0,
          missingQty: 0,
          varianceQty: 0,
          currentStock: totalLoadedForItem,
        };
      }
    }

    const mergedItems = Object.values(updatedItemsMap);
    const totalPreOrdered = mergedItems.reduce((sum, it) => sum + (it.preOrderedQty || 0), 0);
    const totalExtraLoaded = mergedItems.reduce((sum, it) => sum + (it.extraLoadedQty || 0), 0);
    const totalLoaded = mergedItems.reduce((sum, it) => sum + it.loadedQty, 0);
    const totalDelivered = isExistingActive
      ? mergedItems.reduce((sum, it) => sum + it.deliveredQty, 0)
      : 0;
    const totalReturned = isExistingActive
      ? mergedItems.reduce((sum, it) => sum + (it.returnedQty || 0), 0)
      : 0;

    const nowStr = new Date().toISOString();
    const sessionData: StaffDailyStockSession = {
      id: docId,
      sessionId: docId,
      staffId,
      staffName,
      date,
      status: 'ACTIVE',
      items: mergedItems,
      totalPreOrderedUnits: totalPreOrdered,
      totalExtraLoadedUnits: totalExtraLoaded,
      totalLoadedUnits: totalLoaded,
      totalDeliveredUnits: totalDelivered,
      totalReturnedUnits: totalReturned,
      totalOutForDeliveryUnits: 0,
      totalDamagedUnits: 0,
      totalMissingUnits: 0,
      totalVarianceUnits: 0,
      notes: notes || '',
      loadedAt: isExistingActive
        ? (existingSnap.data() as StaffDailyStockSession).loadedAt || nowStr
        : nowStr,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    // 2. Commit batch write: Save Session + Deduct ONLY EXTRA quantities from Warehouse Stock
    const batch = writeBatch(db);
    batch.set(
      docRef,
      cleanFirestoreData({
        ...sessionData,
        updatedAt: serverTimestamp(),
        createdAt: isExistingActive
          ? existingSnap.data().createdAt || serverTimestamp()
          : serverTimestamp(),
      }),
      { merge: isExistingActive }
    );

    // Deduct only extraLoaded quantities from product stock
    const liveStockUpdates: Record<string, number> = {};
    for (const deduction of newExtraDeductions) {
      if (deduction.extraQty > 0) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, deduction.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          const currentWhStock = prodData.stockQty || 0;
          const newWhStock = Math.max(0, currentWhStock - deduction.extraQty);
          batch.update(prodRef, {
            stockQty: newWhStock,
            availableStock: newWhStock,
            updatedAt: serverTimestamp(),
          });
          liveStockUpdates[deduction.productId] = newWhStock;
        }
      }
    }

    if (Object.keys(liveStockUpdates).length > 0) {
      const stockRef = doc(db, SYSTEM_COLLECTION, LIVE_STOCK_DOC);
      batch.set(stockRef, liveStockUpdates, { merge: true });
    }

    await batch.commit();

    // Bump catalog version in metadata asynchronously if extra stock was deducted
    if (Object.keys(liveStockUpdates).length > 0) {
      productService.bumpProductsVersion().catch((err) => {
        console.warn('Failed to bump products version on staff stock load:', err);
      });
    }

    return sessionData;
  },

  // ── 5. Record Delivered Units from Order Fulfillment ──
  recordDeliveredUnits: async (
    staffId: string,
    deliveredItems: { productId: string; deliveredQty: number; damagedQty?: number; missingQty?: number }[],
    dateParam?: string,
    orderId?: string
  ): Promise<void> => {
    if (!staffId || !deliveredItems || deliveredItems.length === 0) return;
    const date = dateParam || getTodayDateStr();
    const docId = `stock_${staffId}_${date}`;
    const docRef = doc(db, STAFF_STOCK_COLLECTION, docId);

    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return;
    }

    const session = snapshot.data() as StaffDailyStockSession;

    // ── Idempotency guard ───────────────────────────────────────────────────
    // If this orderId has already been applied to the vehicle stock session,
    // do not add its delivered qty again (prevents double-counting from the
    // optimistic store update + Firestore write both calling this function).
    if (orderId) {
      const alreadyRecorded = session.deliveredByOrderId?.[orderId] === true;
      if (alreadyRecorded) {
        console.log(`[staffStockService] Order ${orderId} already recorded in vehicle stock — skipping duplicate.`);
        return;
      }
    }

    const itemsMap: Record<string, StaffStockItem> = {};
    (session.items || []).forEach((it) => {
      itemsMap[it.productId] = { ...it };
    });

    for (const d of deliveredItems) {
      if (itemsMap[d.productId]) {
        const item = itemsMap[d.productId];
        const newDelivered = item.deliveredQty + (d.deliveredQty || 0);
        const newDamaged = (item.damagedQty || 0) + (d.damagedQty || 0);
        // NOTE: missingQty is only for genuinely lost/stolen items, NOT for undelivered
        // order quantities. Undelivered units stay in the van (currentStock).
        const newMissing = (item.missingQty || 0) + (d.missingQty || 0);
        const newOutForDelivery = Math.max(0, (item.outForDeliveryQty || 0) - (d.deliveredQty || 0));
        // currentStock = what's physically left in the van:
        //   loadedQty − delivered − returned − damaged (genuinely lost)
        // Undelivered order remainder stays in van, so we do NOT subtract missingQty here.
        const curStock = Math.max(
          0,
          item.loadedQty - newDelivered - (item.returnedQty || 0) - newDamaged
        );
        itemsMap[d.productId] = {
          ...item,
          outForDeliveryQty: newOutForDelivery,
          deliveredQty: newDelivered,
          damagedQty: newDamaged,
          missingQty: newMissing,
          currentStock: curStock,
        };
      }
    }

    const updatedItems = Object.values(itemsMap);
    const totalDelivered = updatedItems.reduce((sum, it) => sum + it.deliveredQty, 0);
    const totalOutForDelivery = updatedItems.reduce((sum, it) => sum + (it.outForDeliveryQty || 0), 0);
    const totalDamaged = updatedItems.reduce((sum, it) => sum + (it.damagedQty || 0), 0);
    const totalMissing = updatedItems.reduce((sum, it) => sum + (it.missingQty || 0), 0);

    // Build the updated deliveredByOrderId map
    const updatedDeliveredByOrderId = {
      ...(session.deliveredByOrderId || {}),
      ...(orderId ? { [orderId]: true } : {}),
    };

    await updateDoc(
      docRef,
      cleanFirestoreData({
        items: updatedItems,
        totalDeliveredUnits: totalDelivered,
        totalOutForDeliveryUnits: totalOutForDelivery,
        totalDamagedUnits: totalDamaged,
        totalMissingUnits: totalMissing,
        deliveredByOrderId: updatedDeliveredByOrderId,
        updatedAt: serverTimestamp(),
      })
    );
  },

  // ── 5b. Sync Out for Delivery (On Way) Stock from Assigned Active Orders ──
  syncOutForDeliveryStock: async (
    staffId: string,
    orders: Order[],
    dateParam?: string
  ): Promise<void> => {
    if (!staffId) return;
    const date = dateParam || getTodayDateStr();
    const docId = `stock_${staffId}_${date}`;
    const docRef = doc(db, STAFF_STOCK_COLLECTION, docId);

    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return;

    const session = snapshot.data() as StaffDailyStockSession;
    const outForDeliveryMap: Record<string, number> = {};

    // Sum quantities from orders assigned to staff currently in OUT_FOR_DELIVERY status
    (orders || []).forEach((o) => {
      const orderStaffId = o.assignedStaffId || '';
      if (
        (orderStaffId === staffId || !orderStaffId) &&
        o.status === 'OUT_FOR_DELIVERY'
      ) {
        (o.items || []).forEach((item) => {
          outForDeliveryMap[item.productId] =
            (outForDeliveryMap[item.productId] || 0) + (item.orderedQty || 0);
        });
      }
    });

    let totalOutForDeliveryUnits = 0;
    const updatedItems = (session.items || []).map((it) => {
      const outQty = outForDeliveryMap[it.productId] || 0;
      totalOutForDeliveryUnits += outQty;
      return {
        ...it,
        outForDeliveryQty: outQty,
      };
    });

    await updateDoc(
      docRef,
      cleanFirestoreData({
        items: updatedItems,
        totalOutForDeliveryUnits,
        updatedAt: serverTimestamp(),
      })
    );
  },

  // ── 6. Return Leftover Stock at End of Day ──
  // Rule: ONLY good returnedQty is restocked to inventory.
  //       damagedQty and missingQty are logged as loss / discrepancy and NOT added to inventory!
  returnEveningStock: async (
    staffId: string,
    returnedItems: {
      productId: string;
      returnedQty: number;
      damagedQty?: number;
      missingQty?: number;
    }[],
    notes?: string,
    dateParam?: string
  ): Promise<StaffDailyStockSession> => {
    const date = dateParam || getTodayDateStr();
    const docId = `stock_${staffId}_${date}`;
    const docRef = doc(db, STAFF_STOCK_COLLECTION, docId);

    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      throw new Error('No active stock session found for today to return.');
    }

    const session = snapshot.data() as StaffDailyStockSession;
    const itemsMap: Record<string, StaffStockItem> = {};
    (session.items || []).forEach((it) => {
      itemsMap[it.productId] = { ...it };
    });

    const returnedMap = new Map<
      string,
      { returnedQty: number; damagedQty: number; missingQty: number }
    >();
    for (const r of returnedItems) {
      returnedMap.set(r.productId, {
        returnedQty: Math.max(0, r.returnedQty || 0),
        damagedQty: Math.max(0, r.damagedQty || 0),
        missingQty: Math.max(0, r.missingQty || 0),
      });
    }

    let hasVariance = false;
    let totalVariance = 0;
    const liveStockRestorations: Record<string, number> = {};

    for (const item of Object.values(itemsMap)) {
      const returnData = returnedMap.get(item.productId) || {
        returnedQty: 0,
        damagedQty: item.damagedQty || 0,
        missingQty: item.missingQty || 0,
      };
      const returnedQty = returnData.returnedQty;
      const damagedQty = returnData.damagedQty;
      const missingQty = returnData.missingQty;

      // Expected leftover in vehicle = loadedQty - deliveredQty
      const expectedLeftover = Math.max(0, item.loadedQty - item.deliveredQty);
      // Variance = expectedLeftover - (returnedQty + damagedQty + missingQty)
      const variance = expectedLeftover - (returnedQty + damagedQty + missingQty);

      if (variance !== 0) {
        hasVariance = true;
      }
      totalVariance += Math.abs(variance);

      itemsMap[item.productId] = {
        ...item,
        outForDeliveryQty: 0,
        returnedQty,
        damagedQty,
        missingQty,
        varianceQty: variance,
        currentStock: 0, // All on-hand stock returned or accounted for at day-end
      };
    }

    const updatedItems = Object.values(itemsMap);
    const totalReturned = updatedItems.reduce((sum, it) => sum + (it.returnedQty || 0), 0);
    const totalDamaged = updatedItems.reduce((sum, it) => sum + (it.damagedQty || 0), 0);
    const totalMissing = updatedItems.reduce((sum, it) => sum + (it.missingQty || 0), 0);

    const nowStr = new Date().toISOString();
    const finalStatus = hasVariance ? 'DISCREPANCY' : 'RETURNED';

    const finalSession: StaffDailyStockSession = {
      ...session,
      status: finalStatus,
      items: updatedItems,
      totalOutForDeliveryUnits: 0,
      totalReturnedUnits: totalReturned,
      totalDamagedUnits: totalDamaged,
      totalMissingUnits: totalMissing,
      totalVarianceUnits: totalVariance,
      returnedAt: nowStr,
      notes: notes !== undefined ? notes : session.notes || '',
      updatedAt: nowStr,
    };

    // Commit batch write: Update Session + Restock ONLY GOOD returned quantities to Warehouse
    const batch = writeBatch(db);
    batch.update(
      docRef,
      cleanFirestoreData({
        status: finalStatus,
        items: updatedItems,
        totalOutForDeliveryUnits: 0,
        totalReturnedUnits: totalReturned,
        totalDamagedUnits: totalDamaged,
        totalMissingUnits: totalMissing,
        totalVarianceUnits: totalVariance,
        returnedAt: nowStr,
        notes: finalSession.notes,
        updatedAt: serverTimestamp(),
      })
    );

    // Restock ONLY returnedQty (sellable good condition) to main warehouse
    // Damaged items and Missing items are NEVER restocked into warehouse inventory!
    for (const item of updatedItems) {
      const returnQty = item.returnedQty || 0;
      if (returnQty > 0) {
        const prodRef = doc(db, PRODUCTS_COLLECTION, item.productId);
        const prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          const currentWhStock = prodSnap.data().stockQty || 0;
          const restoredWhStock = currentWhStock + returnQty;
          batch.update(prodRef, {
            stockQty: restoredWhStock,
            availableStock: restoredWhStock,
            updatedAt: serverTimestamp(),
          });
          liveStockRestorations[item.productId] = restoredWhStock;
        }
      }
    }

    if (Object.keys(liveStockRestorations).length > 0) {
      const stockRef = doc(db, SYSTEM_COLLECTION, LIVE_STOCK_DOC);
      batch.set(stockRef, liveStockRestorations, { merge: true });
    }

    await batch.commit();

    // Bump catalog version in metadata asynchronously if stock was restored
    if (Object.keys(liveStockRestorations).length > 0) {
      productService.bumpProductsVersion().catch((err) => {
        console.warn('Failed to bump products version on stock return:', err);
      });
    }

    return finalSession;
  },
};
