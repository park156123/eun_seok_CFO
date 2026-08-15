import { Transaction } from '../types';
import {
  getMonthlySettlementSummary,
  getMonthlyRecordForMonth,
  getTransactionsForMonth,
  getCategorySummaryForMonth,
  normalizeMonthKey,
} from '../utils/monthDataSelectors';
import { isConsumerTransaction } from '../utils/consumerExpenseUtils';
import { parseCategoryString } from '../data/consumerCategories';
import { GlobalMockDataStore } from './dataStore';

export interface CfoAnalysisInput {
  month: string;
  current: {
    status: string;
    totalIncome: number;
    livingExpense: number;
    financialCost: number;
    principalRepayment: number;
    savingsInvestment: number;
    taxAndPublicCharges: number;
    totalCashOutflow: number;
    netCashFlow: number;
  };
  comparison?: {
    month: string;
    totalIncome: number;
    livingExpense: number;
    financialCost: number;
    principalRepayment: number;
    savingsInvestment: number;
    taxAndPublicCharges: number;
    totalCashOutflow: number;
    netCashFlow: number;
  };
  history: Array<{
    month: string;
    totalIncome: number;
    livingExpense: number;
    financialCost: number;
    principalRepayment: number;
    savingsInvestment: number;
    taxAndPublicCharges: number;
    totalCashOutflow: number;
    netCashFlow: number;
  }>;
  consumerSummary: Array<{
    category: string;
    amount: number;
    transactionCount: number;
  }>;
  consumerMetrics?: {
    diningOutAmount?: number;
    diningOutCount?: number;
    groceryAmount?: number;
    groceryCount?: number;
    convenienceAmount?: number;
    convenienceCount?: number;
    educationAmount?: number;
    insuranceAmount?: number;
    familyLeisureAmount?: number;
  };
  financialPosition: {
    totalAssets: number;
    totalDebt: number;
    netWorth: number;
  };
  specialNotes?: string;
}

export interface CfoAnalysisResult {
  spendingInsight: string;
  keyFindings: string[];
  question: string | null;
  actions: string[];
}

const CACHE_KEY_PREFIX = 'cfo_ai_analysis_cache_';
const memoryCache: Record<string, { hash: string; result: CfoAnalysisResult }> = {};

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}

/**
 * Builds the CfoAnalysisInput object strictly using in-memory / local state.
 * Never makes new Firestore queries.
 */
export function buildCfoAnalysisInput(monthKey: string): CfoAnalysisInput {
  const norm = normalizeMonthKey(monthKey);
  const currentSummary = getMonthlySettlementSummary(norm.yyyyMm);
  const currentRecord = getMonthlyRecordForMonth(norm.yyyyMm);

  const rawMonths = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  const otherMonths = rawMonths.filter((m) => m !== norm.yyyyMm);

  // Reliable historical months filter: status locked/completed & valid financial data exists
  const reliableHistory: Array<{
    month: string;
    totalIncome: number;
    livingExpense: number;
    financialCost: number;
    principalRepayment: number;
    savingsInvestment: number;
    taxAndPublicCharges: number;
    totalCashOutflow: number;
    netCashFlow: number;
  }> = [];

  for (const m of otherMonths) {
    const rec = getMonthlyRecordForMonth(m);
    const sum = getMonthlySettlementSummary(m);
    const txs = getTransactionsForMonth(m);

    const isLockedOrCompleted = rec?.status === '결산잠금' || rec?.status === '완료';
    const hasMeaningfulData = sum.hasData && (sum.totalIncome > 0 || sum.totalOutflow > 0);
    const hasTransactions = txs.length > 0;

    // A month is reliable for comparison if it is locked/completed with valid ledger or summary
    if (isLockedOrCompleted && hasMeaningfulData && hasTransactions) {
      reliableHistory.push({
        month: m,
        totalIncome: sum.totalIncome,
        livingExpense: sum.livingExpense,
        financialCost: sum.financialCost,
        principalRepayment: sum.debtPrincipal,
        savingsInvestment: sum.totalSavings,
        taxAndPublicCharges: sum.taxAndPublicCharges,
        totalCashOutflow: sum.totalOutflow,
        netCashFlow: sum.netCashflow,
      });
    }
  }

  // Sort chronological
  reliableHistory.sort((a, b) => a.month.localeCompare(b.month));

  // Find the most recent reliable prior month
  const priorReliable = reliableHistory
    .filter((h) => h.month < norm.yyyyMm)
    .pop();

  // Consumer category aggregation
  const catSummary = getCategorySummaryForMonth(norm.yyyyMm);
  const consumerSummary = catSummary.map((c) => ({
    category: c.category,
    amount: c.amount,
    transactionCount: c.count,
  }));

  // Consumer detailed metrics
  const txs = getTransactionsForMonth(norm.yyyyMm).filter(isConsumerTransaction);
  let diningOutAmount = 0, diningOutCount = 0;
  let groceryAmount = 0, groceryCount = 0;
  let convenienceAmount = 0, convenienceCount = 0;
  let educationAmount = 0;
  let insuranceAmount = 0;
  let familyLeisureAmount = 0;

  txs.forEach((t: Transaction) => {
    const amt = Number(t.amount) || 0;
    const { major, minor } = parseCategoryString(t.category);

    if (minor.includes('외식') || t.category.includes('외식')) {
      diningOutCount += 1;
      diningOutAmount += amt;
    } else if (minor.includes('장보기') || t.category.includes('장보기')) {
      groceryCount += 1;
      groceryAmount += amt;
    } else if (minor.includes('편의점') || t.category.includes('편의점')) {
      convenienceCount += 1;
      convenienceAmount += amt;
    }

    if (minor.includes('교육비') || major.includes('교육') || t.category.includes('교육')) {
      educationAmount += amt;
    }
    if (major === '보험' || minor.includes('보험')) {
      insuranceAmount += amt;
    }
    if (minor.includes('여가') || minor.includes('여행') || minor.includes('문화')) {
      familyLeisureAmount += amt;
    }
  });

  // Assets and Debts
  const assets = GlobalMockDataStore.getAssets();
  const debts = GlobalMockDataStore.getDebts();
  const totalAssets = (assets?.mainAssets || []).reduce((s: number, a: any) => s + (Number(a.value) || 0), 0);
  const totalDebt = (debts?.mainDebts || []).reduce((s: number, d: any) => s + (Number(d.balance) || 0), 0);
  const netWorth = totalAssets - totalDebt;

  return {
    month: norm.yyyyMm,
    current: {
      status: currentRecord?.status || '미결산',
      totalIncome: currentSummary.totalIncome,
      livingExpense: currentSummary.livingExpense,
      financialCost: currentSummary.financialCost,
      principalRepayment: currentSummary.debtPrincipal,
      savingsInvestment: currentSummary.totalSavings,
      taxAndPublicCharges: currentSummary.taxAndPublicCharges,
      totalCashOutflow: currentSummary.totalOutflow,
      netCashFlow: currentSummary.netCashflow,
    },
    comparison: priorReliable,
    history: reliableHistory,
    consumerSummary,
    consumerMetrics: {
      diningOutAmount,
      diningOutCount,
      groceryAmount,
      groceryCount,
      convenienceAmount,
      convenienceCount,
      educationAmount,
      insuranceAmount,
      familyLeisureAmount,
    },
    financialPosition: {
      totalAssets,
      totalDebt,
      netWorth,
    },
    specialNotes: currentRecord?.specialNotes?.trim() || undefined,
  };
}

/**
 * Gets cached analysis result if valid for current month and input data.
 */
export function getCachedAnalysisResult(monthKey: string, input: CfoAnalysisInput): CfoAnalysisResult | null {
  const norm = normalizeMonthKey(monthKey);
  const inputStr = JSON.stringify(input);
  const hash = simpleHash(inputStr);

  if (memoryCache[norm.yyyyMm] && memoryCache[norm.yyyyMm].hash === hash) {
    return memoryCache[norm.yyyyMm].result;
  }

  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${norm.yyyyMm}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.hash === hash && parsed.result) {
        memoryCache[norm.yyyyMm] = { hash, result: parsed.result };
        return parsed.result;
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }

  return null;
}

/**
 * Calls Gemini server endpoint /api/cfo/monthly-analysis with defensive validation.
 */
export async function requestCfoMonthlyAnalysis(input: CfoAnalysisInput): Promise<CfoAnalysisResult> {
  const norm = normalizeMonthKey(input.month);
  const inputStr = JSON.stringify(input);
  const hash = simpleHash(inputStr);

  const res = await fetch('/api/cfo/monthly-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: inputStr,
  });

  if (!res.ok) {
    throw new Error(`AI analysis server returned status ${res.status}`);
  }

  const data = await res.json();

  // Defensive validation of output
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid AI response payload');
  }

  const spendingInsight = typeof data.spendingInsight === 'string' && data.spendingInsight.trim() !== ''
    ? data.spendingInsight.trim()
    : '소비 지출 분석이 완료되었습니다.';

  const keyFindings = Array.isArray(data.keyFindings)
    ? data.keyFindings.filter((f: any) => typeof f === 'string' && f.trim() !== '').slice(0, 2)
    : [];

  const question = typeof data.question === 'string' && data.question.trim() !== ''
    ? data.question.trim()
    : null;

  const actions = Array.isArray(data.actions)
    ? data.actions.filter((a: any) => typeof a === 'string' && a.trim() !== '').slice(0, 2)
    : [];

  const sanitizedResult: CfoAnalysisResult = {
    spendingInsight,
    keyFindings,
    question,
    actions,
  };

  // Save to memory cache and local storage
  memoryCache[norm.yyyyMm] = { hash, result: sanitizedResult };
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${norm.yyyyMm}`, JSON.stringify({ hash, result: sanitizedResult }));
  } catch {
    // Ignore storage quota errors
  }

  return sanitizedResult;
}
