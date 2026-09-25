import { create } from 'zustand';
import { DeliveryRoute } from '../types';
import { routeService } from '../services/routeService';
import { useStaffStore } from './useStaffStore';

interface RouteState {
  routes: DeliveryRoute[];
  isLoading: boolean;
  fetchRoutes: () => Promise<void>;
  subscribeRoutes: () => () => void;
  createRoute: (routeData: Partial<DeliveryRoute>) => Promise<DeliveryRoute>;
  updateRoute: (routeId: string, updates: Partial<DeliveryRoute>) => Promise<void>;
  assignStaffToRoute: (
    routeId: string,
    staff: { id: string; name: string; phone?: string } | null,
    routeName?: string
  ) => Promise<void>;
  deleteRoute: (routeId: string) => Promise<void>;
  getRouteById: (id?: string) => DeliveryRoute | undefined;
  getRoutesByStaff: (staffId?: string) => DeliveryRoute[];
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  isLoading: false,

  fetchRoutes: async () => {
    set({ isLoading: true });
    try {
      const routes = await routeService.getRoutes();
      set({ routes: routes || [], isLoading: false });
    } catch (err) {
      console.error('Error fetching routes:', err);
      set({ isLoading: false });
    }
  },

  subscribeRoutes: () => {
    return routeService.subscribeRoutes((firestoreRoutes) => {
      set({ routes: firestoreRoutes || [] });
    });
  },

  createRoute: async (routeData) => {
    set({ isLoading: true });
    try {
      const newRoute = await routeService.createRoute(routeData);
      set((state) => {
        const filtered = state.routes.filter((r) => r.id !== newRoute.id);
        const updated = [...filtered, newRoute];
        updated.sort((a, b) => a.name.localeCompare(b.name));
        return { routes: updated, isLoading: false };
      });
      return newRoute;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateRoute: async (routeId, updates) => {
    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId || r.routeId === routeId ? { ...r, ...updates } : r
      ),
    }));
    try {
      await routeService.updateRoute(routeId, updates);
    } catch (err) {
      console.error(`Error updating route ${routeId}:`, err);
    }
  },

  assignStaffToRoute: async (routeId, staff, routeName) => {
    const route = get().getRouteById(routeId);
    const rName = routeName || route?.name || '';

    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId || r.routeId === routeId
          ? {
              ...r,
              assignedStaffId: staff ? staff.id : undefined,
              assignedStaffName: staff ? staff.name : undefined,
              assignedStaffPhone: staff ? staff.phone : undefined,
            }
          : r
      ),
    }));

    try {
      await routeService.assignStaffToRoute(routeId, staff, rName);
    } catch (err) {
      console.error(`Error assigning staff to route ${routeId}:`, err);
    }
  },

  deleteRoute: async (routeId) => {
    set((state) => ({
      routes: state.routes.filter((r) => r.id !== routeId && r.routeId !== routeId),
    }));
    try {
      await routeService.deleteRoute(routeId);
    } catch (err) {
      console.error(`Error deleting route ${routeId}:`, err);
    }
  },

  getRouteById: (id?: string) => {
    if (!id) return undefined;
    return get().routes.find((r) => r.id === id || r.routeId === id);
  },

  getRoutesByStaff: (staffId?: string) => {
    if (!staffId) return [];
    return get().routes.filter(
      (r) => r.assignedStaffId === staffId || (r as any).staffId === staffId
    );
  },
}));
