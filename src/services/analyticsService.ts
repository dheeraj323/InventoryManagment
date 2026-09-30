import { getAnalytics } from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

export const analyticsService = {
  /**
   * Log screen view event for active user tracking
   */
  async logScreenView(screenName: string, screenClass?: string): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        const analytics = getAnalytics();
        await analytics.logScreenView({
          screen_name: screenName,
          screen_class: screenClass || screenName,
        });
      }
    } catch (error) {
      console.log('[Analytics] logScreenView error:', error);
    }
  },

  /**
   * Associate active sessions with authenticated user ID
   */
  async setUserId(userId: string | null): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        const analytics = getAnalytics();
        await analytics.setUserId(userId);
      }
    } catch (error) {
      console.log('[Analytics] setUserId error:', error);
    }
  },

  /**
   * Set user role or properties for audience segmentation
   */
  async setUserProperty(name: string, value: string | null): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        const analytics = getAnalytics();
        await analytics.setUserProperty(name, value);
      }
    } catch (error) {
      console.log('[Analytics] setUserProperty error:', error);
    }
  },

  /**
   * Log custom business events (e.g., login, order_placed, payment_recorded)
   */
  async logEvent(eventName: string, params: Record<string, any> = {}): Promise<void> {
    try {
      if (Platform.OS !== 'web') {
        const analytics = getAnalytics();
        await analytics.logEvent(eventName, params);
      }
    } catch (error) {
      console.log(`[Analytics] logEvent (${eventName}) error:`, error);
    }
  },
};
