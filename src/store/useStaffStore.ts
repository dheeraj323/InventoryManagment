import { create } from 'zustand';
import { Staff, AccountStatus, UserRole } from '../types';
import { staffService } from '../services/staffService';

export type StaffFilter = 'ALL' | 'ACTIVE' | 'PENDING' | 'SUSPENDED';

interface StaffState {
  staffList: Staff[];
  isLoading: boolean;
  selectedFilter: StaffFilter;
  searchQuery: string;
  unsubscribe: (() => void) | null;

  subscribeStaff: () => void;
  unsubscribeStaff: () => void;
  setFilter: (filter: StaffFilter) => void;
  setSearchQuery: (query: string) => void;

  addStaff: (params: {
    name: string;
    phone: string;
    email?: string;
    activeArea?: string;
    role?: UserRole;
    notes?: string;
  }) => Promise<Staff>;

  updateStaff: (
    staffId: string,
    userId: string | undefined,
    updates: {
      name?: string;
      phone?: string;
      email?: string;
      activeArea?: string;
      notes?: string;
    }
  ) => Promise<void>;

  changeStatus: (
    staffId: string,
    userId: string | undefined,
    status: AccountStatus
  ) => Promise<void>;

  approveStaff: (
    userId: string,
    staffId: string,
    activeArea?: string
  ) => Promise<void>;

  rejectStaff: (
    userId: string,
    staffId: string,
    reason?: string
  ) => Promise<void>;

  setRole: (userId: string, staffId: string, role: UserRole) => Promise<void>;
}

export const useStaffStore = create<StaffState>((set, get) => ({
  staffList: [],
  isLoading: true,
  selectedFilter: 'ALL',
  searchQuery: '',
  unsubscribe: null,

  subscribeStaff: () => {
    const existingUnsub = get().unsubscribe;
    if (existingUnsub) {
      existingUnsub();
    }

    set({ isLoading: true });
    const unsub = staffService.subscribeStaff((list) => {
      set({
        staffList: list,
        isLoading: false,
      });
    });

    set({ unsubscribe: unsub });
  },

  unsubscribeStaff: () => {
    const unsub = get().unsubscribe;
    if (unsub) {
      unsub();
      set({ unsubscribe: null });
    }
  },

  setFilter: (filter) => set({ selectedFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  addStaff: async (params) => {
    return await staffService.createStaffMember(params);
  },

  updateStaff: async (staffId, userId, updates) => {
    await staffService.updateStaffMember(staffId, userId, updates);
  },

  changeStatus: async (staffId, userId, status) => {
    await staffService.updateStaffStatus(staffId, userId, status);
  },

  approveStaff: async (userId, staffId, activeArea) => {
    await staffService.approveStaffRegistration(userId, staffId, activeArea);
  },

  rejectStaff: async (userId, staffId, reason) => {
    await staffService.rejectStaffRegistration(userId, staffId, reason);
  },

  setRole: async (userId, staffId, role) => {
    await staffService.setStaffRole(userId, staffId, role);
  },
}));
