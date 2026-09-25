import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { DeliveryRoute } from '../types';

const ROUTES_COLLECTION = 'routes';
const STAFF_COLLECTION = 'staff';
const USERS_COLLECTION = 'users';
const ORDERS_COLLECTION = 'orders';

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

export function generateRouteCode(name?: string): string {
  if (!name || !name.trim()) {
    return `RT-${Math.floor(100 + Math.random() * 900)}`;
  }
  const clean = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  let prefix = '';
  if (words.length >= 2) {
    prefix = words.map((w) => w[0]).slice(0, 4).join('');
  } else if (words.length === 1) {
    prefix = words[0].slice(0, 3);
  } else {
    prefix = 'RT';
  }
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `RT-${prefix}-${randomSuffix}`;
}

export const routeService = {
  // Fetch all routes
  getRoutes: async (): Promise<DeliveryRoute[]> => {
    try {
      const q = query(collection(db, ROUTES_COLLECTION), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        routeId: docSnap.id,
        ...docSnap.data(),
      })) as DeliveryRoute[];
    } catch (error) {
      console.error('Error fetching routes from Firestore:', error);
      return [];
    }
  },

  // Real-time subscription to all routes
  subscribeRoutes: (callback: (routes: DeliveryRoute[]) => void) => {
    const q = query(collection(db, ROUTES_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const routes = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          routeId: docSnap.id,
          ...docSnap.data(),
        })) as DeliveryRoute[];
        // Sort alphabetically by name
        routes.sort((a, b) => a.name.localeCompare(b.name));
        callback(routes);
      },
      (error) => {
        console.error('Real-time routes subscription error:', error);
      }
    );
  },

  // Get single route by ID
  getRouteById: async (routeId: string): Promise<DeliveryRoute | null> => {
    try {
      const docRef = doc(db, ROUTES_COLLECTION, routeId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return {
          id: snapshot.id,
          routeId: snapshot.id,
          ...snapshot.data(),
        } as DeliveryRoute;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching route ${routeId}:`, error);
      return null;
    }
  },

  // Create a new Route
  createRoute: async (routeData: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
    const routeRef = doc(collection(db, ROUTES_COLLECTION));
    const routeId = routeRef.id;
    const nowStr = new Date().toISOString();

    const newRoute: DeliveryRoute = {
      id: routeId,
      routeId,
      name: routeData.name?.trim() || 'New Route',
      code: routeData.code?.trim() || generateRouteCode(routeData.name),
      description: routeData.description?.trim() || '',
      assignedStaffId: routeData.assignedStaffId || undefined,
      assignedStaffName: routeData.assignedStaffName || undefined,
      assignedStaffPhone: routeData.assignedStaffPhone || undefined,
      active: routeData.active ?? true,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await setDoc(
      routeRef,
      cleanFirestoreData({
        ...newRoute,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // If a staff member is assigned on creation, sync their profile
    if (newRoute.assignedStaffId) {
      await routeService.assignStaffToRoute(routeId, {
        id: newRoute.assignedStaffId,
        name: newRoute.assignedStaffName || 'Staff',
        phone: newRoute.assignedStaffPhone || '',
      }, newRoute.name);
    }

    return newRoute;
  },

  // Update existing route
  updateRoute: async (routeId: string, updates: Partial<DeliveryRoute>): Promise<void> => {
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    await updateDoc(
      routeRef,
      cleanFirestoreData({
        ...updates,
        updatedAt: serverTimestamp(),
      })
    );
  },

  // Assign or unassign a staff member to a route
  assignStaffToRoute: async (
    routeId: string,
    staff: { id: string; name: string; phone?: string } | null,
    routeName?: string
  ): Promise<void> => {
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    let resolvedRouteName = routeName;

    if (!resolvedRouteName) {
      const rSnap = await getDoc(routeRef);
      if (rSnap.exists()) {
        resolvedRouteName = rSnap.data()?.name;
      }
    }

    const batch = writeBatch(db);

    // 1. Update Route document
    if (staff) {
      batch.update(routeRef, {
        assignedStaffId: staff.id,
        assignedStaffName: staff.name,
        assignedStaffPhone: staff.phone || '',
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(routeRef, {
        assignedStaffId: null,
        assignedStaffName: null,
        assignedStaffPhone: null,
        updatedAt: serverTimestamp(),
      });
    }

    // 2. If staff is assigned, update Staff document & User document with assigned route
    if (staff && staff.id) {
      const staffRef = doc(db, STAFF_COLLECTION, staff.id);
      batch.set(
        staffRef,
        {
          assignedRouteId: routeId,
          assignedRouteName: resolvedRouteName || '',
          activeArea: resolvedRouteName || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Check if user doc exists with staffId or id
      const userRef = doc(db, USERS_COLLECTION, staff.id);
      batch.set(
        userRef,
        {
          assignedRouteId: routeId,
          assignedRouteName: resolvedRouteName || '',
          routeId: routeId,
          routeName: resolvedRouteName || '',
          area: resolvedRouteName || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    // 3. Automatically sync open / undelivered orders on this route to this staff
    try {
      // Find all vendors on this route to also match orders missing routeId
      const vendorsQ = query(
        collection(db, 'vendors'),
        where('routeId', '==', routeId)
      );
      const vendorsSnap = await getDocs(vendorsQ);
      const vendorIdsOnRoute = new Set(vendorsSnap.docs.map((d) => d.id));

      const ordersSnap = await getDocs(collection(db, ORDERS_COLLECTION));
      const orderBatch = writeBatch(db);
      let count = 0;

      ordersSnap.forEach((oDoc) => {
        const orderData = oDoc.data();
        const matchesRoute =
          orderData.routeId === routeId ||
          (orderData.vendorId && vendorIdsOnRoute.has(orderData.vendorId)) ||
          (orderData.routeName && resolvedRouteName && orderData.routeName.toLowerCase() === resolvedRouteName.toLowerCase());

        if (
          matchesRoute &&
          orderData.status !== 'DELIVERED' &&
          orderData.status !== 'PARTIALLY_DELIVERED' &&
          orderData.status !== 'CANCELLED'
        ) {
          if (staff) {
            const isApprovedOrOut = orderData.status === 'APPROVED' || orderData.status === 'OUT_FOR_DELIVERY';
            orderBatch.update(oDoc.ref, {
              assignedStaffId: staff.id,
              assignedStaffName: staff.name,
              assignedStaffPhone: staff.phone || '',
              routeId: routeId,
              routeName: resolvedRouteName || '',
              ...(isApprovedOrOut
                ? {
                    status: 'OUT_FOR_DELIVERY',
                    dispatchedAt: orderData.dispatchedAt || new Date().toISOString(),
                  }
                : {}),
              updatedAt: serverTimestamp(),
            });
          } else {
            orderBatch.update(oDoc.ref, {
              assignedStaffId: null,
              assignedStaffName: null,
              assignedStaffPhone: null,
              updatedAt: serverTimestamp(),
            });
          }
          count++;
        }
      });

      if (count > 0) {
        await orderBatch.commit();
      }
    } catch (orderSyncErr) {
      console.warn('Could not auto-sync open orders for route assignment:', orderSyncErr);
    }
  },

  // Delete / deactivate route
  deleteRoute: async (routeId: string): Promise<void> => {
    const routeRef = doc(db, ROUTES_COLLECTION, routeId);
    await deleteDoc(routeRef);
  },
};
