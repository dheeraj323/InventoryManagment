import { create } from 'zustand';
import { User, UserRole } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  currentUser: User | null;
  activeRole: UserRole;
  activeVendorId: string;
  activeStaffId: string;
  isLoading: boolean;
  authError: string | null;
  pendingStaff: User[];
  
  initAuth: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerVendor: (params: {
    name: string;
    email: string;
    pass: string;
    phone: string;
    shopName: string;
    area?: string;
    address?: string;
  }) => Promise<void>;
  registerStaff: (params: {
    name: string;
    email: string;
    pass: string;
    phone: string;
    preferredArea?: string;
  }) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  updateProfile: (updates: { name?: string; phone?: string; area?: string }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  
  // Admin staff management actions
  fetchPendingStaff: () => Promise<void>;
  approveStaff: (userId: string, staffId: string, area?: string) => Promise<void>;
  rejectStaff: (userId: string, staffId: string, reason?: string) => Promise<void>;
  promoteToAdmin: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null, // Starts unauthenticated so LoginScreen is shown
  activeRole: 'ADMIN',
  activeVendorId: '',
  activeStaffId: '',
  isLoading: true,
  authError: null,
  pendingStaff: [],

  initAuth: () => {
    set({ isLoading: true });

    // Subscribe to Firebase Auth
    authService.onAuthChange((user) => {
      if (user) {
        set({
          currentUser: user,
          activeRole: user.role,
          activeVendorId: user.vendorId || '',
          activeStaffId: user.staffId || '',
          isLoading: false,
          authError: null,
        });
      } else {
        set({ currentUser: null, isLoading: false });
      }
    });
  },

  loginWithEmail: async (email: string, pass: string) => {
    set({ isLoading: true, authError: null });
    try {
      const user = await authService.signInWithEmail(email, pass);
      set({
        currentUser: user,
        activeRole: user.role,
        activeVendorId: user.vendorId || '',
        activeStaffId: user.staffId || '',
        isLoading: false,
        authError: null,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      let message = 'Failed to sign in. Please check your credentials.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      } else if (err.message) {
        message = err.message;
      }
      set({ isLoading: false, authError: message });
      throw new Error(message);
    }
  },

  registerVendor: async (params) => {
    set({ isLoading: true, authError: null });
    try {
      const user = await authService.registerVendor(params);
      set({
        currentUser: user,
        activeRole: 'VENDOR',
        activeVendorId: user.vendorId || '',
        isLoading: false,
        authError: null,
      });
    } catch (err: any) {
      console.error('Vendor registration error:', err);
      let message = 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.';
      } else if (err.message) {
        message = err.message;
      }
      set({ isLoading: false, authError: message });
      throw new Error(message);
    }
  },

  registerStaff: async (params) => {
    set({ isLoading: true, authError: null });
    try {
      const user = await authService.registerStaff(params);
      set({
        currentUser: user,
        activeRole: 'STAFF',
        activeStaffId: user.staffId || '',
        isLoading: false,
        authError: null,
      });
    } catch (err: any) {
      console.error('Staff registration error:', err);
      let message = 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.';
      } else if (err.message) {
        message = err.message;
      }
      set({ isLoading: false, authError: message });
      throw new Error(message);
    }
  },

  sendPasswordReset: async (email: string) => {
    set({ isLoading: true, authError: null });
    try {
      await authService.sendPasswordReset(email);
      set({ isLoading: false, authError: null });
    } catch (err: any) {
      console.error('Password reset error:', err);
      let message = 'Failed to send password reset email.';
      if (err.code === 'auth/user-not-found') {
        message = 'No account found with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.message) {
        message = err.message;
      }
      set({ isLoading: false, authError: message });
      throw new Error(message);
    }
  },

  refreshCurrentUser: async () => {
    const { currentUser } = get();
    if (!currentUser?.uid) return;

    set({ isLoading: true });
    try {
      const refreshed = await authService.getCurrentUserProfile(currentUser.uid);
      if (refreshed) {
        set({
          currentUser: refreshed,
          activeRole: refreshed.role,
          activeVendorId: refreshed.vendorId || '',
          activeStaffId: refreshed.staffId || '',
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error refreshing user status:', error);
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates: { name?: string; phone?: string; area?: string }) => {
    const { currentUser } = get();
    if (!currentUser?.uid) return;

    set({ isLoading: true });
    try {
      await authService.updateUserProfile(currentUser.uid, updates);
      set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error updating profile:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    set({
      currentUser: null,
      activeRole: 'ADMIN',
      authError: null,
    });
  },

  clearError: () => set({ authError: null }),

  fetchPendingStaff: async () => {
    try {
      const pending = await authService.getPendingStaff();
      set({ pendingStaff: pending });
    } catch (error) {
      console.error('Error in fetchPendingStaff:', error);
    }
  },

  approveStaff: async (userId: string, staffId: string, area?: string) => {
    try {
      await authService.approveStaff(userId, staffId, area);
      // Remove from pending list
      set((state) => ({
        pendingStaff: state.pendingStaff.filter((s) => s.id !== userId),
      }));
    } catch (error) {
      console.error('Error approving staff:', error);
      throw error;
    }
  },

  rejectStaff: async (userId: string, staffId: string, reason?: string) => {
    try {
      await authService.rejectStaff(userId, staffId, reason);
      // Remove from pending list
      set((state) => ({
        pendingStaff: state.pendingStaff.filter((s) => s.id !== userId),
      }));
    } catch (error) {
      console.error('Error rejecting staff:', error);
      throw error;
    }
  },

  promoteToAdmin: async (userId: string) => {
    try {
      await authService.promoteToAdmin(userId);
      set((state) => ({
        pendingStaff: state.pendingStaff.filter((s) => s.id !== userId),
      }));
    } catch (error) {
      console.error('Error promoting to admin:', error);
      throw error;
    }
  },
}));
