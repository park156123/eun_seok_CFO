import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import {
  UserInfo,
  Asset,
  OnboardingAsset,
  Debt,
  OnboardingDebt,
  MonthlyLoanPayment,
  IncomeSource,
  IncomeRecord,
  FixedExpenseItem,
  FinancialProductItem,
  BusinessInfo,
  MerchantRule,
  CategoryRule,
  ExclusionRule,
  MonthlySnapshot,
  AssetSnapshot,
  DebtSnapshot,
  MonthlyDebtMovement,
  SettlementData,
  Transaction,
  ActiveCsvSession,
  Goal,
  OnboardingGoal,
  ScheduleEvent,
} from '../types';

export const HOUSEHOLD_ID = 'family_cfo';

/**
 * Recursively removes keys with value `undefined` from objects and arrays
 * to prevent Firestore setDoc/updateDoc error: "Unsupported field value: undefined".
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedFields(item)) as unknown as T;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = removeUndefinedFields(value);
    }
  }
  return result;
}

// ==========================================
// 1. Master Data Model & Service
// ==========================================

export interface MasterData {
  userInfo?: UserInfo;
  assets?: {
    onboardingAssets: OnboardingAsset[];
    mainAssets: Asset[];
  };
  debts?: {
    onboardingDebts: OnboardingDebt[];
    mainDebts: Debt[];
    monthlyLoanPayments?: MonthlyLoanPayment[];
  };
  monthlyIncome?: {
    incomeSources: IncomeSource[];
    incomeRecords?: IncomeRecord[];
    legacyMonthlyTotalIncome?: number;
  };
  fixedExpenses?: FixedExpenseItem[];
  financialProducts?: FinancialProductItem[];
  businessInfo?: BusinessInfo;
  rules?: {
    merchantRules: MerchantRule[];
    categoryRules: CategoryRule[];
    exclusionRules: ExclusionRule[];
  };
  updatedAt?: string;
}

/**
 * Fetches current Master Data (assets, debts, income sources, rules, etc.) from Firestore.
 */
export const fetchMasterFromFirestore = async (): Promise<MasterData | null> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'master', 'current');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as MasterData;
    }
    return null;
  } catch (err) {
    console.warn('Firestore: Master fetch failed', err);
    return null;
  }
};

/**
 * Saves or updates Master Data in Firestore (OWNER only).
 */
export const saveMasterToFirestore = async (data: MasterData): Promise<void> => {
  const docRef = doc(db, 'households', HOUSEHOLD_ID, 'master', 'current');
  const payload = removeUndefinedFields({ ...data, updatedAt: new Date().toISOString() });
  await setDoc(docRef, payload, { merge: true });
};

// ==========================================
// 2. Monthly Snapshot Service
// ==========================================

export interface SnapshotDocData {
  monthKey: string; // YYYY-MM
  monthlySnapshot: MonthlySnapshot;
  assetSnapshots: AssetSnapshot[];
  debtSnapshots: DebtSnapshot[];
  debtMovements: MonthlyDebtMovement[];
  updatedAt: string;
}

/**
 * Fetches a single Monthly Snapshot document by YYYY-MM document ID.
 */
export const fetchSnapshotFromFirestore = async (
  monthKey: string
): Promise<SnapshotDocData | null> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'snapshots', monthKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SnapshotDocData;
    }
    return null;
  } catch (err) {
    console.warn(`Firestore: Snapshot fetch failed for ${monthKey}`, err);
    return null;
  }
};

/**
 * Fetches all Monthly Snapshots from Firestore.
 */
export const fetchAllSnapshotsFromFirestore = async (): Promise<Record<string, SnapshotDocData>> => {
  const results: Record<string, SnapshotDocData> = {};
  try {
    const colRef = collection(db, 'households', HOUSEHOLD_ID, 'snapshots');
    const snap = await getDocs(colRef);
    snap.forEach((docSnap) => {
      if (docSnap.exists()) {
        results[docSnap.id] = docSnap.data() as SnapshotDocData;
      }
    });
  } catch (err) {
    console.warn('Firestore: All Snapshots fetch failed', err);
  }
  return results;
};

/**
 * Saves a Monthly Snapshot to Firestore using YYYY-MM as Document ID to prevent duplicates (OWNER only).
 */
export const saveSnapshotToFirestore = async (
  monthKey: string,
  snapshotData: {
    monthlySnapshot: MonthlySnapshot;
    assetSnapshots: AssetSnapshot[];
    debtSnapshots: DebtSnapshot[];
    debtMovements: MonthlyDebtMovement[];
  }
): Promise<void> => {
  const docRef = doc(db, 'households', HOUSEHOLD_ID, 'snapshots', monthKey);
  const docData: SnapshotDocData = {
    monthKey,
    ...snapshotData,
    updatedAt: new Date().toISOString(),
  };
  const payload = removeUndefinedFields(docData);
  await setDoc(docRef, payload, { merge: true });
};

// ==========================================
// 3. Monthly Settlement Service
// ==========================================

export interface SettlementDocData {
  monthKey: string; // YYYY-MM
  settlementData: SettlementData;
  confirmedAt?: string;
  updatedAt: string;
}

/**
 * Fetches a Monthly Settlement document by YYYY-MM document ID.
 */
export const fetchMonthlySettlementFromFirestore = async (
  monthKey: string
): Promise<SettlementDocData | null> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'monthlySettlements', monthKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SettlementDocData;
    }
    return null;
  } catch (err) {
    console.warn(`Firestore: Monthly Settlement fetch failed for ${monthKey}`, err);
    return null;
  }
};

/**
 * Saves a Monthly Settlement document to Firestore using YYYY-MM as Document ID (OWNER only).
 */
export const saveMonthlySettlementToFirestore = async (
  monthKey: string,
  settlementData: SettlementData,
  confirmedAt?: string
): Promise<void> => {
  const docRef = doc(db, 'households', HOUSEHOLD_ID, 'monthlySettlements', monthKey);
  const data: SettlementDocData = {
    monthKey,
    settlementData,
    confirmedAt,
    updatedAt: new Date().toISOString(),
  };
  const payload = removeUndefinedFields(data);
  await setDoc(docRef, payload, { merge: true });
};

export interface MonthlySettlementRecordDocData {
  monthKey: string; // YYYY-MM
  record?: any;
  updatedAt: string;
  confirmedAt?: string;
  [key: string]: any;
}

/**
 * Fetches all MonthlySettlementRecords from Firestore collection households/family_cfo/monthlySettlements.
 */
export const fetchAllMonthlySettlementRecordsFromFirestore = async (): Promise<Record<string, any>> => {
  try {
    const colRef = collection(db, 'households', HOUSEHOLD_ID, 'monthlySettlements');
    const snap = await getDocs(colRef);
    const results: Record<string, any> = {};
    snap.forEach((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawKey = docSnap.id; // e.g. '2026-04'
        const normKey = rawKey.includes('-') ? rawKey : (rawKey.match(/(\d{4})년\s*(\d{1,2})월/) ? `${rawKey.match(/(\d{4})년\s*(\d{1,2})월/)![1]}-${String(rawKey.match(/(\d{4})년\s*(\d{1,2})월/)![2]).padStart(2, '0')}` : rawKey);
        const record = data.record ? { ...data, ...data.record } : { ...data };
        if (record && (record.month || record.status || record.incomes || record.specialNotes)) {
          results[normKey] = record;
        }
      }
    });
    return results;
  } catch (err) {
    console.warn('Firestore: fetchAllMonthlySettlementRecords failed:', err);
    return {};
  }
};

/**
 * Saves a MonthlySettlementRecord to Firestore under households/family_cfo/monthlySettlements/{monthKey}.
 */
export const saveMonthlySettlementRecordToFirestore = async (
  monthKey: string,
  record: any
): Promise<void> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'monthlySettlements', monthKey);
    const data: MonthlySettlementRecordDocData = {
      monthKey,
      ...record,
      record,
      updatedAt: new Date().toISOString(),
      confirmedAt: record.completedAtDate ? `${record.completedAtDate} ${record.completedAtTime || ''}`.trim() : undefined,
    };
    const payload = removeUndefinedFields(data);
    await setDoc(docRef, payload, { merge: true });
    console.log(`Firestore: Saved monthlySettlements/${monthKey} successfully.`);
  } catch (err) {
    console.error(`Firestore: Failed to save monthlySettlements/${monthKey}:`, err);
  }
};

/**
 * Safely updates specialNotes and noteConfirmedAt for a MonthlySettlement document in Firestore
 * without overwriting or resetting any financial numbers.
 */
export const saveSpecialNotesToFirestore = async (
  monthKey: string,
  specialNotes: string,
  noteConfirmedAt: string
): Promise<void> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'monthlySettlements', monthKey);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const existingRecord = data.record || {};
      const updatedRecord = {
        ...existingRecord,
        specialNotes,
        noteConfirmedAt,
      };
      const payload = removeUndefinedFields({
        ...data,
        specialNotes,
        noteConfirmedAt,
        record: updatedRecord,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(docRef, payload, { merge: true });
    } else {
      const payload = removeUndefinedFields({
        monthKey,
        specialNotes,
        noteConfirmedAt,
        record: {
          monthKey,
          specialNotes,
          noteConfirmedAt,
        },
        updatedAt: new Date().toISOString(),
      });
      await setDoc(docRef, payload, { merge: true });
    }
    console.log(`Firestore: Saved specialNotes for monthlySettlements/${monthKey} successfully.`);
  } catch (err) {
    console.error(`Firestore: Failed to save specialNotes for monthlySettlements/${monthKey}:`, err);
    throw err;
  }
};

/**
 * Safely backfills real browser localStorage MonthlySettlementRecords (e.g. 2026-04) to Firestore
 * if Firestore does not have them yet.
 */
export const backfillLocalMonthlySettlementsToFirestore = async (
  firestoreRecordsMap: Record<string, any>
): Promise<void> => {
  try {
    if (typeof localStorage === 'undefined') return;
    const localSaved = localStorage.getItem('cfo_monthly_records_v3');
    if (!localSaved) return;

    const localMap = JSON.parse(localSaved);
    for (const [key, record] of Object.entries(localMap)) {
      if (!record || typeof record !== 'object') continue;
      const rec = record as any;
      if (rec.status === '완료' || rec.status === '결산잠금' || rec.status === '진행중') {
        let normKey = key;
        if (rec.month) {
          const match = rec.month.match(/(\d{4})년\s*(\d{1,2})월/);
          if (match) {
            normKey = `${match[1]}-${String(match[2]).padStart(2, '0')}`;
          }
        }
        if (/^\d{4}-\d{2}$/.test(normKey)) {
          const fsRecord = firestoreRecordsMap[normKey];
          if (!fsRecord || (fsRecord.status !== rec.status && rec.status === '결산잠금')) {
            console.log(`Firestore Backfill: Uploading local MonthlySettlementRecord for ${normKey} to Firestore...`);
            await saveMonthlySettlementRecordToFirestore(normKey, rec);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Firestore Backfill for MonthlySettlements warning:', err);
  }
};

// ==========================================
// 4. Ledger (Transactions) Service
// ==========================================

export interface LedgerDocData {
  transactions: Transaction[];
  activeCsvSession?: ActiveCsvSession;
  updatedAt: string;
}

/**
 * Fetches current Ledger data (transactions) from Firestore.
 */
export const fetchLedgerFromFirestore = async (): Promise<LedgerDocData | null> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'ledger', 'current');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as LedgerDocData;
    }
    return null;
  } catch (err) {
    console.warn('Firestore: Ledger fetch failed', err);
    return null;
  }
};

/**
 * Saves Ledger data to Firestore (OWNER only).
 */
export const saveLedgerToFirestore = async (ledgerData: {
  transactions: Transaction[];
  activeCsvSession?: ActiveCsvSession;
}): Promise<void> => {
  const docRef = doc(db, 'households', HOUSEHOLD_ID, 'ledger', 'current');
  const payload = removeUndefinedFields({ ...ledgerData, updatedAt: new Date().toISOString() });
  await setDoc(docRef, payload, { merge: true });
};

// ==========================================
// 5. Planner (Goals & Schedules) Service
// ==========================================

export interface PlannerDocData {
  goals: Goal[];
  onboardingGoals: OnboardingGoal[];
  schedules: ScheduleEvent[];
  updatedAt: string;
}

/**
 * Fetches Planner data (goals and schedules) from Firestore.
 */
export const fetchPlannerFromFirestore = async (): Promise<PlannerDocData | null> => {
  try {
    const docRef = doc(db, 'households', HOUSEHOLD_ID, 'planner', 'current');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as PlannerDocData;
    }
    return null;
  } catch (err) {
    console.warn('Firestore: Planner fetch failed', err);
    return null;
  }
};

/**
 * Saves Planner data to Firestore (OWNER only).
 */
export const savePlannerToFirestore = async (plannerData: {
  goals: Goal[];
  onboardingGoals: OnboardingGoal[];
  schedules: ScheduleEvent[];
}): Promise<void> => {
  const docRef = doc(db, 'households', HOUSEHOLD_ID, 'planner', 'current');
  const payload = removeUndefinedFields({ ...plannerData, updatedAt: new Date().toISOString() });
  await setDoc(docRef, payload, { merge: true });
};

// ==========================================
// 6. Integrated Full AppData Writer & Test Helpers
// ==========================================

import { AppData } from '../types';

/**
 * Saves complete AppData to Firestore documents (Master, Ledger, Planner, MonthlySettlement, Snapshot).
 * OWNER ONLY.
 */
export const saveAllToFirestoreFromAppData = async (appData: AppData): Promise<void> => {
  // 1. Master
  const masterData: MasterData = {
    userInfo: appData.userInfo,
    assets: appData.assets,
    debts: appData.debts,
    monthlyIncome: appData.monthlyIncome,
    fixedExpenses: appData.fixedExpenses,
    financialProducts: appData.financialProducts,
    businessInfo: appData.businessInfo,
    rules: appData.rules,
  };
  await saveMasterToFirestore(masterData);

  // 2. Ledger
  const ledgerData = {
    transactions: appData.otherSettings?.transactions || [],
    activeCsvSession: appData.otherSettings?.activeCsvSession,
  };
  await saveLedgerToFirestore(ledgerData);

  // 3. Planner
  const plannerData = {
    goals: appData.goals?.mainGoals || [],
    onboardingGoals: appData.goals?.onboardingGoals || [],
    schedules: appData.otherSettings?.schedules || [],
  };
  await savePlannerToFirestore(plannerData);

  // 4. Monthly Settlement for 2026-04 if present
  if (appData.otherSettings?.settlementData) {
    await saveMonthlySettlementToFirestore('2026-04', appData.otherSettings.settlementData);
  }
};

/**
 * Safe OWNER WRITE Test (Does NOT modify 2026-04 actual data).
 * Uses a dedicated test document: `households/family_cfo/test_space/owner_write_test`.
 */
export const runOwnerWriteTestAndVerify = async (
  userEmail: string
): Promise<{ success: boolean; message: string; writtenValue?: any; readValue?: any }> => {
  try {
    const testDocRef = doc(db, 'households', HOUSEHOLD_ID, 'test_space', 'owner_write_test');
    const testPayload = {
      testId: `test-${Date.now()}`,
      testedBy: userEmail,
      timestamp: new Date().toISOString(),
      status: 'OWNER_WRITE_SUCCESS',
      sampleValue: Math.floor(Math.random() * 1000000),
    };

    // 1. Write
    await setDoc(testDocRef, testPayload, { merge: true });

    // 2. Read back & verify
    const snap = await getDoc(testDocRef);
    if (snap.exists() && snap.data()?.testId === testPayload.testId) {
      return {
        success: true,
        message: 'OWNER 계정의 Firestore WRITE 및 즉시 재조회(1:1 일치) 성공!',
        writtenValue: testPayload,
        readValue: snap.data(),
      };
    } else {
      return {
        success: false,
        message: 'OWNER WRITE는 에러 없이 실행되었으나, 재조회 데이터가 일치하지 않습니다.',
        writtenValue: testPayload,
        readValue: snap.data(),
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `OWNER WRITE 실패: ${err?.message || '알 수 없는 오류'}`,
    };
  }
};

/**
 * VIEWER WRITE Block Test.
 * Attempts to write to `households/family_cfo/test_space/viewer_write_test` with VIEWER account.
 * Expects a Firebase Security Rule denial or client permission block.
 */
export const attemptViewerWriteAndVerify = async (
  userEmail: string
): Promise<{ blocked: boolean; message: string; errorCode?: string }> => {
  try {
    const testDocRef = doc(db, 'households', HOUSEHOLD_ID, 'test_space', 'viewer_write_test');
    const testPayload = {
      attemptedBy: userEmail,
      timestamp: new Date().toISOString(),
      shouldFail: true,
    };

    await setDoc(testDocRef, testPayload);
    // If it succeeds, write was NOT blocked!
    return {
      blocked: false,
      message: '경고: VIEWER 계정의 WRITE가 차단되지 않고 성공했습니다! Security Rules를 점검하세요.',
    };
  } catch (err: any) {
    const isPermissionError =
      err?.code === 'permission-denied' ||
      err?.message?.includes('permission') ||
      err?.message?.includes('Permission');

    return {
      blocked: true,
      message: isPermissionError
        ? 'VIEWER WRITE 정상 차단 완료 (Firebase Security Rules: permission-denied)'
        : `VIEWER WRITE 차단됨: ${err?.message || '권한 오류'}`,
      errorCode: err?.code,
    };
  }
};

