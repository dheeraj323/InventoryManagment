import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db, firebaseConfig } from '../config/firebase';
import { User, UserRole, AccountStatus, Vendor, Staff } from '../types';

const USER_PROFILE_CACHE_KEY = '@panihaar_user_profile';

// Secondary Auth instance to create or manage credentials without logging out current user (Admin)
const getSecondaryAuth = () => {
  const appName = 'SecondaryAdminVendorApp';
  const existingApp = getApps().find((a) => a.name === appName);
  const app = existingApp || initializeApp(firebaseConfig, appName);
  return getAuth(app);
};

export const authService = {
  // ── 1. Listen to Auth State Changes ─────────────────────────────────────────
  onAuthChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!firebaseUser) {
        await AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY).catch(() => {});
        callback(null);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          const fullUser: User = {
            ...userData,
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            status: userData.status || (userData.active ? 'ACTIVE' : 'PENDING_VERIFICATION'),
          };
          await AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(fullUser)).catch(() => {});
          callback(fullUser);
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

          await AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(defaultUser)).catch(() => {});
          callback(defaultUser);
        }
      } catch (error) {
        console.error('Error fetching user profile from Firestore:', error);
        
        // Recover from local cache if offline or network failure
        try {
          const cached = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
          if (cached) {
            const cachedUser = JSON.parse(cached) as User;
            if (cachedUser && cachedUser.uid === firebaseUser.uid) {
              callback(cachedUser);
              return;
            }
          }
        } catch (cacheErr) {
          console.warn('Failed to read cached user profile:', cacheErr);
        }

        // Fallback to authenticated firebase user rather than resetting to null
        callback({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          role: 'VENDOR',
          status: 'ACTIVE',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });
  },

  // ── 2. Sign In with Email or Username & Password ────────────────────────────
  signInWithEmail: async (emailOrUsername: string, pass: string): Promise<User> => {
    const trimmed = emailOrUsername.trim();
    let targetEmail = trimmed.toLowerCase();

    // If identifier doesn't contain '@', resolve username from Firestore
    if (!trimmed.includes('@')) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', trimmed.toLowerCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userData = snap.docs[0].data() as User;
        targetEmail = userData.email?.toLowerCase() || `${trimmed.toLowerCase()}@vendor.local`;
      } else {
        targetEmail = `${trimmed.toLowerCase()}@vendor.local`;
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
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

      // Create user profile if missing
      const newUser: User = {
        id: uid,
        uid: uid,
        name: cred.user.displayName || trimmed.split('@')[0],
        email: targetEmail,
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
    } catch (authErr: any) {
      // If password was updated by Admin in Firestore, check and sync
      const usersRef = collection(db, 'users');
      const q = trimmed.includes('@')
        ? query(usersRef, where('email', '==', targetEmail))
        : query(usersRef, where('username', '==', trimmed.toLowerCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const userData = snap.docs[0].data() as User;
        if (userData.customPassword && userData.customPassword === pass) {
          try {
            const secAuth = getSecondaryAuth();
            const secCred = await signInWithEmailAndPassword(secAuth, targetEmail, userData.customPassword);
            await updatePassword(secCred.user, pass);
            await secAuth.signOut();

            const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
            return {
              ...userData,
              id: cred.user.uid,
              uid: cred.user.uid,
              status: userData.status || 'ACTIVE',
            };
          } catch (syncErr) {
            console.warn('Could not auto-sync password with secondary auth:', syncErr);
          }
        }
      }

      throw authErr;
    }
  },

  // ── 2b. Send Password Reset Email ───────────────────────────────────────────
  sendPasswordReset: async (email: string): Promise<void> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      throw new Error('Please enter a valid email address.');
    }
    await sendPasswordResetEmail(auth, trimmedEmail);
  },

  // ── 2c. Register Vendor by Admin with Username & Password ───────────────────
  registerVendorByAdmin: async (params: {
    shopName: string;
    ownerName: string;
    phone: string;
    address?: string;
    username: string;
    password: string;
    adminName?: string;
  }): Promise<{ vendor: Vendor; user: User }> => {
    const cleanUsername = params.username.toLowerCase().trim().replace(/\s+/g, '_');
    const vendorEmail = `${cleanUsername}@vendor.local`;
    const nowStr = new Date().toISOString();

    // 1. Check if username is already taken
    const usersRef = collection(db, 'users');
    const existingSnap = await getDocs(query(usersRef, where('username', '==', cleanUsername)));
    if (!existingSnap.empty) {
      throw new Error(`Username "${cleanUsername}" is already taken. Please choose another username.`);
    }

    // 2. Create Firebase Auth user using secondary auth instance so Admin session stays logged in
    let vendorUid = `vendor-user-${Date.now().toString(36)}`;
    try {
      const secAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secAuth, vendorEmail, params.password);
      vendorUid = cred.user.uid;
      await secAuth.signOut();
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        throw new Error(`Username "${cleanUsername}" is already registered.`);
      }
      console.warn('Secondary auth user creation warning:', authErr);
    }

    const vendorId = `vendor-${Date.now().toString(36)}`;

    // 3. Create Vendor document
    const vendorRef = doc(db, 'vendors', vendorId);
    const newVendor: Vendor = {
      id: vendorId,
      vendorId,
      name: params.ownerName.trim(),
      ownerName: params.ownerName.trim(),
      shopName: params.shopName.trim(),
      businessName: params.shopName.trim(),
      username: cleanUsername,
      phone: params.phone.trim(),
      email: vendorEmail,
      address: params.address?.trim() || '',
      area: 'Central',
      vendorType: 'Retail Store',
      paymentTerms: 'Net 15 Days',
      creditLimit: 0,
      openingBalance: 0,
      currentBalance: 0,
      currentOutstanding: 0,
      overdueAmount: 0,
      payLaterEligible: true,
      payLaterEnabled: true,
      preferredPaymentMode: 'CASH',
      passwordManagedByAdmin: true,
      status: 'ACTIVE',
      active: true,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await setDoc(vendorRef, {
      ...newVendor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. Create User document linked to vendor
    const userRef = doc(db, 'users', vendorUid);
    const userDoc: User = {
      id: vendorUid,
      uid: vendorUid,
      name: params.ownerName.trim(),
      username: cleanUsername,
      email: vendorEmail,
      phone: params.phone.trim(),
      role: 'VENDOR',
      status: 'ACTIVE',
      active: true,
      vendorId,
      businessName: params.shopName.trim(),
      address: params.address?.trim() || '',
      passwordManagedByAdmin: true,
      customPassword: params.password,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await setDoc(userRef, {
      ...userDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { vendor: newVendor, user: userDoc };
  },

  // ── 2d. Admin Change Vendor Password ─────────────────────────────────────────
  adminUpdateVendorPassword: async (vendorId: string, newPassword: string): Promise<void> => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('vendorId', '==', vendorId));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('No user account linked to this vendor.');
    }

    const userDocSnap = snap.docs[0];
    const userData = userDocSnap.data() as User;
    const targetEmail = userData.email;

    // Update Firestore User doc with new password
    await updateDoc(doc(db, 'users', userDocSnap.id), {
      customPassword: newPassword,
      passwordManagedByAdmin: true,
      updatedAt: serverTimestamp(),
    });

    // Also update vendor doc if present
    try {
      const vendorRef = doc(db, 'vendors', vendorId);
      await updateDoc(vendorRef, {
        passwordManagedByAdmin: true,
        updatedAt: serverTimestamp(),
      });
    } catch (vErr) {
      console.warn('Vendor doc update warning:', vErr);
    }

    // Update Firebase Auth password using secondary auth
    try {
      if (userData.customPassword && targetEmail) {
        const secAuth = getSecondaryAuth();
        const cred = await signInWithEmailAndPassword(secAuth, targetEmail, userData.customPassword);
        await updatePassword(cred.user, newPassword);
        await secAuth.signOut();
      }
    } catch (authErr) {
      console.warn('Secondary auth update note (custom password stored in Firestore):', authErr);
    }
  },

  // ── 3. Register Vendor ──────────────────────────────────────────────────────
  registerVendor: async (params: {
    name: string;
    email: string;
    pass: string;
    phone: string;
    shopName: string;
    routeId?: string;
    routeName?: string;
    area?: string;
    address?: string;
  }): Promise<User> => {
    const trimmedEmail = params.email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, params.pass);
    const uid = cred.user.uid;
    const vendorId = `vendor-${Date.now().toString(36)}`;
    const effectiveRouteName = params.routeName?.trim() || params.area?.trim() || '';

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
      routeId: params.routeId?.trim() || undefined,
      routeName: effectiveRouteName || undefined,
      area: effectiveRouteName || undefined,
      vendorType: 'Retailer',
      openingBalance: 0,
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
      routeId: params.routeId?.trim() || undefined,
      routeName: effectiveRouteName || undefined,
      area: effectiveRouteName || undefined,
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

  // ── 5b. Fetch Active Field & Delivery Staff Members ────────────────────────
  getActiveStaff: async (): Promise<Staff[]> => {
    try {
      const q = query(collection(db, 'staff'), where('active', '==', true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => ({ ...d.data(), id: d.id, staffId: d.id } as Staff));
      }
      // Fallback: check users collection for active staff
      const uq = query(
        collection(db, 'users'),
        where('role', '==', 'STAFF'),
        where('status', '==', 'ACTIVE')
      );
      const uSnap = await getDocs(uq);
      return uSnap.docs.map((d) => {
        const u = d.data();
        return {
          id: u.staffId || d.id,
          staffId: u.staffId || d.id,
          name: u.name || 'Staff Member',
          phone: u.phone || '',
          todayAssignedDeliveries: 0,
          cashInHand: 0,
          active: true,
        } as Staff;
      });
    } catch (error) {
      console.error('Error fetching active staff:', error);
      return [];
    }
  },

  // ── 6. Admin Actions: Approve Staff Member ──────────────────────────────────
  approveStaff: async (userId: string, staffId: string): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: 'ACTIVE',
      active: true,
      updatedAt: serverTimestamp(),
    });

    if (staffId) {
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, {
        active: true,
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
  updateUserProfile: async (
    uid: string,
    updates: {
      name?: string;
      phone?: string;
      area?: string;
      routeId?: string;
      routeName?: string;
      address?: string;
      businessName?: string;
      locationUrl?: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<void> => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  // ── 10. Logout User ─────────────────────────────────────────────────────────
  logout: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY);
    } catch {}
    await signOut(auth);
  },
};
