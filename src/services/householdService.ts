import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ALLOWED_EMAILS } from './authService';

export type UserRole = 'owner' | 'viewer' | 'unauthorized';

export const PRIMARY_OWNER_EMAIL = 'park156123@gmail.com';
export const HOUSEHOLD_ID = 'family_cfo';

export interface HouseholdMember {
  email: string;
  role: 'owner' | 'viewer';
  addedAt?: string;
}

export interface HouseholdMetadata {
  id: string;
  name: string;
  ownerEmail: string;
  allowedEmails: string[];
  members: HouseholdMember[];
  updatedAt: string;
}

/**
 * Determines the role of a user based on their email.
 */
export const getUserRole = (email?: string | null): UserRole => {
  if (!email) return 'unauthorized';
  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === PRIMARY_OWNER_EMAIL.toLowerCase()) {
    return 'owner';
  }

  if (ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(cleanEmail)) {
    return 'viewer';
  }

  return 'unauthorized';
};

/**
 * Retrieves the Household metadata document from Firestore.
 */
export const fetchHouseholdMetadata = async (): Promise<HouseholdMetadata | null> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as HouseholdMetadata;
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch household metadata from Firestore:', err);
    return null;
  }
};

/**
 * Initializes or updates the Household metadata document in Firestore IF the logged-in user is OWNER.
 * NOTE: Does NOT write any financial, snapshot, or ledger data.
 */
export const ensureHouseholdDocExists = async (userEmail: string): Promise<void> => {
  const role = getUserRole(userEmail);
  if (role !== 'owner') {
    // VIEWER or unauthorized users should not write household metadata
    return;
  }

  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID);
    const snap = await getDoc(docRef);

    const members: HouseholdMember[] = ALLOWED_EMAILS.map((email) => ({
      email: email.toLowerCase(),
      role: email.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase() ? 'owner' : 'viewer',
      addedAt: new Date().toISOString(),
    }));

    const metadata: HouseholdMetadata = {
      id: HOUSEHOLD_ID,
      name: '우리집 CFO',
      ownerEmail: PRIMARY_OWNER_EMAIL,
      allowedEmails: ALLOWED_EMAILS.map((e) => e.toLowerCase()),
      members,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, metadata, { merge: true });
  } catch (err) {
    console.warn('Failed to initialize household metadata in Firestore:', err);
  }
};
