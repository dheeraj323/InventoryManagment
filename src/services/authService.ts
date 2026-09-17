import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole } from '../types';

export const authService = {
  // Listen to Auth State Changes
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
          });
        } else {
          // Default fallback profile if user doc is not yet created
          const defaultUser: User = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email || 'User',
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            role: 'VENDOR',
            active: true,
          };
          callback(defaultUser);
        }
      } catch (error) {
        console.error('Error fetching user profile from Firestore:', error);
        callback(null);
      }
    });
  },

  // Create User Profile in Firestore
  createUserProfile: async (userData: Partial<User> & { uid: string; role: UserRole }): Promise<User> => {
    const userRef = doc(db, 'users', userData.uid);
    const userDoc: User = {
      id: userData.uid,
      uid: userData.uid,
      name: userData.name || 'New User',
      email: userData.email || '',
      phone: userData.phone || '',
      role: userData.role,
      vendorId: userData.vendorId || '',
      staffId: userData.staffId || '',
      active: true,
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

  // Logout User
  logout: async (): Promise<void> => {
    await signOut(auth);
  },
};
