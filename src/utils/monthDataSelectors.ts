import { Transaction, ActiveCsvSession } from '../types';
import { GlobalMockDataStore, ConsumerSpendingSummary } from '../services/dataStore';
import { isConsumerTransaction } from './consumerExpenseUtils';
import { getCategoryGroup } from '../data/consumerCategories';

/**
 * Standard Month Normalization Result
 */
export interface NormalizedMonth {
  formattedMonth: string; // e.g., '2026년 5월'
  yyyyMm: string;         // e.g., '2026-05'
  year: number;           // e.g., 2026
  month: number;          // e.g., 5
}

/**
 * Normalizes any month string ('2026-05', '2026년 5월', '2026년 05월') into standard parts.
 */
export function normalizeMonthKey(inputStr?: string): NormalizedMonth {
  if (!inputStr) {
    return { formattedMonth: '2026년 4월', yyyyMm: '2026-04', year: 2026, month: 4 };
  }

  // Handle YYYY-MM
  const hyphenMatch = inputStr.match(/^(\d{4})-(\d{1,2})$/);
  if (hyphenMatch) {
    const y = parseInt(hyphenMatch[1], 10);
    const m = parseInt(hyphenMatch[2], 10);
    return {
      formattedMonth: `${y}년 ${m}월`,
      yyyyMm: `${y}-${String(m).padStart(2, '0')}`,
      year: y,
      month: m,
    };
  }

  // Handle YYYY년 M월
  const koreanMatch = inputStr.match(/(\d{4})년\s*(\d{1,2})월/);
  if (koreanMatch) {
    const y = parseInt(koreanMatch[1], 10);
    const m = parseInt(koreanMatch[2], 10);
    return {
      formattedMonth: `${y}년 ${m}월`,
      yyyyMm: `${y}-${String(m).padStart(2, '0')}`,
      year: y,
      month: m,
    };
  }

  return { formattedMonth: '2026년 4월', yyyyMm: '2026-04', year: 2026, month: 4 };
}

/**
 * Helper to check if a transaction belongs to a given year/month.
 */
export function isTransactionInMonth(tx: Transaction, targetYear: number, targetMonth: number): boolean {
  if (!tx) return false;

  const targetFormatted = `${targetYear}년 ${targetMonth}월`;
  const targetYyyyMm = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

  // 1. Explicit settlementMonth check
  if (tx.settlementMonth !== undefined && tx.settlementMonth !== null) {
    if (Number(tx.settlementMonth) === Number(targetMonth)) {
      return true;
    }
    if (String(tx.settlementMonth) === targetFormatted || String(tx.settlementMonth) === targetYyyyMm) {
      return true;
    }
  }

  // 2. Parse tx.date
  if (tx.date) {
    // Format: YYYY-MM-DD or YYYY.MM.DD
    const fullMatch = tx.date.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    if (fullMatch) {
      const y = Number(fullMatch[1]);
      const m = Number(fullMatch[2]);
      return Number(y) === Number(targetYear) && Number(m) === Number(targetMonth);
    }

    // Format: MM.DD HH:mm or MM-DD or MM.DD
    const shortMatch = tx.date.match(/^(\d{1,2})[.-](\d{1,2})/);
    if (shortMatch) {
      const m = Number(shortMatch[1]);
      return Number(m) === Number(targetMonth);
    }
  }

  return false;
}

/**
 * Helper to get the saved Monthly Settlement Record for a given month from cfo_monthly_records_v3
 */
export function getMonthlyRecordForMonth(monthInput: string) {
  const norm = normalizeMonthKey(monthInput);
  try {
    const saved = localStorage.getItem('cfo_monthly_records_v3');
    if (saved) {
      const recordsMap = JSON.parse(saved);
      return recordsMap[norm.formattedMonth] || null;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

/**
 * Common Selector 1: Get all transactions strictly belonging to the given selectedMonth.
 */
export function getTransactionsForMonth(selectedMonthStr: string): Transaction[] {
  const norm = normalizeMonthKey(selectedMonthStr);
  const seenIds = new Set<string>();
  const results: Transaction[] = [];

  // Source A: GlobalMockDataStore transactions
  const storeData = GlobalMockDataStore.getData();
  const storeTxs = storeData.otherSettings?.transactions || [];

  storeTxs.forEach((tx) => {
    if (isTransactionInMonth(tx, norm.year, norm.month)) {
      const txId = tx.id || tx.transactionId || `${tx.date}_${tx.amount}_${tx.merchant}`;
      if (!seenIds.has(txId)) {
        seenIds.add(txId);
        results.push(tx);
      }
    }
  });

  // Source B: cfo_monthly_records_v3 transactions for this month
  const monthlyRecord = getMonthlyRecordForMonth(selectedMonthStr);
  if (monthlyRecord && Array.isArray(monthlyRecord.transactions)) {
    monthlyRecord.transactions.forEach((tx: Transaction) => {
      const txId = tx.id || tx.transactionId || `${tx.date}_${tx.amount}_${tx.merchant}`;
      if (!seenIds.has(txId)) {
        seenIds.add(txId);
        results.push(tx);
      }
    });
  }

  return results;
}

/**
 * Month CSV Session Info Structure
 */
export interface MonthCsvSessionInfo {
  hasCsvSession: boolean;
  sourceFileName?: string;
  importedAt?: string;
  dateRange?: string;
  totalRawCount: number;
  includedCount: number;
  excludedCount: number;
  pendingCount: number;
  isSampleData?: boolean;
}

/**
 * Common Selector 2: Get CSV Session info strictly for selectedMonth.
 */
export function getCsvSessionForMonth(selectedMonthStr: string): MonthCsvSessionInfo {
  const norm = normalizeMonthKey(selectedMonthStr);
  const monthlyRecord = getMonthlyRecordForMonth(selectedMonthStr);
  const txs = getTransactionsForMonth(selectedMonthStr);

  if (monthlyRecord && (monthlyRecord.csvUploaded || (monthlyRecord.transactions && monthlyRecord.transactions.length > 0))) {
    const recordTxs: Transaction[] = monthlyRecord.transactions || txs;
    const included = recordTxs.filter(isConsumerTransaction);
    const excluded = recordTxs.filter((t) => t.category?.startsWith('제외') || t.analysisStatus === 'excluded');
    const pending = recordTxs.filter((t) => t.needsReview || t.analysisStatus === 'pending');

    return {
      hasCsvSession: true,
      sourceFileName: monthlyRecord.csvFileName || `${norm.formattedMonth} 카드/통장 내역.csv`,
      importedAt: monthlyRecord.completedAtDate ? `${monthlyRecord.completedAtDate} ${monthlyRecord.completedAtTime || ''}` : '최근 업로드',
      dateRange: `${norm.formattedMonth} 내역`,
      totalRawCount: monthlyRecord.csvTotalCount || recordTxs.length,
      includedCount: included.length,
      excludedCount: excluded.length,
      pendingCount: pending.length,
      isSampleData: !!monthlyRecord.isSampleData,
    };
  }

  // Check GlobalMockDataStore activeCsvSession if transactions match this month
  const storeData = GlobalMockDataStore.getData();
  const globalActiveSession = storeData.otherSettings?.activeCsvSession;
  if (globalActiveSession && txs.length > 0) {
    const included = txs.filter(isConsumerTransaction);
    const excluded = txs.filter((t) => t.category?.startsWith('제외') || t.analysisStatus === 'excluded');
    const pending = txs.filter((t) => t.needsReview || t.analysisStatus === 'pending');

    return {
      hasCsvSession: true,
      sourceFileName: globalActiveSession.sourceFileName || `${norm.formattedMonth} CSV.csv`,
      importedAt: globalActiveSession.importedAt,
      dateRange: globalActiveSession.dateRange,
      totalRawCount: globalActiveSession.totalRawCount || txs.length,
      includedCount: included.length,
      excludedCount: excluded.length,
      pendingCount: pending.length,
    };
  }

  if (txs.length > 0) {
    const included = txs.filter(isConsumerTransaction);
    const excluded = txs.filter((t) => t.category?.startsWith('제외') || t.analysisStatus === 'excluded');
    const pending = txs.filter((t) => t.needsReview || t.analysisStatus === 'pending');

    return {
      hasCsvSession: true,
      sourceFileName: `${norm.formattedMonth} 내역.csv`,
      importedAt: '직접 입력/분석됨',
      dateRange: `${norm.formattedMonth} 전체`,
      totalRawCount: txs.length,
      includedCount: included.length,
      excludedCount: excluded.length,
      pendingCount: pending.length,
    };
  }

  return {
    hasCsvSession: false,
    totalRawCount: 0,
    includedCount: 0,
    excludedCount: 0,
    pendingCount: 0,
  };
}

export interface ExpenseSummaryResult extends ConsumerSpendingSummary {
  hasData: boolean;
  formattedSelectedMonth: string;
}

/**
 * Common Selector 3: Get Expense & Category Summary strictly for selectedMonth.
 */
export function getExpenseSummaryForMonth(selectedMonthStr: string): ExpenseSummaryResult {
  const norm = normalizeMonthKey(selectedMonthStr);
  const txs = getTransactionsForMonth(selectedMonthStr);
  const sessionInfo = getCsvSessionForMonth(selectedMonthStr);

  const includedTxs = txs.filter(isConsumerTransaction);
  const excludedTxs = txs.filter((t) => {
    if (t.analysisStatus === 'excluded') return true;
    if (t.classification?.classificationType === 'excluded') return true;
    const cat = t.category || '';
    return cat.startsWith('제외') || cat.includes('내부이체');
  });

  const pendingTxs = txs.filter((t) => {
    if (t.analysisStatus === 'pending') return true;
    if (t.needsReview || t.classification?.needsConfirmation) return true;
    return false;
  });

  const totalExpense = includedTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Category breakdown
  const categoryMap = new Map<string, { amount: number; count: number }>();
  includedTxs.forEach((t) => {
    let cat = t.category || '기타';
    if (cat.includes('>')) {
      cat = cat.split('>')[0].trim();
    }
    if (cat === '제외' || cat.startsWith('제외')) return;
    const curr = categoryMap.get(cat) || { amount: 0, count: 0 };
    categoryMap.set(cat, {
      amount: curr.amount + (Number(t.amount) || 0),
      count: curr.count + 1,
    });
  });

  const categoryBreakdown: Array<{ category: string; amount: number; count: number; percentage: number }> = [];
  categoryMap.forEach((val, key) => {
    const percentage = totalExpense > 0 ? Math.round((val.amount / totalExpense) * 1000) / 10 : 0;
    categoryBreakdown.push({
      category: key,
      amount: val.amount,
      count: val.count,
      percentage,
    });
  });
  categoryBreakdown.sort((a, b) => b.amount - a.amount);

  // TOP 5 Merchants
  const merchantMap = new Map<string, { amount: number; count: number }>();
  includedTxs.forEach((t) => {
    const merchant = (t.merchant || '').trim();
    if (!merchant) return;
    const curr = merchantMap.get(merchant) || { amount: 0, count: 0 };
    merchantMap.set(merchant, {
      amount: curr.amount + (Number(t.amount) || 0),
      count: curr.count + 1,
    });
  });

  const top5Merchants: Array<{ merchant: string; totalAmount: number; count: number }> = [];
  merchantMap.forEach((val, key) => {
    top5Merchants.push({
      merchant: key,
      totalAmount: val.amount,
      count: val.count,
    });
  });
  top5Merchants.sort((a, b) => b.totalAmount - a.totalAmount);

  const activeSessionInfo: ActiveCsvSession | undefined = sessionInfo.hasCsvSession
    ? {
        importSessionId: `sess_${norm.yyyyMm}`,
        sourceFileName: sessionInfo.sourceFileName || `${norm.formattedMonth} 내역.csv`,
        importedAt: sessionInfo.importedAt || '',
        dateRange: sessionInfo.dateRange || `${norm.formattedMonth} 전체`,
        totalRawCount: sessionInfo.totalRawCount,
        includedCount: sessionInfo.includedCount,
        excludedCount: sessionInfo.excludedCount,
        pendingCount: sessionInfo.pendingCount,
      }
    : undefined;

  const hasData = sessionInfo.hasCsvSession || txs.length > 0;

  return {
    hasData,
    formattedSelectedMonth: norm.formattedMonth,
    activeSessionInfo,
    totalExpense,
    totalCount: includedTxs.length,
    categoryBreakdown,
    top5Merchants: top5Merchants.slice(0, 5),
    excludedSummary: {
      count: excludedTxs.length,
      totalAmount: excludedTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    },
    pendingSummary: {
      count: pendingTxs.length,
      totalAmount: pendingTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    },
    totalSessionRawCount: txs.length,
  };
}

/**
 * Common Selector 4: Get Category Summary strictly for selectedMonth.
 */
export function getCategorySummaryForMonth(selectedMonthStr: string) {
  const summary = getExpenseSummaryForMonth(selectedMonthStr);
  return summary.categoryBreakdown.map((item) => ({
    ...item,
    group: getCategoryGroup(item.category),
  }));
}
