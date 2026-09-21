import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole, AccountStatus, Vendor, Staff } from '../types';

export const authService = {
  // ── 1. Listen to Auth State Changes ─────────────────────────────────────────
  onAuthChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        callback(null);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          callback({
            ...userData,
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            status: userData.status || (userData.active ? 'ACTIVE' : 'PENDING_VERIFICATION'),
          });
        } else {
          // Dynamic profile fallback
          const defaultUser: User = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            role: 'VENDOR',
            status: 'ACTIVE',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          // Auto-persist user profile to Firestore
          try {
            await setDoc(userDocRef, {
              ...defaultUser,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.warn('Could not auto-create user profile doc:', e);
          }

          callback(defaultUser);
        }
      } catch (error) {
        console.error('Error fetching user profile from Firestore:', error);
        callback(null);
      }
    });
  },

  // ── 2. Sign In with Email & Password ────────────────────────────────────────
  signInWithEmail: async (email: string, pass: string): Promise<User> => {
    const trimmedEmail = email.trim().toLowerCase();
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, pass);

    const uid = cred.user.uid;
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      return {
        ...userData,
        id: uid,
        uid: uid,
        status: userData.status || 'ACTIVE',
      };
    }

    // Create user profile if it doesn't exist
    const newUser: User = {
      id: uid,
      uid: uid,
      name: cred.user.displayName || trimmedEmail.split('@')[0],
      email: trimmedEmail,
      phone: '',
      role: 'VENDOR',
      status: 'ACTIVE',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userDocRef, {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newUser;
  },

  // ── 2b. Send Password Reset Email ───────────────────────────────────────────
  sendPasswordReset: async (email: string): Promise<void> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('Please enter a valid email address.');
    }
    await sendPasswordResetEmail(auth, trimmedEmail);
  },

  // ── 3. Register Vendor ──────────────────────────────────────────────────────
  registerVendor: async (params: {
    name: string;
    email: string;
    pass: string;
    phone: string;
    shopName: string;
    area?: string;
    address?: string;
  }): Promise<User> => {
    const trimmedEmail = params.email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, params.pass);
    const uid = cred.user.uid;
    const vendorId = `vendor-${Date.now().toString(36)}`;

    // 1. Create Vendor Doc
    const vendorRef = doc(db, 'vendors', vendorId);
    const vendorData: Vendor = {
      id: vendorId,
      vendorId,
      name: params.name.trim(),
      ownerName: params.name.trim(),
      shopName: params.shopName.trim(),
      businessName: params.shopName.trim(),
      phone: params.phone.trim(),
      email: trimmedEmail,
      address: params.address?.trim() || '',
      area: params.area?.trim() || 'Central',
      vendorType: 'Retailer',
      currentBalance: 0,
      currentOutstanding: 0,
      creditLimit: 0,
      payLaterEligible: false,
      preferredPaymentMode: 'CASH',
      status: 'ACTIVE',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(vendorRef, {
      ...vendorData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Create User Profile
    const userRef = doc(db, 'users', uid);
    const userDoc: User = {
      id: uid,
      uid,
      name: params.name.trim(),
      email: trimmedEmail,
      phone: params.phone.trim(),
      role: 'VENDOR',
      status: 'ACTIVE',
      active: true,
      vendorId,
      businessName: params.shopName.trim(),
      area: params.area?.trim() || 'Central',
      address: params.address?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, {
      ...userDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return userDoc;
  },

  // ── 4. Register Staff (Requires Admin Verification) ─────────────────────────
  registerStaff: async (params: {
    name: string;
    email: string;
    pass: string;
    phone: string;
    preferredArea?: string;
  }): Promise<User> => {
    const trimmedEmail = params.email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, params.pass);
    const uid = cred.user.uid;
    const staffId = `staff-${Date.now().toString(36)}`;

    // 1. Create Staff Doc (status: PENDING_VERIFICATION)
    const staffRef = doc(db, 'staff', staffId);
    const staffData: Staff = {
      id: staffId,
      staffId,
      name: params.name.trim(),
      phone: params.phone.trim(),
      activeArea: params.preferredArea?.trim() || 'Unassigned',
      todayAssignedDeliveries: 0,
      cashInHand: 0,
      active: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(staffRef, {
      ...staffData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Create User Profile with PENDING_VERIFICATION status
    const userRef = doc(db, 'users', uid);
    const userDoc: User = {
      id: uid,
      uid,
      name: params.name.trim(),
      email: trimmedEmail,
      phone: params.phone.trim(),
      role: 'STAFF',
      status: 'PENDING_VERIFICATION',
      active: false,
      staffId,
      area: params.preferredArea?.trim() || 'Unassigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, {
      ...userDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return userDoc;
  },

  // ── 5. Admin Actions: Get Pending Staff Registrations ────────────────────────
  getPendingStaff: async (): Promise<User[]> => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'STAFF'),
        where('status', '==', 'PENDING_VERIFICATION')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ ...d.data(), id: d.id, uid: d.id } as User));
    } catch (error) {
      console.error('Error fetching pending staff:', error);
      return [];
    }
  },

  // ── 6. Admin Actions: Approve Staff Member ──────────────────────────────────
  approveStaff: async (userId: string, staffId: string, assignedArea?: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: 'ACTIVE',
      active: true,
      area: assignedArea || 'Central Zone',
      updatedAt: serverTimestamp(),
    });

    if (staffId) {
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, {
        active: true,
        activeArea: assignedArea || 'Central Zone',
        updatedAt: serverTimestamp(),
      });
    }
  },

  // ── 7. Admin Actions: Reject Staff Member ───────────────────────────────────
  rejectStaff: async (userId: string, staffId: string, reason?: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: 'REJECTED',
      active: false,
      rejectionReason: reason || 'Application not approved by admin',
      updatedAt: serverTimestamp(),
    });

    if (staffId) {
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, {
        active: false,
        updatedAt: serverTimestamp(),
      });
    }
  },

  // ── 8. Admin Actions: Promote User / Staff to Co-Admin ──────────────────────
  promoteToAdmin: async (userId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: 'ADMIN',
      status: 'ACTIVE',
      active: true,
      updatedAt: serverTimestamp(),
    });
  },

  // ── 8. Refresh Current User Profile ─────────────────────────────────────────
  getCurrentUserProfile: async (uid: string): Promise<User | null> => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as User;
        return {
          ...data,
          id: uid,
          uid,
          status: data.status || (data.active ? 'ACTIVE' : 'PENDING_VERIFICATION'),
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting current user profile:', error);
      return null;
    }
  },

  // ── 9. Update User Profile ──────────────────────────────────────────────────
  updateUserProfile: async (uid: string, updates: { name?: string; phone?: string; area?: string }): Promise<void> => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  // ── 10. Logout User ─────────────────────────────────────────────────────────
  logout: async (): Promise<void> => {
    await signOut(auth);
  },
};
