import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

// Default allowed email list: includes primary user email
// Additional spouse/family emails can be configured via VITE_ALLOWED_EMAILS environment variable (comma separated)
const envAllowedEmails = import.meta.env.VITE_ALLOWED_EMAILS
  ? import.meta.env.VITE_ALLOWED_EMAILS.split(',').map((e: string) => e.trim().toLowerCase())
  : [];

export const ALLOWED_EMAILS: string[] = Array.from(
  new Set(['park156123@gmail.com', 'mymym4032@gmail.com', ...envAllowedEmails])
);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Initiates Google Sign-In with Popup
 */
export const signInWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

/**
 * Signs out current user
 */
export const logOut = async (): Promise<void> => {
  await signOut(auth);
};

/**
 * Checks if the given email is in the allowed family accounts list
 */
export const isEmailAllowed = (email?: string | null): boolean => {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase());
};

/**
 * Subscribes to Firebase Authentication state changes
 */
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
