import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppNotification } from '../types';

const NOTIFICATIONS_COLLECTION = 'notifications';

export const notificationService = {
  getNotifications: async (): Promise<AppNotification[]> => {
    try {
      const q = query(collection(db, NOTIFICATIONS_COLLECTION), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        notificationId: docSnap.id,
        ...docSnap.data(),
      })) as AppNotification[];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  subscribeNotifications: (callback: (notifications: AppNotification[]) => void) => {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        notificationId: docSnap.id,
        ...docSnap.data(),
      })) as AppNotification[];
      callback(notifications);
    }, (error) => {
      console.error('Notifications subscription error:', error);
    });
  },

  markAsRead: async (notificationId: string): Promise<void> => {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(docRef, {
      read: true,
      updatedAt: serverTimestamp(),
    });
  },

  addNotification: async (notificationData: Partial<AppNotification>): Promise<AppNotification> => {
    const docRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
    const newNotif: AppNotification = {
      id: docRef.id,
      notificationId: docRef.id,
      title: notificationData.title || 'Notification',
      message: notificationData.message || '',
      timestamp: new Date().toISOString(),
      read: false,
      targetRole: notificationData.targetRole || 'ADMIN',
      targetUserId: notificationData.targetUserId || '',
      type: notificationData.type || 'ORDER',
      createdAt: new Date().toISOString(),
    };

    await setDoc(docRef, {
      ...newNotif,
      createdAt: serverTimestamp(),
    });

    return newNotif;
  },
};
