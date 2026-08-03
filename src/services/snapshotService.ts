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

// Initial state loader
const loadSnapshotStore = (): SnapshotStoreState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.monthlySnapshots && Object.keys(parsed.monthlySnapshots).length > 0) {
        // If 2026-04 seed exists in storage as draft, mark confirmed as default 2026-04 opening snapshot
        if (parsed.monthlySnapshots['2026-04'] && parsed.monthlySnapshots['2026-04'].id === 'opening-2026-04-seed') {
          parsed.monthlySnapshots['2026-04'].status = 'confirmed';
          if (!parsed.monthlySnapshots['2026-04'].confirmedAt) {
            parsed.monthlySnapshots['2026-04'].confirmedAt = '2026-04-01T00:00:00.000Z';
          }
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

  // Seed default 2026-04 confirmed snapshot if missing
  const defaultStore: SnapshotStoreState = {
    monthlySnapshots: {
      '2026-04': {
        id: 'opening-2026-04-seed',
        month: '2026-04',
        status: 'confirmed',
        source: 'opening-seed',
        referenceDate: '2026-04-01',
        totalAssets: 4050000000,
        totalDebts: 2529020160,
        netWorth: 1520979840,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        confirmedAt: '2026-04-01T00:00:00.000Z',
        assetSnapshotIds: ['ass-seed-1', 'ass-seed-2', 'ass-seed-3', 'ass-seed-4', 'ass-seed-5'],
        debtSnapshotIds: ['debt-seed-1', 'debt-seed-2', 'debt-seed-3', 'debt-seed-4', 'debt-seed-5', 'debt-seed-6', 'debt-seed-7'],
      },
    },
    assetSnapshots: {
      '2026-04': [
        {
          id: 'ass-seed-1',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          assetId: 'asset-1',
          assetNameSnapshot: '미용실 본점',
          assetTypeSnapshot: '부동산',
          value: 1500000000,
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'ass-seed-2',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          assetId: 'asset-2',
          assetNameSnapshot: '현하우스',
          assetTypeSnapshot: '부동산',
          value: 800000000,
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'ass-seed-3',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          assetId: 'asset-3',
          assetNameSnapshot: '주식/펀드 (삼성전자)',
          assetTypeSnapshot: '금융자산',
          value: 50000000,
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'ass-seed-4',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          assetId: 'asset-4',
          assetNameSnapshot: '비상금 통장',
          assetTypeSnapshot: '금융자산',
          value: 30000000,
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'ass-seed-5',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          assetId: 'asset-5',
          assetNameSnapshot: '금강아파트',
          assetTypeSnapshot: '부동산',
          value: 1670000000,
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    debtSnapshots: {
      '2026-04': [
        {
          id: 'debt-seed-1',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: 'debt-1',
          linkedDebtId: 'debt-1',
          debtNameSnapshot: '하나은행 주택담보대출',
          debtTypeSnapshot: '원리금상환',
          creditorNameSnapshot: '하나은행',
          openingPrincipal: 1250000000,
          scheduledPrincipalRepayment: 5281771,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 1250000000,
          interestExpense: 5000000,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'debt-seed-2',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: 'debt-2',
          linkedDebtId: 'debt-2',
          debtNameSnapshot: '국민은행 신용대출',
          debtTypeSnapshot: '원리금상환',
          creditorNameSnapshot: '국민은행',
          openingPrincipal: 450000000,
          scheduledPrincipalRepayment: 3000000,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 450000000,
          interestExpense: 2062500,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'debt-seed-3',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: 'debt-3',
          linkedDebtId: 'debt-3',
          debtNameSnapshot: '신한은행 사업자대출',
          debtTypeSnapshot: '원리금상환',
          creditorNameSnapshot: '신한은행',
          openingPrincipal: 225000000,
          scheduledPrincipalRepayment: 2000000,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 225000000,
          interestExpense: 1125000,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'debt-seed-4',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: 'debt-4',
          linkedDebtId: 'debt-4',
          debtNameSnapshot: '현대캐피탈 시설자금',
          debtTypeSnapshot: '원리금상환',
          creditorNameSnapshot: '현대캐피탈',
          openingPrincipal: 54920160,
          scheduledPrincipalRepayment: 1500000,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 54920160,
          interestExpense: 269934,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'debt-seed-5',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: null,
          linkedDebtId: null,
          debtNameSnapshot: '재호',
          debtTypeSnapshot: '개인차입금',
          creditorNameSnapshot: '개인 (재호)',
          openingPrincipal: 25000000,
          scheduledPrincipalRepayment: 0,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 25000000,
          interestExpense: 0,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: true,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'debt-seed-6',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: null,
          linkedDebtId: null,
          debtNameSnapshot: '광주엄니',
          debtTypeSnapshot: '개인차입금',
          creditorNameSnapshot: '개인 (광주엄니)',
          openingPrincipal: 50000000,
          scheduledPrincipalRepayment: 0,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 50000000,
          interestExpense: 0,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: true,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          id: 'debt-seed-7',
          monthlySnapshotId: 'opening-2026-04-seed',
          month: '2026-04',
          debtId: 'debt-7',
          linkedDebtId: 'debt-7',
          debtNameSnapshot: '금강아파트 담보대출',
          debtTypeSnapshot: '원리금상환',
          creditorNameSnapshot: '하나은행',
          openingPrincipal: 474100000,
          scheduledPrincipalRepayment: 2000000,
          actualPrincipalRepayment: 0,
          additionalBorrowing: 0,
          endingPrincipal: 474100000,
          interestExpense: 1500000,
          statusAtMonthEnd: 'active',
          source: 'opening-seed',
          isHistoricalOnly: false,
          isIncluded: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    },
    debtMovements: {},
  };

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
      const assetType = a.category || a.assetTypeSnapshot || '기타자산';
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
      const debtType = d.debtTypeSnapshot || '원리금상환';
      const creditor = d.creditor || d.creditorNameSnapshot || '개인/금융';
      const openingPrincipal = Math.round(Number(d.openingPrincipal) || 0);
      const scheduledPrincipalRepayment = Math.round(Number(d.scheduledPrincipalRepayment) || 0);

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
        debtTypeSnapshot: debtType,
        creditorNameSnapshot: creditor,
        openingPrincipal,
        scheduledPrincipalRepayment,
        actualPrincipalRepayment: 0,
        additionalBorrowing: 0,
        endingPrincipal: openingPrincipal,
        interestExpense: 0,
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
    if (snap && snap.source === 'opening-seed') {
      if (snap.status === 'confirmed') return 'confirmed';
      if (snap.status === 'draft') return 'draft';
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
    if (snap && snap.source === 'opening-seed') {
      return snap;
    }
    return null;
  },

  getAssetSnapshotsByMonth(monthInput: string | { year: number; month: number }): AssetSnapshot[] {
    const monthKey = normalizeMonthKey(monthInput);
    return state.assetSnapshots[monthKey] || [];
  },

  getDebtSnapshotsByMonth(monthInput: string | { year: number; month: number }): DebtSnapshot[] {
    const monthKey = normalizeMonthKey(monthInput);
    return state.debtSnapshots[monthKey] || [];
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
    } else if (debtsData?.onboardingDebts && debtsData.onboardingDebts.length > 0) {
      masterDebts = debtsData.onboardingDebts.map((d: any) => ({
        id: d.id,
        name: d.debtName || d.name || '부채',
        amount: Number(d.currentBalance) || Number(d.amount) || 0,
        principalRepayment: Number(d.manualPrincipalPayment) || Number(d.currentPrincipalPayment) || 0,
        interestPayment: Number(d.manualInterestPayment) || Number(d.currentInterestPayment) || 0,
        rateType: d.rateType || '고정금리',
      }));
    } else if (debtsData?.mainDebts) {
      masterDebts = debtsData.mainDebts;
    }

    const refDate = referenceDate || `${monthKey}-01`;

    const assetSnapshots: AssetSnapshot[] = masterAssets.map((ma, idx) => ({
      id: `ass-snap-${monthKey}-${idx + 1}-${Date.now()}`,
      monthlySnapshotId: `msnap-${monthKey}`,
      month: monthKey,
      assetId: ma.id,
      assetNameSnapshot: ma.name,
      assetTypeSnapshot: ma.category,
      value: Math.round(Number(ma.amount) || 0),
      valuationMethod: 'Master Default',
      source: 'opening-seed',
      createdAt: nowIso,
      updatedAt: nowIso,
      isHistoricalOnly: false,
      isIncluded: true,
    }));

    const debtSnapshots: DebtSnapshot[] = masterDebts.map((md, idx) => {
      const scheduledRepay = md.principalRepayment || 0;
      const opening = Math.round(Number(md.amount) || 0);

      return {
        id: `debt-snap-${monthKey}-${idx + 1}-${Date.now()}`,
        monthlySnapshotId: `msnap-${monthKey}`,
        month: monthKey,
        debtId: md.id,
        debtNameSnapshot: md.name,
        debtTypeSnapshot: md.rateType || '원리금상환',
        creditorNameSnapshot: md.name.includes('담보') ? '금융기관' : '개인/금융',
        openingPrincipal: opening,
        scheduledPrincipalRepayment: scheduledRepay,
        actualPrincipalRepayment: 0,
        additionalBorrowing: 0,
        endingPrincipal: opening, // In 2-A draft, starting = ending until movements
        interestExpense: md.interestPayment || 0,
        statusAtMonthEnd: 'active',
        source: 'opening-seed',
        createdAt: nowIso,
        updatedAt: nowIso,
        isHistoricalOnly: false,
        autoDeductPrincipal: md.name.includes('담보대출') || md.name.includes('금강'),
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
