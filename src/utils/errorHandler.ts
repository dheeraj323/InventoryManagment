/**
 * Production-ready User-Friendly Error Formatting Utility
 * Translates raw technical errors (Firebase Auth, Firestore, Network, Cloudinary)
 * into clear, actionable, and secure messages for end users.
 */

export function getFriendlyErrorMessage(error: any, defaultFallback: string = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return defaultFallback;

  // 1. Check for specific error code / string
  const code = (error?.code || '').toLowerCase();
  const rawMessage = (error?.message || (typeof error === 'string' ? error : '')).toLowerCase();

  // ── Firebase Auth Errors ──────────────────────────────────────────
  if (
    code === 'auth/network-request-failed' ||
    rawMessage.includes('auth/network-request-failed') ||
    rawMessage.includes('network-request-failed')
  ) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    rawMessage.includes('auth/invalid-credential') ||
    rawMessage.includes('auth/wrong-password') ||
    rawMessage.includes('auth/user-not-found')
  ) {
    return 'Invalid email/username or password. Please check your credentials.';
  }

  if (code === 'auth/invalid-email' || rawMessage.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }

  if (code === 'auth/user-disabled' || rawMessage.includes('auth/user-disabled')) {
    return 'This account has been disabled. Please contact support.';
  }

  if (code === 'auth/too-many-requests' || rawMessage.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }

  if (code === 'auth/email-already-in-use' || rawMessage.includes('auth/email-already-in-use')) {
    return 'This email address is already registered. Please sign in instead.';
  }

  if (code === 'auth/weak-password' || rawMessage.includes('auth/weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }

  if (code === 'auth/requires-recent-login' || rawMessage.includes('auth/requires-recent-login')) {
    return 'This action requires recent authentication. Please sign in again.';
  }

  // ── Network / Connection / Firestore Errors ───────────────────────
  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    rawMessage.includes('network request failed') ||
    rawMessage.includes('network-error') ||
    rawMessage.includes('failed to fetch') ||
    rawMessage.includes('offline') ||
    rawMessage.includes('timeout')
  ) {
    return 'Network connection issue. Please check your internet connection and try again.';
  }

  if (code === 'permission-denied' || rawMessage.includes('permission-denied')) {
    return 'You do not have permission to perform this action.';
  }

  if (code === 'resource-exhausted' || rawMessage.includes('quota') || rawMessage.includes('resource-exhausted')) {
    return 'Server is busy right now. Please try again shortly.';
  }

  if (code === 'not-found' || rawMessage.includes('not-found')) {
    return 'The requested record could not be found.';
  }

  if (code === 'already-exists' || rawMessage.includes('already-exists')) {
    return 'A record with these details already exists.';
  }

  // ── Cloudinary / Upload Errors ────────────────────────────────────
  if (rawMessage.includes('cloudinary') || rawMessage.includes('upload') || rawMessage.includes('storage')) {
    return 'Failed to upload attachment. Please check your connection and try again.';
  }

  // ── Clean up generic raw Firebase / Exception strings ─────────────
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    const msg = error.message;
    // Strip raw Firebase wrappers like "Firebase: Error (auth/...)."
    if (msg.startsWith('Firebase:') || msg.startsWith('FirebaseError:') || msg.includes('(auth/')) {
      return 'Authentication failed. Please verify your details and internet connection.';
    }
    return msg;
  }

  return defaultFallback;
}
