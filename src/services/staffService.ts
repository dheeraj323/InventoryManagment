import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Staff, User, AccountStatus, UserRole } from '../types';

export const staffService = {
  /**
   * Real-time subscription to all staff members (Active, Pending, Suspended, Co-Admins).
   * Aggregates data from both `staff` collection and `users` collection.
   */
  subscribeStaff: (callback: (staff: Staff[]) => void): Unsubscribe => {
    // 1. Listen to staff collection
    const staffRef = collection(db, 'staff');
    const usersRef = collection(db, 'users');

    let currentStaffDocs: Staff[] = [];
    let currentStaffUsers: User[] = [];

    const mergeAndEmit = () => {
      const staffMap = new Map<string, Staff>();

      // Index staff docs
      currentStaffDocs.forEach((s) => {
        const key = s.staffId || s.id;
        staffMap.set(key, {
          ...s,
          id: key,
          staffId: key,
          status: s.status || (s.active ? 'ACTIVE' : 'SUSPENDED'),
        });
      });

      // Merge user accounts (matches on staffId or user uid)
      currentStaffUsers.forEach((u) => {
        const staffKey = u.staffId || u.id;
        const existing = staffMap.get(staffKey);

        if (existing) {
          staffMap.set(staffKey, {
            ...existing,
            userId: u.id,
            email: u.email || existing.email,
            phone: u.phone || existing.phone,
            name: u.name || existing.name,
            role: u.role,
            status: u.status || existing.status,
            active: u.status === 'ACTIVE' || (u.active ?? existing.active ?? false),
            activeArea: existing.activeArea || u.area,
          });
        } else {
          // User exists with STAFF role but staff doc not yet created/found
          staffMap.set(staffKey, {
            id: staffKey,
            staffId: staffKey,
            userId: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            role: u.role,
            status: u.status || (u.active ? 'ACTIVE' : 'PENDING_VERIFICATION'),
            activeArea: u.area || 'All Areas',
            todayAssignedDeliveries: 0,
            cashInHand: 0,
            active: u.status === 'ACTIVE' || (u.active ?? false),
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          });
        }
      });

      const list = Array.from(staffMap.values()).sort((a, b) => {
        // Pending first, then active, then alphabetical
        if (a.status === 'PENDING_VERIFICATION' && b.status !== 'PENDING_VERIFICATION') return -1;
        if (b.status === 'PENDING_VERIFICATION' && a.status !== 'PENDING_VERIFICATION') return 1;
        return a.name.localeCompare(b.name);
      });

      callback(list);
    };

    const unsubStaff = onSnapshot(
      staffRef,
      (snapshot) => {
        currentStaffDocs = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
          staffId: docSnap.id,
        })) as Staff[];
        mergeAndEmit();
      },
      (error) => {
        console.error('Error in staff collection subscription:', error);
      }
    );

    const qUsers = query(collection(db, 'users'), where('role', 'in', ['STAFF', 'ADMIN']));
    const unsubUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        currentStaffUsers = snapshot.docs
          .map((docSnap) => ({
            ...docSnap.data(),
            id: docSnap.id,
            uid: docSnap.id,
          })) as User[];
        // Filter out pure admin if not created as staff co-admin
        currentStaffUsers = currentStaffUsers.filter(
          (u) => u.role === 'STAFF' || u.staffId || u.status === 'PENDING_VERIFICATION'
        );
        mergeAndEmit();
      },
      (error) => {
        console.error('Error in users staff subscription:', error);
      }
    );

    return () => {
      unsubStaff();
      unsubUsers();
    };
  },

  /**
   * Direct creation of staff member by Administrator
   */
  createStaffMember: async (params: {
    name: string;
    phone: string;
    email?: string;
    activeArea?: string;
    role?: UserRole;
    monthlySalary?: number;
    salaryType?: 'MONTHLY' | 'DAILY';
    dailyRate?: number;
    notes?: string;
  }): Promise<Staff> => {
    const staffId = `staff-${Date.now().toString(36)}`;
    const trimmedName = params.name.trim();
    const trimmedPhone = params.phone.trim();
    const trimmedEmail = params.email?.trim().toLowerCase() || `${staffId}@panihaardms.local`;
    const area = params.activeArea?.trim() || 'Central Zone';
    const role: UserRole = params.role || 'STAFF';
    const monthlySalary = params.monthlySalary || 0;
    const salaryType = params.salaryType || 'MONTHLY';
    const dailyRate = params.dailyRate || (monthlySalary > 0 ? Math.round(monthlySalary / 30) : 0);

    // 1. Create staff record
    const staffRef = doc(db, 'staff', staffId);
    const newStaff: Staff = {
      id: staffId,
      staffId,
      name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      activeArea: area,
      role,
      status: 'ACTIVE',
      todayAssignedDeliveries: 0,
      cashInHand: 0,
      monthlySalary,
      salaryType,
      dailyRate,
      totalAdvanceOutstanding: 0,
      active: true,
      notes: params.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(staffRef, {
      ...newStaff,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Create user profile in users collection
    const userRef = doc(db, 'users', staffId);
    const newUserDoc: User = {
      id: staffId,
      uid: staffId,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      role,
      status: 'ACTIVE',
      active: true,
      staffId,
      area,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, {
      ...newUserDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newStaff;
  },

  /**
   * Update staff contact, name, and route/area details
   */
  updateStaffMember: async (
    staffId: string,
    userId: string | undefined,
    updates: {
      name?: string;
      phone?: string;
      email?: string;
      activeArea?: string;
      monthlySalary?: number;
      salaryType?: 'MONTHLY' | 'DAILY';
      dailyRate?: number;
      notes?: string;
    }
  ): Promise<void> => {
    const timestamp = serverTimestamp();

    // 1. Update staff doc
    const staffRef = doc(db, 'staff', staffId);
    await updateDoc(staffRef, {
      ...updates,
      updatedAt: timestamp,
    });

    // 2. Update user doc if exists
    const targetUserId = userId || staffId;
    try {
      const userRef = doc(db, 'users', targetUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.phone ? { phone: updates.phone } : {}),
          ...(updates.email ? { email: updates.email } : {}),
          ...(updates.activeArea ? { area: updates.activeArea } : {}),
          ...(updates.monthlySalary !== undefined ? { monthlySalary: updates.monthlySalary } : {}),
          ...(updates.salaryType ? { salaryType: updates.salaryType } : {}),
          ...(updates.dailyRate !== undefined ? { dailyRate: updates.dailyRate } : {}),
          updatedAt: timestamp,
        });
      }
    } catch (e) {
      console.warn('Could not update corresponding user doc:', e);
    }
  },

  /**
   * Change staff account status (ACTIVE, SUSPENDED, REJECTED)
   */
  updateStaffStatus: async (
    staffId: string,
    userId: string | undefined,
    status: AccountStatus
  ): Promise<void> => {
    const isActive = status === 'ACTIVE';
    const timestamp = serverTimestamp();

    // Update staff doc
    const staffRef = doc(db, 'staff', staffId);
    await updateDoc(staffRef, {
      status,
      active: isActive,
      updatedAt: timestamp,
    });

    // Update user doc
    const targetUserId = userId || staffId;
    try {
      const userRef = doc(db, 'users', targetUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          status,
          active: isActive,
          updatedAt: timestamp,
        });
      }
    } catch (e) {
      console.warn('Could not update user doc status:', e);
    }
  },

  /**
   * Approve a pending staff registration and assign initial route/area
   */
  approveStaffRegistration: async (
    userId: string,
    staffId: string,
    activeArea?: string
  ): Promise<void> => {
    const timestamp = serverTimestamp();
    const effectiveStaffId = staffId || userId;

    // 1. Update user
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: 'ACTIVE',
      active: true,
      ...(activeArea ? { area: activeArea } : {}),
      updatedAt: timestamp,
    });

    // 2. Ensure staff doc exists and is active
    const staffRef = doc(db, 'staff', effectiveStaffId);
    const staffSnap = await getDoc(staffRef);
    if (staffSnap.exists()) {
      await updateDoc(staffRef, {
        active: true,
        status: 'ACTIVE',
        ...(activeArea ? { activeArea } : {}),
        updatedAt: timestamp,
      });
    } else {
      const userSnap = await getDoc(userRef);
      const uData = userSnap.data() as User;
      await setDoc(staffRef, {
        id: effectiveStaffId,
        staffId: effectiveStaffId,
        name: uData?.name || 'Staff Member',
        phone: uData?.phone || '',
        email: uData?.email || '',
        activeArea: activeArea || uData?.area || 'Central Zone',
        todayAssignedDeliveries: 0,
        cashInHand: 0,
        active: true,
        status: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },

  /**
   * Reject a pending staff registration
   */
  rejectStaffRegistration: async (
    userId: string,
    staffId: string,
    reason?: string
  ): Promise<void> => {
    const timestamp = serverTimestamp();
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status: 'REJECTED',
      active: false,
      rejectionReason: reason || 'Application not approved by Administrator',
      updatedAt: timestamp,
    });

    if (staffId) {
      const staffRef = doc(db, 'staff', staffId);
      try {
        await updateDoc(staffRef, {
          active: false,
          status: 'REJECTED',
          updatedAt: timestamp,
        });
      } catch {}
    }
  },

  /**
   * Promote staff to Co-Admin or demote back to Staff
   */
  setStaffRole: async (userId: string, staffId: string, role: UserRole): Promise<void> => {
    const timestamp = serverTimestamp();
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role,
      updatedAt: timestamp,
    });

    if (staffId) {
      const staffRef = doc(db, 'staff', staffId);
      try {
        await updateDoc(staffRef, {
          role,
          updatedAt: timestamp,
        });
      } catch {}
    }
  },
};
