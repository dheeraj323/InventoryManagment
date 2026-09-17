import { create } from 'zustand';
import { User, UserRole } from '../types';
import { MOCK_USERS } from '../constants/mockData';
import { authService } from '../services/authService';
import { seedFirestoreIfEmpty } from '../services/seedFirestore';

interface AuthState {
  currentUser: User | null;
  activeRole: UserRole;
  activeVendorId: string;
  activeStaffId: string;
  isLoading: boolean;
  initAuth: () => void;
  loginAsRole: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: MOCK_USERS[0], // Default to Admin for immediate UI preview
  activeRole: 'ADMIN',
  activeVendorId: 'vendor-1',
  activeStaffId: 'staff-1',
  isLoading: false,

  initAuth: () => {
    // Seed Firestore if database is empty
    seedFirestoreIfEmpty().catch((err) => console.error('Firestore auto-seed error:', err));

    // Subscribe to Firebase Auth
    authService.onAuthChange((user) => {
      if (user) {
        set({
          currentUser: user,
          activeRole: user.role,
          activeVendorId: user.vendorId || 'vendor-1',
          activeStaffId: user.staffId || 'staff-1',
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    });
  },

  loginAsRole: (role: UserRole) => {
    const user = MOCK_USERS.find((u) => u.role === role) || MOCK_USERS[0];
    set({
      currentUser: user,
      activeRole: role,
      activeVendorId: user.vendorId || 'vendor-1',
      activeStaffId: user.staffId || 'staff-1',
    });
  },

  switchRole: (role: UserRole) => {
    const user = MOCK_USERS.find((u) => u.role === role) || MOCK_USERS[0];
    set({
      currentUser: user,
      activeRole: role,
      activeVendorId: user.vendorId || 'vendor-1',
      activeStaffId: user.staffId || 'staff-1',
    });
  },

  logout: () => {
    authService.logout().catch((err) => console.error('Logout error:', err));
    set({
      currentUser: null,
      activeRole: 'VENDOR',
    });
  },
}));
