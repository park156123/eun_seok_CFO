import {
  MonthlySnapshot,
  AssetSnapshot,
  DebtSnapshot,
  MonthlyDebtMovement,
  Asset,
  Debt,
} from '../types';
import { GlobalMockDataStore } from './dataStore';

const STORAGE_KEY = 'cfo_monthly_snapshots_v1';

export type SnapshotStatusPriority = 'confirmed' | 'draft' | 'none';

export interface SnapshotStoreState {
  monthlySnapshots: Record<string, MonthlySnapshot>; // monthKey -> MonthlySnapshot
  assetSnapshots: Record<string, AssetSnapshot[]>; // monthKey -> AssetSnapshot[]
  debtSnapshots: Record<string, DebtSnapshot[]>; // monthKey -> DebtSnapshot[]
  debtMovements: Record<string, MonthlyDebtMovement[]>; // monthKey -> MonthlyDebtMovement[]
}

type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeSnapshots = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach((fn) => fn());
};

/**
 * Normalizes any month input (e.g., '2026년 4월', { year: 2026, month: 4 }, '2026-04')
 * to standard string 'YYYY-MM' (e.g. '2026-04').
 */
export const normalizeMonthKey = (
  monthInput: string | { year: number; month: number } | null | undefined
): string => {
  if (!monthInput) return '2026-04';
  if (typeof monthInput === 'object') {
    const y = monthInput.year;
    const m = String(monthInput.month).padStart(2, '0');
    return `${y}-${m}`;
  }

  const str = String(monthInput).trim();
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }

  const match = str.match(/(\d{4})[^\d\s]*\s*(\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = String(parseInt(match[2], 10)).padStart(2, '0');
    return `${y}-${m}`;
  }

  return '2026-04';
};

/**
 * Formats 'YYYY-MM' to Korean string 'YYYY년 M월'
 */
export const formatMonthKorean = (monthKey: string): string => {
  const norm = normalizeMonthKey(monthKey);
  const parts = norm.split('-');
  if (parts.length === 2) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    return `${y}년 ${m}월`;
  }
  return monthKey;
};

export function getPreviousMonthKey(monthKey: string): string {
  const norm = normalizeMonthKey(monthKey);
  const parts = norm.split('-');
  let y = parseInt(parts[0], 10) || 2026;
  let m = parseInt(parts[1], 10) || 4;
  if (m === 1) {
    y -= 1;
    m = 12;
  } else {
    m -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const normalizeDebtName = (s?: string | null) =>
  s ? String(s).replace(/^\[|\]$/g, '').replace(/\s+/g, ' ').trim().toLowerCase() : '';

export const parsePaymentDay = (val: any): number | undefined => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const str = String(val).replace(/[^0-9]/g, '');
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? undefined : parsed;
};

export function getAllMasterDebts(customMasterDebts?: any): any[] {
  const debtsData = customMasterDebts || GlobalMockDataStore.getDebts();
  if (Array.isArray(debtsData)) {
    return debtsData;
  }
  if (!debtsData) return [];
  const ob = Array.isArray((debtsData as any).onboardingDebts) ? (debtsData as any).onboardingDebts : [];
  const main = Array.isArray((debtsData as any).mainDebts) ? (debtsData as any).mainDebts : [];
  if (ob.length > 0 && main.length > 0) {
    const obIds = new Set(ob.map((x: any) => x.id));
    return [...ob, ...main.filter((x: any) => !obIds.has(x.id))];
  } else if (ob.length > 0) {
    return ob;
  } else {
    return main;
  }
}

export function findMatchingMasterDebt(snapshotDebt: any, masterDebts: any[]): any | undefined {
  const dNameNorm = normalizeDebtName(snapshotDebt.debtNameSnapshot || snapshotDebt.name || snapshotDebt.debtName);
  return masterDebts.find((m: any) => {
    if (snapshotDebt.linkedDebtId && m.id === snapshotDebt.linkedDebtId) return true;
    if (snapshotDebt.debtId && m.id === snapshotDebt.debtId) return true;
    if (snapshotDebt.id && m.id === snapshotDebt.id) return true;
    const mNameNorm = normalizeDebtName(m.debtName || m.name);
    return (
      dNameNorm &&
      mNameNorm &&
      (dNameNorm === mNameNorm || dNameNorm.includes(mNameNorm) || mNameNorm.includes(dNameNorm))
    );
  });
}

export const enrichDebtSnapshot = (d: DebtSnapshot): DebtSnapshot => {
  const masters = getAllMasterDebts();
  const master = findMatchingMasterDebt(d, masters);

  const masterRate =
    master?.interestRate !== undefined && master?.interestRate !== null
      ? Number(master.interestRate)
      : master?.annualRate !== undefined && master?.annualRate !== null
      ? Number(master.annualRate)
      : master?.rate !== undefined && master?.rate !== null
      ? Number(master.rate)
      : master?.currentRate !== undefined && master?.currentRate !== null
      ? Number(master.currentRate)
      : undefined;

  const snapshotRate = d.interestRate !== undefined && d.interestRate !== null ? Number(d.interestRate) : undefined;
  const interestRate = snapshotRate !== undefined ? snapshotRate : masterRate;

  const masterRepayment =
    master?.repaymentMethod ||
    master?.repaymentType ||
    master?.paymentType ||
    master?.rateType ||
    master?.amortizationType ||
    master?.method;

  const repaymentMethod =
    d.repaymentMethod ||
    d.debtTypeSnapshot ||
    masterRepayment ||
    undefined;

  const masterDay = master
    ? parsePaymentDay(
        master.paymentDay ??
          master.dueDay ??
          master.monthlyPaymentDay ??
          master.interestPaymentDay ??
          master.repaymentDay ??
          master.nextDueDate
      )
    : undefined;

  const snapshotDay = parsePaymentDay(d.paymentDay);
  const paymentDay = snapshotDay !== undefined ? snapshotDay : masterDay;

  const masterCreditor = master?.creditorName || master?.creditor || master?.lender;
  const creditorNameSnapshot = d.creditorNameSnapshot || masterCreditor || undefined;

  return {
    ...d,
    interestRate,
    repaymentMethod: repaymentMethod || d.repaymentMethod,
    paymentDay: paymentDay !== undefined ? paymentDay : d.paymentDay,
    creditorNameSnapshot: creditorNameSnapshot || d.creditorNameSnapshot,
  };
};

// TEMP RECOVERY / FALLBACK ONLY - Firestore is Primary SSOT
// Official 2026-04 & 2026-05 confirmed snapshot defaults (Used ONLY as initial offline/recovery fallback when Firestore is unavailable)
const OFFICIAL_2026_04_ASSETS: AssetSnapshot[] = [
  {
    id: 'ass-snap-2026-04-1',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    assetId: 'ast-1',
    assetNameSnapshot: '금강',
    assetTypeSnapshot: '부동산',
    category: '부동산',
    value: 950000000,
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'ass-snap-2026-04-2',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    assetId: 'ast-2',
    assetNameSnapshot: '현하우스',
    assetTypeSnapshot: '부동산',
    category: '부동산',
    value: 2000000000,
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'ass-snap-2026-04-3',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    assetId: 'ast-3',
    assetNameSnapshot: '은석리더스',
    assetTypeSnapshot: '부동산',
    category: '부동산',
    value: 1100000000,
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'ass-snap-2026-04-4',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    assetId: 'ast-4',
    assetNameSnapshot: '테스트',
    assetTypeSnapshot: '기타자산',
    category: '기타자산',
    value: 100000000,
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

const OFFICIAL_2026_05_ASSETS: AssetSnapshot[] = OFFICIAL_2026_04_ASSETS.map((a, idx) => ({
  ...a,
  id: `ass-snap-2026-05-${idx + 1}`,
  monthlySnapshotId: 'opening-2026-05',
  month: '2026-05',
}));

const OFFICIAL_2026_04_DEBTS: DebtSnapshot[] = [
  {
    id: 'dbt-snap-2026-04-1',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785069521240',
    linkedDebtId: 'dbt-1785069521240',
    debtNameSnapshot: '현하우스',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 787500000,
    endingPrincipal: 787500000,
    debtBalanceSnapshot: 787500000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 2821875,
    interestRate: 4.3,
    repaymentMethod: '만기일시상환',
    paymentDay: 20,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-2',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785071872327',
    linkedDebtId: 'dbt-1785071872327',
    debtNameSnapshot: '금강 담보대출',
    debtTypeSnapshot: '원금균등',
    creditorNameSnapshot: '농협은행',
    openingPrincipal: 401520000,
    endingPrincipal: 401520000,
    debtBalanceSnapshot: 401520000,
    scheduledPrincipalRepayment: 1330000,
    actualPrincipalRepayment: 1330000,
    additionalBorrowing: 0,
    interestExpense: 1415358,
    interestRate: 4.23,
    repaymentMethod: '원금균등',
    paymentDay: 2,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-3',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785072013230',
    linkedDebtId: 'dbt-1785072013230',
    debtNameSnapshot: '은석리더스',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 660000000,
    endingPrincipal: 660000000,
    debtBalanceSnapshot: 660000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 2205500,
    interestRate: 4.01,
    repaymentMethod: '만기일시상환',
    paymentDay: 5,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-4',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785072154485',
    linkedDebtId: 'dbt-1785072154485',
    debtNameSnapshot: '개인_마통',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 25000000,
    endingPrincipal: 25000000,
    debtBalanceSnapshot: 25000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 124167,
    interestRate: 5.96,
    repaymentMethod: '만기일시상환',
    paymentDay: 26,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-5',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785072248492',
    linkedDebtId: 'dbt-1785072248492',
    debtNameSnapshot: '플라워1',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 100000000,
    endingPrincipal: 100000000,
    debtBalanceSnapshot: 100000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 370833,
    interestRate: 4.45,
    repaymentMethod: '만기일시상환',
    paymentDay: 20,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-6',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785072439934',
    linkedDebtId: 'dbt-1785072439934',
    debtNameSnapshot: '플라워2',
    debtTypeSnapshot: '원금균등',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 100000000,
    endingPrincipal: 100000000,
    debtBalanceSnapshot: 100000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 308333,
    interestRate: 3.7,
    repaymentMethod: '원금균등',
    paymentDay: 21,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-7',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785073006194',
    linkedDebtId: 'dbt-1785073006194',
    debtNameSnapshot: '본점1',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 100000000,
    endingPrincipal: 100000000,
    debtBalanceSnapshot: 100000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 401667,
    interestRate: 4.82,
    repaymentMethod: '만기일시상환',
    paymentDay: 25,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-8',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785073058778',
    linkedDebtId: 'dbt-1785073058778',
    debtNameSnapshot: '본점2',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 140000000,
    endingPrincipal: 140000000,
    debtBalanceSnapshot: 140000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 591500,
    interestRate: 5.07,
    repaymentMethod: '만기일시상환',
    paymentDay: 25,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-9',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785073164714',
    linkedDebtId: 'dbt-1785073164714',
    debtNameSnapshot: '본점3',
    debtTypeSnapshot: '원금균등',
    creditorNameSnapshot: '국민은행',
    openingPrincipal: 80000000,
    endingPrincipal: 80000000,
    debtBalanceSnapshot: 80000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 232000,
    interestRate: 3.48,
    repaymentMethod: '원금균등',
    paymentDay: 25,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-10',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785073298651',
    linkedDebtId: 'dbt-1785073298651',
    debtNameSnapshot: '광주엄니',
    debtTypeSnapshot: '원금균등',
    creditorNameSnapshot: '광주엄니',
    openingPrincipal: 40000000,
    endingPrincipal: 40000000,
    debtBalanceSnapshot: 40000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 0,
    interestRate: 0,
    repaymentMethod: '원금균등',
    paymentDay: 1,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-11',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-1785073707662',
    linkedDebtId: 'dbt-1785073707662',
    debtNameSnapshot: '큰이모',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '큰이모',
    openingPrincipal: 60000000,
    endingPrincipal: 60000000,
    debtBalanceSnapshot: 60000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 0,
    interestRate: 0,
    repaymentMethod: '만기일시상환',
    paymentDay: 25,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-12',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-12',
    linkedDebtId: 'dbt-12',
    debtNameSnapshot: '재호',
    debtTypeSnapshot: '개인차입금',
    creditorNameSnapshot: '재호',
    openingPrincipal: 15000000,
    endingPrincipal: 15000000,
    debtBalanceSnapshot: 15000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 0,
    interestRate: 0,
    repaymentMethod: '개인차입금',
    paymentDay: 1,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dbt-snap-2026-04-13',
    monthlySnapshotId: 'opening-2026-04',
    month: '2026-04',
    debtId: 'dbt-13',
    linkedDebtId: 'dbt-13',
    debtNameSnapshot: '테스트 부채',
    debtTypeSnapshot: '만기일시상환',
    creditorNameSnapshot: '테스트',
    openingPrincipal: 1000000,
    endingPrincipal: 1000000,
    debtBalanceSnapshot: 1000000,
    scheduledPrincipalRepayment: 0,
    actualPrincipalRepayment: 0,
    additionalBorrowing: 0,
    interestExpense: 0,
    interestRate: 0,
    repaymentMethod: '만기일시상환',
    paymentDay: 1,
    statusAtMonthEnd: 'active',
    source: 'user-input',
    isHistoricalOnly: false,
    isIncluded: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

const OFFICIAL_2026_05_DEBTS: DebtSnapshot[] = OFFICIAL_2026_04_DEBTS.map((d, idx) => ({
  ...d,
  id: `dbt-snap-2026-05-${idx + 1}`,
  monthlySnapshotId: 'opening-2026-05',
  month: '2026-05',
}));

// Initial state loader
const loadSnapshotStore = (): SnapshotStoreState => {
  const buildOfficialDefaultStore = (): SnapshotStoreState => ({
    monthlySnapshots: {
      '2026-04': {
        id: 'opening-2026-04',
        month: '2026-04',
        status: 'confirmed',
        source: 'user-input',
        referenceDate: '2026-04-01',
        totalAssets: 4150000000,
        totalDebts: 2510020000,
        netWorth: 1639980000,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        confirmedAt: '2026-04-01T00:00:00.000Z',
        assetSnapshotIds: OFFICIAL_2026_04_ASSETS.map((a) => a.id),
        debtSnapshotIds: OFFICIAL_2026_04_DEBTS.map((d) => d.id),
      },
      '2026-05': {
        id: 'opening-2026-05',
        month: '2026-05',
        status: 'confirmed',
        source: 'user-input',
        referenceDate: '2026-05-01',
        totalAssets: 4150000000,
        totalDebts: 2510020000,
        netWorth: 1639980000,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        confirmedAt: '2026-04-01T00:00:00.000Z',
        assetSnapshotIds: OFFICIAL_2026_05_ASSETS.map((a) => a.id),
        debtSnapshotIds: OFFICIAL_2026_05_DEBTS.map((d) => d.id),
      },
    },
    assetSnapshots: {
      '2026-04': [...OFFICIAL_2026_04_ASSETS],
      '2026-05': [...OFFICIAL_2026_05_ASSETS],
    },
    debtSnapshots: {
      '2026-04': [...OFFICIAL_2026_04_DEBTS],
      '2026-05': [...OFFICIAL_2026_05_DEBTS],
    },
    debtMovements: {},
  });

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.monthlySnapshots && Object.keys(parsed.monthlySnapshots).length > 0) {
        // Sanitize test snapshots for 2026-06 if unconfirmed
        if (parsed.monthlySnapshots['2026-06'] && parsed.monthlySnapshots['2026-06'].status === 'draft') {
          delete parsed.monthlySnapshots['2026-06'];
          if (parsed.assetSnapshots) delete parsed.assetSnapshots['2026-06'];
          if (parsed.debtSnapshots) delete parsed.debtSnapshots['2026-06'];
          if (parsed.debtMovements) delete parsed.debtMovements['2026-06'];
        }

        // Check if 2026-04 has outdated dummy seed data (e.g., '미용실 본점')
        const current04Assets = parsed.assetSnapshots?.['2026-04'] || [];
        const hasLegacyDummy = current04Assets.some((a: any) =>
          a.assetNameSnapshot === '미용실 본점' || a.assetNameSnapshot === '주식/펀드 (삼성전자)' || a.assetNameSnapshot === '비상금 통장' || a.assetNameSnapshot === '금강아파트'
        ) || !current04Assets.some((a: any) => a.assetNameSnapshot === '은석리더스');

        if (!parsed.monthlySnapshots['2026-04'] || (hasLegacyDummy && !parsed.monthlySnapshots['2026-04']?.confirmedAt)) {
          console.log('[SnapshotService] Outdated or missing 2026-04 snapshot detected. Initializing 2026-04 defaults.');
          parsed.monthlySnapshots['2026-04'] = {
            id: 'opening-2026-04',
            month: '2026-04',
            status: 'confirmed',
            source: 'user-input',
            referenceDate: '2026-04-01',
            totalAssets: 4150000000,
            totalDebts: 2510020000,
            netWorth: 1639980000,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
            confirmedAt: '2026-04-01T00:00:00.000Z',
            assetSnapshotIds: OFFICIAL_2026_04_ASSETS.map((a) => a.id),
            debtSnapshotIds: OFFICIAL_2026_04_DEBTS.map((d) => d.id),
          };
          if (!parsed.assetSnapshots) parsed.assetSnapshots = {};
          if (!parsed.debtSnapshots) parsed.debtSnapshots = {};
          parsed.assetSnapshots['2026-04'] = [...OFFICIAL_2026_04_ASSETS];
          parsed.debtSnapshots['2026-04'] = [...OFFICIAL_2026_04_DEBTS];
        }

        if (!parsed.monthlySnapshots['2026-05']) {
          console.log('[SnapshotService] Missing 2026-05 snapshot detected. Initializing 2026-05 defaults.');
          parsed.monthlySnapshots['2026-05'] = {
            id: 'opening-2026-05',
            month: '2026-05',
            status: 'confirmed',
            source: 'user-input',
            referenceDate: '2026-05-01',
            totalAssets: 4150000000,
            totalDebts: 2510020000,
            netWorth: 1639980000,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
            confirmedAt: '2026-04-01T00:00:00.000Z',
            assetSnapshotIds: OFFICIAL_2026_05_ASSETS.map((a) => a.id),
            debtSnapshotIds: OFFICIAL_2026_05_DEBTS.map((d) => d.id),
          };

          if (!parsed.assetSnapshots) parsed.assetSnapshots = {};
          if (!parsed.debtSnapshots) parsed.debtSnapshots = {};
          parsed.assetSnapshots['2026-05'] = [...OFFICIAL_2026_05_ASSETS];
          parsed.debtSnapshots['2026-05'] = [...OFFICIAL_2026_05_DEBTS];
        }

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {
          console.error(e);
        }
        return {
          monthlySnapshots: parsed.monthlySnapshots || {},
          assetSnapshots: parsed.assetSnapshots || {},
          debtSnapshots: parsed.debtSnapshots || {},
          debtMovements: parsed.debtMovements || {},
        };
      }
    }
  } catch (e) {
    console.error('Failed to load snapshot store from localStorage', e);
  }

  const defaultStore = buildOfficialDefaultStore();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStore));
  } catch (e) {
    console.error(e);
  }
  return defaultStore;
};

// State in memory
let state: SnapshotStoreState = loadSnapshotStore();

const saveSnapshotStore = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save snapshot store to localStorage', e);
  }
  notifyListeners();
};

const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

/**
 * Snapshot Repository & Service Layer
 */
export const SnapshotService = {
  reloadFromLocalStorage: () => {
    state = loadSnapshotStore();
  },
  /**
   * Prepares and validates a draft opening snapshot payload without persisting to DataStore/localStorage.
   */
  prepareOpeningSnapshotDraft(payload: {
    month: string;
    baseDate: string;
    assets: Array<{
      id?: string;
      linkedAssetId?: string | null;
      name?: string;
      assetNameSnapshot?: string;
      category?: string;
      subType?: string;
      assetTypeSnapshot?: string;
      value?: number;
      memo?: string;
      isIncluded?: boolean;
      isCustom?: boolean;
    }>;
    debts: Array<{
      id?: string;
      linkedDebtId?: string | null;
      name?: string;
      debtNameSnapshot?: string;
      creditor?: string;
      creditorNameSnapshot?: string;
      debtTypeSnapshot?: string;
      openingPrincipal?: number;
      scheduledPrincipalRepayment?: number;
      repaymentMethod?: string;
      interestRate?: number;
      paymentDay?: number;
      memo?: string;
      isIncluded?: boolean;
      isCustom?: boolean;
    }>;
    totalAssets?: number;
    totalDebts?: number;
    netWorth?: number;
  }) {
    const { month, baseDate, assets = [], debts = [] } = payload;

    const normalizedMonth = normalizeMonthKey(month);
    if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
      throw new Error('기준월 형식이 올바르지 않습니다.');
    }

    if (!baseDate || !baseDate.startsWith(normalizedMonth)) {
      throw new Error('기준일이 선택한 기준월에 속하지 않습니다.');
    }

    const includedAssets = assets.filter((a) => a.isIncluded !== false);
    const includedDebts = debts.filter((d) => d.isIncluded !== false);

    if (includedAssets.length < 1) {
      throw new Error('최소 1개 이상의 자산 항목이 포함되어야 합니다.');
    }

    for (const a of includedAssets) {
      const name = a.name || a.assetNameSnapshot;
      if (!name || !name.trim()) {
        throw new Error('포함된 자산 항목의 이름이 비어 있습니다.');
      }
      const val = Number(a.value) || 0;
      if (val < 0) {
        throw new Error('자산 금액은 음수일 수 없습니다.');
      }
    }

    for (const d of includedDebts) {
      const name = d.name || d.debtNameSnapshot;
      if (!name || !name.trim()) {
        throw new Error('포함된 부채 항목의 이름이 비어 있습니다.');
      }
      const opening = Number(d.openingPrincipal) || 0;
      if (opening < 0) {
        throw new Error('부채 원금은 음수일 수 없습니다.');
      }
      const scheduled = Number(d.scheduledPrincipalRepayment) || 0;
      if (scheduled < 0) {
        throw new Error('원금상환액은 음수일 수 없습니다.');
      }
    }

    const calculatedTotalAssets = Math.round(
      includedAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0)
    );
    const calculatedTotalDebts = Math.round(
      includedDebts.reduce((sum, d) => sum + (Number(d.openingPrincipal) || 0), 0)
    );
    const calculatedNetWorth = calculatedTotalAssets - calculatedTotalDebts;

    const nowIso = new Date().toISOString();
    const snapshotUuid = generateUuid();
    const snapshotId = `opening-${normalizedMonth}-${snapshotUuid}`;

    const convertedAssets = includedAssets.map((a) => {
      const isCustom = Boolean(a.isCustom || (!a.linkedAssetId && !a.id?.startsWith('ass-') && !a.id?.startsWith('asset-')));
      const assetName = (a.name || a.assetNameSnapshot || '').trim();
      const cat = a.category || a.assetTypeSnapshot || '금융자산';
      const sub = a.subType || '';
      const assetType = sub ? `${cat} (${sub})` : cat;
      const val = Math.round(Number(a.value) || 0);

      const assetUuid = generateUuid();
      const id = isCustom ? `historical-asset-${assetUuid}` : `ass-snap-${normalizedMonth}-${assetUuid}`;
      const linkedAssetId = isCustom ? null : (a.linkedAssetId || a.id || null);

      return {
        id,
        monthlySnapshotId: snapshotId,
        month: normalizedMonth,
        assetId: linkedAssetId,
        linkedAssetId,
        assetNameSnapshot: assetName,
        assetTypeSnapshot: assetType,
        category: cat,
        subType: sub,
        value: val,
        memo: a.memo || '',
        source: 'opening-seed' as const,
        isHistoricalOnly: isCustom,
        isIncluded: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const convertedDebts = includedDebts.map((d) => {
      const isCustom = Boolean(d.isCustom || (!d.linkedDebtId && !d.id?.startsWith('debt-')));
      const debtName = (d.name || d.debtNameSnapshot || '').trim();
      const repaymentMethod = d.repaymentMethod || d.debtTypeSnapshot || '원리금상환';
      const creditor = d.creditor || d.creditorNameSnapshot || '개인/금융';
      const openingPrincipal = Math.round(Number(d.openingPrincipal) || 0);
      const scheduledPrincipalRepayment = Math.round(Number(d.scheduledPrincipalRepayment) || 0);
      const interestRate = d.interestRate !== undefined && d.interestRate !== null ? Number(d.interestRate) : undefined;
      const paymentDay = d.paymentDay !== undefined ? Number(d.paymentDay) : undefined;

      const debtUuid = generateUuid();
      const id = isCustom ? `historical-debt-${debtUuid}` : `debt-snap-${normalizedMonth}-${debtUuid}`;
      const linkedDebtId = isCustom ? null : (d.linkedDebtId || d.id || null);

      return {
        id,
        monthlySnapshotId: snapshotId,
        month: normalizedMonth,
        debtId: linkedDebtId,
        linkedDebtId,
        debtNameSnapshot: debtName,
        debtTypeSnapshot: repaymentMethod,
        creditorNameSnapshot: creditor,
        openingPrincipal,
        scheduledPrincipalRepayment,
        actualPrincipalRepayment: 0,
        additionalBorrowing: 0,
        endingPrincipal: openingPrincipal,
        interestExpense: 0,
        interestRate,
        repaymentMethod,
        paymentDay,
        statusAtMonthEnd: openingPrincipal === 0 ? ('fully-repaid' as const) : ('active' as const),
        source: 'opening-seed' as const,
        memo: d.memo || '',
        isHistoricalOnly: isCustom,
        isIncluded: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    return {
      id: snapshotId,
      month: normalizedMonth,
      baseDate,
      referenceDate: baseDate,
      status: 'draft' as const,
      source: 'opening-seed' as const,
      totalAssets: calculatedTotalAssets,
      totalDebts: calculatedTotalDebts,
      netWorth: calculatedNetWorth,
      assets: convertedAssets,
      debts: convertedDebts,
      createdAt: nowIso,
      updatedAt: nowIso,
      confirmedAt: null,
    };
  },

  /**
   * Prepares and saves draft opening snapshot to service state
   */
  saveOpeningSnapshotDraft(payload: any) {
    const draft = this.prepareOpeningSnapshotDraft(payload);
    this.saveMonthlySnapshot(draft as any);
    if (draft.assets) {
      this.saveAssetSnapshots(draft.month, draft.assets as any);
    }
    if (draft.debts) {
      this.saveDebtSnapshots(draft.month, draft.debts as any);
    }
    return draft;
  },
  // Query Methods
  getMonthlySnapshot(monthInput: string | { year: number; month: number }): MonthlySnapshot | null {
    const monthKey = normalizeMonthKey(monthInput);
    return state.monthlySnapshots[monthKey] || null;
  },

  getOpeningSnapshotStatus(monthInput: string | { year: number; month: number }): SnapshotStatusPriority {
    const monthKey = normalizeMonthKey(monthInput);
    const snap = state.monthlySnapshots[monthKey];
    if (snap) {
      if (snap.status === 'confirmed') return 'confirmed';
      if (snap.status === 'draft') return 'draft';
    }
    const prevMonthKey = getPreviousMonthKey(monthKey);
    const prevSnap = state.monthlySnapshots[prevMonthKey];
    if (prevSnap && prevSnap.status === 'confirmed') {
      return 'draft';
    }
    return 'none';
  },

  getConfirmedOpeningSnapshot(monthInput: string | { year: number; month: number }): MonthlySnapshot | null {
    const snap = this.getOpeningSnapshot(monthInput);
    if (snap && snap.status === 'confirmed') {
      return snap;
    }
    return null;
  },

  getOpeningSnapshot(monthInput: string | { year: number; month: number }): MonthlySnapshot | null {
    const monthKey = normalizeMonthKey(monthInput);
    const snap = state.monthlySnapshots[monthKey];
    if (snap) {
      return snap;
    }
    const prevMonthKey = getPreviousMonthKey(monthKey);
    const prevSnap = state.monthlySnapshots[prevMonthKey];
    if (prevSnap && prevSnap.status === 'confirmed') {
      const assets = this.getAssetSnapshotsByMonth(monthKey);
      const debts = this.getDebtSnapshotsByMonth(monthKey);
      const totalAssets = assets.filter((a) => a.isIncluded !== false).reduce((s, a) => s + (Number(a.value) || 0), 0);
      const totalDebts = debts.filter((d) => d.isIncluded !== false).reduce((s, d) => s + (Number(d.openingPrincipal) || 0), 0);
      return {
        id: `opening-${monthKey}-inherited`,
        month: monthKey,
        status: 'draft',
        source: 'opening-seed',
        referenceDate: `${monthKey}-01`,
        totalAssets,
        totalDebts,
        netWorth: totalAssets - totalDebts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        confirmedAt: undefined,
        assetSnapshotIds: assets.map((a) => a.id),
        debtSnapshotIds: debts.map((d) => d.id),
      };
    }
    return null;
  },

  getAssetSnapshotsByMonth(monthInput: string | { year: number; month: number }): AssetSnapshot[] {
    const monthKey = normalizeMonthKey(monthInput);
    const assets = state.assetSnapshots[monthKey];
    if (assets && assets.length > 0) {
      return assets;
    }
    const prevMonthKey = getPreviousMonthKey(monthKey);
    const prevSnap = state.monthlySnapshots[prevMonthKey];
    if (prevSnap && prevSnap.status === 'confirmed') {
      const prevAssets = state.assetSnapshots[prevMonthKey] || [];
      return prevAssets.map((pa, idx) => ({
        id: `ass-inherited-${monthKey}-${idx}-${Date.now()}`,
        monthlySnapshotId: `opening-${monthKey}-inherited`,
        month: monthKey,
        assetId: pa.assetId || (pa as any).linkedAssetId || null,
        linkedAssetId: (pa as any).linkedAssetId || pa.assetId || null,
        assetNameSnapshot: pa.assetNameSnapshot,
        assetTypeSnapshot: pa.assetTypeSnapshot,
        category: pa.category,
        subType: pa.subType,
        value: Number(pa.value) || 0,
        memo: pa.memo || '',
        source: 'opening-seed',
        isHistoricalOnly: pa.isHistoricalOnly,
        isIncluded: pa.isIncluded !== false,
        createdAt: pa.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
    return [];
  },

  getDebtSnapshotsByMonth(monthInput: string | { year: number; month: number }): DebtSnapshot[] {
    const monthKey = normalizeMonthKey(monthInput);
    const debts = state.debtSnapshots[monthKey];
    if (debts && debts.length > 0) {
      const snap = state.monthlySnapshots[monthKey];
      if (snap && snap.status === 'confirmed') {
        // FINAL: confirmed Snapshot returns RAW directly without enrichDebtSnapshot/Master fallbacks
        return debts;
      }
      return debts.map(enrichDebtSnapshot);
    }
    const prevMonthKey = getPreviousMonthKey(monthKey);
    const prevSnap = state.monthlySnapshots[prevMonthKey];
    if (prevSnap && prevSnap.status === 'confirmed') {
      const prevDebts = state.debtSnapshots[prevMonthKey] || [];
      return prevDebts.map((pd, idx) => ({
        id: `debt-inherited-${monthKey}-${idx}-${Date.now()}`,
        monthlySnapshotId: `opening-${monthKey}-inherited`,
        month: monthKey,
        debtId: pd.debtId || pd.linkedDebtId || null,
        linkedDebtId: pd.linkedDebtId || pd.debtId || null,
        debtNameSnapshot: pd.debtNameSnapshot,
        debtTypeSnapshot: pd.debtTypeSnapshot || pd.repaymentMethod || '원리금상환',
        creditorNameSnapshot: pd.creditorNameSnapshot || '개인/금융',
        openingPrincipal: pd.endingPrincipal !== undefined ? Number(pd.endingPrincipal) : Number(pd.openingPrincipal) || 0,
        scheduledPrincipalRepayment: Number(pd.scheduledPrincipalRepayment) || 0,
        actualPrincipalRepayment: 0,
        additionalBorrowing: 0,
        endingPrincipal: pd.endingPrincipal !== undefined ? Number(pd.endingPrincipal) : Number(pd.openingPrincipal) || 0,
        interestExpense: pd.interestExpense !== undefined ? Number(pd.interestExpense) : 0,
        interestRate: pd.interestRate,
        repaymentMethod: pd.repaymentMethod || pd.debtTypeSnapshot,
        paymentDay: pd.paymentDay || 1,
        statusAtMonthEnd: 'active' as const,
        source: 'opening-seed' as const,
        memo: pd.memo || '',
        isHistoricalOnly: pd.isHistoricalOnly,
        isIncluded: pd.isIncluded !== false,
        createdAt: pd.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
    return [];
  },

  /**
   * FINAL: Creates next month's draft snapshot by deep-copying previous month's confirmed RAW snapshot.
   * NO Master merge, NO OFFICIAL merge, NO legacy seed merge, NO automatic balance deduction.
   */
  createNextMonthSnapshot(
    prevMonthInput: string | { year: number; month: number },
    nextMonthInput: string | { year: number; month: number }
  ): { monthly: MonthlySnapshot; assets: AssetSnapshot[]; debts: DebtSnapshot[] } {
    const prevMonthKey = normalizeMonthKey(prevMonthInput);
    const nextMonthKey = normalizeMonthKey(nextMonthInput);

    const prevSnap = state.monthlySnapshots[prevMonthKey];
    if (!prevSnap || prevSnap.status !== 'confirmed') {
      throw new Error(`직전 월(${prevMonthKey})의 확정 스냅샷이 존재하지 않습니다.`);
    }

    const prevAssets = state.assetSnapshots[prevMonthKey] || [];
    const prevDebts = state.debtSnapshots[prevMonthKey] || [];
    const nowIso = new Date().toISOString();

    const newAssets: AssetSnapshot[] = prevAssets.map((pa, idx) => ({
      id: `ass-snap-${nextMonthKey}-${idx + 1}-${Date.now()}`,
      monthlySnapshotId: `opening-${nextMonthKey}`,
      month: nextMonthKey,
      assetId: pa.assetId || (pa as any).linkedAssetId || null,
      linkedAssetId: (pa as any).linkedAssetId || pa.assetId || null,
      assetNameSnapshot: pa.assetNameSnapshot,
      assetTypeSnapshot: pa.assetTypeSnapshot,
      category: pa.category,
      subType: pa.subType,
      value: Number(pa.value) || 0,
      valuationMethod: pa.valuationMethod || 'Inherited',
      memo: pa.memo || '',
      source: 'opening-seed' as const,
      isHistoricalOnly: pa.isHistoricalOnly,
      isIncluded: pa.isIncluded !== false,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const newDebts: DebtSnapshot[] = prevDebts.map((pd, idx) => {
      const principalVal = pd.endingPrincipal !== undefined ? Number(pd.endingPrincipal) : Number(pd.openingPrincipal) || 0;
      return {
        id: `debt-snap-${nextMonthKey}-${idx + 1}-${Date.now()}`,
        monthlySnapshotId: `opening-${nextMonthKey}`,
        month: nextMonthKey,
        debtId: pd.debtId || pd.linkedDebtId || null,
        linkedDebtId: pd.linkedDebtId || pd.debtId || null,
        debtNameSnapshot: pd.debtNameSnapshot,
        debtTypeSnapshot: pd.debtTypeSnapshot || pd.repaymentMethod || '원리금상환',
        creditorNameSnapshot: pd.creditorNameSnapshot || '개인/금융',
        openingPrincipal: principalVal,
        scheduledPrincipalRepayment: Number(pd.scheduledPrincipalRepayment) || 0,
        actualPrincipalRepayment: 0,
        additionalBorrowing: 0,
        endingPrincipal: principalVal,
        interestExpense: pd.interestExpense !== undefined ? Number(pd.interestExpense) : 0,
        interestRate: pd.interestRate,
        repaymentMethod: pd.repaymentMethod || pd.debtTypeSnapshot,
        paymentDay: pd.paymentDay || 1,
        statusAtMonthEnd: 'active' as const,
        source: 'opening-seed' as const,
        memo: pd.memo || '',
        isHistoricalOnly: pd.isHistoricalOnly,
        isIncluded: pd.isIncluded !== false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const activeAssets = newAssets.filter((a) => a.isIncluded !== false);
    const activeDebts = newDebts.filter((d) => d.isIncluded !== false);
    const totalAssets = Math.round(activeAssets.reduce((s, a) => s + (Number(a.value) || 0), 0));
    const totalDebts = Math.round(activeDebts.reduce((s, d) => s + (Number(d.openingPrincipal) || 0), 0));

    const newMonthly: MonthlySnapshot = {
      id: `opening-${nextMonthKey}`,
      month: nextMonthKey,
      status: 'draft',
      source: 'opening-seed',
      referenceDate: `${nextMonthKey}-01`,
      totalAssets,
      totalDebts,
      netWorth: totalAssets - totalDebts,
      createdAt: nowIso,
      updatedAt: nowIso,
      confirmedAt: undefined,
      assetSnapshotIds: newAssets.map((a) => a.id),
      debtSnapshotIds: newDebts.map((d) => d.id),
    };

    return {
      monthly: newMonthly,
      assets: newAssets,
      debts: newDebts,
    };
  },

  getMonthlyDebtMovements(monthInput: string | { year: number; month: number }): MonthlyDebtMovement[] {
    const monthKey = normalizeMonthKey(monthInput);
    return state.debtMovements[monthKey] || [];
  },

  hasMonthlySnapshot(monthInput: string | { year: number; month: number }): boolean {
    const monthKey = normalizeMonthKey(monthInput);
    return Boolean(state.monthlySnapshots[monthKey]);
  },

  // Mutation Methods
  saveMonthlySnapshot(snapshot: MonthlySnapshot): void {
    const monthKey = normalizeMonthKey(snapshot.month);
    state.monthlySnapshots[monthKey] = {
      ...snapshot,
      month: monthKey,
      updatedAt: new Date().toISOString(),
    };
    saveSnapshotStore();
  },

  saveAssetSnapshots(monthInput: string | { year: number; month: number }, snapshots: AssetSnapshot[]): void {
    const monthKey = normalizeMonthKey(monthInput);
    state.assetSnapshots[monthKey] = snapshots.map((a) => ({
      ...a,
      month: monthKey,
      updatedAt: new Date().toISOString(),
    }));

    // Update assetSnapshotIds in MonthlySnapshot
    if (state.monthlySnapshots[monthKey]) {
      state.monthlySnapshots[monthKey].assetSnapshotIds = snapshots.map((s) => s.id);
      state.monthlySnapshots[monthKey].updatedAt = new Date().toISOString();
    }

    saveSnapshotStore();
  },

  saveDebtSnapshots(monthInput: string | { year: number; month: number }, snapshots: DebtSnapshot[]): void {
    const monthKey = normalizeMonthKey(monthInput);
    state.debtSnapshots[monthKey] = snapshots.map((d) => ({
      ...d,
      month: monthKey,
      updatedAt: new Date().toISOString(),
    }));

    // Update debtSnapshotIds in MonthlySnapshot
    if (state.monthlySnapshots[monthKey]) {
      state.monthlySnapshots[monthKey].debtSnapshotIds = snapshots.map((s) => s.id);
      state.monthlySnapshots[monthKey].updatedAt = new Date().toISOString();
    }

    saveSnapshotStore();
  },

  saveMonthlyDebtMovement(movement: MonthlyDebtMovement): void {
    const monthKey = normalizeMonthKey(movement.month);
    const existing = state.debtMovements[monthKey] || [];
    const idx = existing.findIndex((m) => m.id === movement.id);
    if (idx >= 0) {
      existing[idx] = { ...movement, month: monthKey, updatedAt: new Date().toISOString() };
    } else {
      existing.push({ ...movement, month: monthKey, updatedAt: new Date().toISOString() });
    }
    state.debtMovements[monthKey] = existing;
    saveSnapshotStore();
  },

  /**
   * Creates or updates a draft opening snapshot based on user edits
   */
  saveOpeningSnapshot(
    monthly: MonthlySnapshot,
    assets: AssetSnapshot[],
    debts: DebtSnapshot[]
  ): void {
    const monthKey = normalizeMonthKey(monthly.month);
    const nowIso = new Date().toISOString();

    const activeAssets = assets.filter((a) => a.isIncluded !== false);
    const activeDebts = debts.filter((d) => d.isIncluded !== false);

    const totalAssets = Math.round(activeAssets.reduce((sum, a) => sum + (Number(a.value) || 0), 0));
    const totalDebts = Math.round(activeDebts.reduce((sum, d) => sum + (Number(d.openingPrincipal) || 0), 0));
    const netWorth = totalAssets - totalDebts;

    const monthlyRecord: MonthlySnapshot = {
      ...monthly,
      month: monthKey,
      source: 'opening-seed',
      totalAssets,
      totalDebts,
      netWorth,
      assetSnapshotIds: assets.map((a) => a.id),
      debtSnapshotIds: debts.map((d) => d.id),
      updatedAt: nowIso,
      createdAt: monthly.createdAt || nowIso,
    };

    state.monthlySnapshots[monthKey] = monthlyRecord;
    state.assetSnapshots[monthKey] = assets.map((a) => ({
      ...a,
      month: monthKey,
      updatedAt: nowIso,
    }));
    state.debtSnapshots[monthKey] = debts.map((d) => ({
      ...d,
      month: monthKey,
      updatedAt: nowIso,
    }));

    saveSnapshotStore();
  },

  updateDraftOpeningSnapshot(
    monthly: MonthlySnapshot,
    assets: AssetSnapshot[],
    debts: DebtSnapshot[]
  ): void {
    this.saveOpeningSnapshot({ ...monthly, status: 'draft' }, assets, debts);
  },

  confirmOpeningSnapshot(monthInput: string | { year: number; month: number }): void {
    const monthKey = normalizeMonthKey(monthInput);
    const current = state.monthlySnapshots[monthKey];
    if (current) {
      const nowIso = new Date().toISOString();
      state.monthlySnapshots[monthKey] = {
        ...current,
        status: 'confirmed',
        confirmedAt: nowIso,
        updatedAt: nowIso,
      };
      saveSnapshotStore();
    }
  },

  /**
   * Helper to build a fresh default draft opening snapshot using Master Assets and Master Debts
   */
  createDefaultOpeningSnapshotDraft(
    monthInput: string | { year: number; month: number },
    referenceDate?: string
  ): {
    monthly: MonthlySnapshot;
    assets: AssetSnapshot[];
    debts: DebtSnapshot[];
  } {
    const monthKey = normalizeMonthKey(monthInput);
    const nowIso = new Date().toISOString();

    const assetsData = GlobalMockDataStore.getAssets();
    const debtsData = GlobalMockDataStore.getDebts();

    let masterAssets: any[] = [];
    if (Array.isArray(assetsData)) {
      masterAssets = assetsData;
    } else if (assetsData?.onboardingAssets && assetsData.onboardingAssets.length > 0) {
      masterAssets = assetsData.onboardingAssets.map((a: any) => ({
        id: a.id,
        name: a.assetName || a.name || '자산',
        category: a.assetType || a.category || '기타자산',
        amount: Number(a.currentValue) || Number(a.amount) || 0,
      }));
    } else if (assetsData?.mainAssets) {
      masterAssets = assetsData.mainAssets;
    }

    let masterDebts: any[] = [];
    if (Array.isArray(debtsData)) {
      masterDebts = debtsData;
    } else if (debtsData) {
      const ob = Array.isArray((debtsData as any).onboardingDebts) ? (debtsData as any).onboardingDebts : [];
      const main = Array.isArray((debtsData as any).mainDebts) ? (debtsData as any).mainDebts : [];
      if (ob.length > 0 && main.length > 0) {
        const obIds = new Set(ob.map((x: any) => x.id));
        masterDebts = [...ob, ...main.filter((x: any) => !obIds.has(x.id))];
      } else if (ob.length > 0) {
        masterDebts = ob;
      } else {
        masterDebts = main;
      }
    }

    const refDate = referenceDate || `${monthKey}-01`;

    const assetSnapshots: AssetSnapshot[] = masterAssets.map((ma, idx) => ({
      id: `ass-snap-${monthKey}-${idx + 1}-${Date.now()}`,
      monthlySnapshotId: `msnap-${monthKey}`,
      month: monthKey,
      assetId: ma.id,
      assetNameSnapshot: ma.name,
      assetTypeSnapshot: ma.category || ma.assetType || '금융자산',
      category: ma.category || ma.assetType || '금융자산',
      subType: ma.subType || '',
      value: Math.round(Number(ma.amount) || 0),
      valuationMethod: 'Master Default',
      source: 'opening-seed',
      createdAt: nowIso,
      updatedAt: nowIso,
      isHistoricalOnly: false,
      isIncluded: true,
    }));

    const parseDay = (val: any): number | undefined => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'number') return isNaN(val) ? undefined : val;
      const str = String(val).replace(/[^0-9]/g, '');
      const parsed = parseInt(str, 10);
      return isNaN(parsed) ? undefined : parsed;
    };

    const debtSnapshots: DebtSnapshot[] = masterDebts.map((md, idx) => {
      const scheduledRepay = Number(md.manualPrincipalPayment) || Number(md.currentPrincipalPayment) || Number(md.principalRepayment) || 0;
      const opening = Math.round(Number(md.currentBalance) || Number(md.amount) || Number(md.originalPrincipal) || 0);
      const name = md.debtName || md.name || '부채';

      const rate =
        md.interestRate !== undefined && md.interestRate !== null
          ? Number(md.interestRate)
          : md.annualRate !== undefined && md.annualRate !== null
          ? Number(md.annualRate)
          : md.rate !== undefined && md.rate !== null
          ? Number(md.rate)
          : undefined;

      const repMethod =
        md.repaymentMethod ||
        md.repaymentType ||
        md.paymentType ||
        md.rateType ||
        md.amortizationType ||
        undefined;

      const payDay = parseDay(md.paymentDay ?? md.dueDay ?? md.monthlyPaymentDay ?? md.interestPaymentDay ?? md.repaymentDay ?? md.nextDueDate);
      const creditor = md.creditorName || md.creditor || md.lender || undefined;

      return {
        id: `debt-snap-${monthKey}-${idx + 1}-${Date.now()}`,
        monthlySnapshotId: `msnap-${monthKey}`,
        month: monthKey,
        debtId: md.id,
        debtNameSnapshot: name,
        debtTypeSnapshot: repMethod || '원리금상환',
        creditorNameSnapshot: creditor || (name.includes('담보') ? '금융기관' : '개인/금융'),
        openingPrincipal: opening,
        scheduledPrincipalRepayment: scheduledRepay,
        actualPrincipalRepayment: 0,
        additionalBorrowing: 0,
        endingPrincipal: opening, // In 2-A draft, starting = ending until movements
        interestExpense: md.interestPayment || 0,
        interestRate: rate,
        repaymentMethod: repMethod,
        paymentDay: payDay,
        statusAtMonthEnd: 'active',
        source: 'opening-seed',
        createdAt: nowIso,
        updatedAt: nowIso,
        isHistoricalOnly: false,
        autoDeductPrincipal: name.includes('담보대출') || name.includes('금강'),
        isIncluded: true,
      };
    });

    const totalAssets = assetSnapshots.reduce((s, a) => s + a.value, 0);
    const totalDebts = debtSnapshots.reduce((s, d) => s + d.openingPrincipal, 0);

    const monthlySnapshot: MonthlySnapshot = {
      id: `msnap-${monthKey}`,
      month: monthKey,
      status: 'draft',
      source: 'opening-seed',
      referenceDate: refDate,
      totalAssets,
      totalDebts,
      netWorth: totalAssets - totalDebts,
      createdAt: nowIso,
      updatedAt: nowIso,
      assetSnapshotIds: assetSnapshots.map((a) => a.id),
      debtSnapshotIds: debtSnapshots.map((d) => d.id),
    };

    return {
      monthly: monthlySnapshot,
      assets: assetSnapshots,
      debts: debtSnapshots,
    };
  },
};
