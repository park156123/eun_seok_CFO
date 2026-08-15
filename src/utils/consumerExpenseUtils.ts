import { Transaction } from '../types';
import { parseCategoryString, getCategoryGroup, ConsumerCategoryGroup } from '../data/consumerCategories';
import { formatSummaryAmountKRW } from './amountUtils';

/**
 * Tax & Public Charges Transaction Filter.
 */
export function isTaxTransaction(t: Transaction): boolean {
  if (!t || t.isIncome || t.isDuplicate) return false;
  const amount = Number(t.amount);
  if (isNaN(amount) || amount <= 0) return false;

  const isUserConfirmedTax =
    (t.userConfirmed === true || t.classification?.userConfirmed === true) &&
    (t.classification?.classificationType === 'tax' ||
      t.classification?.majorCategory === '세금·공과' ||
      t.classification?.majorCategory === '세금_공과');

  if (t.analysisStatus === 'excluded' && !isUserConfirmedTax) return false;

  if (t.classification) {
    if (t.classification.classificationType === 'tax') return true;
    if (t.classification.majorCategory === '세금·공과' || t.classification.majorCategory === '세금_공과') return true;
  }
  const categoryStr = (t.category || '').trim();
  if (
    categoryStr === '세금·공과' ||
    categoryStr === '세금_공과' ||
    categoryStr.startsWith('세금·공과') ||
    categoryStr.startsWith('세금_공과')
  ) {
    return true;
  }
  return false;
}

/**
 * Unified Common Consumer Transaction Filter.
 * Strictly adheres to requirement 7:
 * - valid numeric positive amount
 * - not income, not duplicate
 * - not excluded by analysisStatus (unless explicitly user-confirmed as consumer)
 * - excludes: internal transfer, business transaction, debt principal repayment, asset movement, financial cost, unknown, tax & public charges.
 */
export function isConsumerTransaction(t: Transaction): boolean {
  if (!t) return false;

  // 0. Exclude tax & public charges
  if (isTaxTransaction(t)) return false;

  // 1. Exclude income
  if (t.isIncome) return false;

  // 2. Amount must be a valid positive number
  const amount = Number(t.amount);
  if (isNaN(amount) || amount <= 0) return false;

  // 3. Exclude duplicate rows
  if (t.isDuplicate) return false;

  // 4. Exclude by analysisStatus (unless user-confirmed as consumer)
  const isUserConfirmedConsumer =
    (t.userConfirmed === true || t.classification?.userConfirmed === true) &&
    t.classification?.classificationType === 'consumer' &&
    t.classification?.included !== false;

  if (t.analysisStatus === 'excluded' && !isUserConfirmedConsumer) {
    return false;
  }

  // 5. Check classification object
  if (t.classification) {
    const cls = t.classification;
    if (cls.classificationType === 'excluded') {
      return false;
    }
    if (cls.included === false) return false;
    if (cls.needsConfirmation && t.needsReview) return false;

    const reason = cls.exclusionReason;
    if (
      reason === 'business_transaction' ||
      reason === 'debt_principal_repayment' ||
      reason === 'internal_transfer' ||
      reason === 'asset_transfer' ||
      reason === 'income' ||
      reason === 'unknown'
    ) {
      return false;
    }
  }

  // 6. Category string checks
  const categoryStr = (t.category || '').trim();
  if (
    categoryStr.startsWith('제외') ||
    categoryStr.includes('내부이체') ||
    categoryStr.includes('사업') ||
    categoryStr.includes('부채상환') ||
    categoryStr.includes('원금상환') ||
    categoryStr.includes('자산이동') ||
    categoryStr.includes('금융비용') ||
    categoryStr.includes('대출이자') ||
    categoryStr.includes('확인불가') ||
    categoryStr.includes('확인 불가')
  ) {
    return false;
  }

  // 7. Type string checks
  const tType = t.type as string;
  if (tType === 'business' || tType === 'debt' || tType === 'financial' || tType === 'transfer') {
    return false;
  }

  // 8. Major category check
  const { major } = parseCategoryString(categoryStr);
  if (!major || major === '제외') {
    return false;
  }

  return true;
}

/**
 * Filters a transaction array to only valid consumer transactions.
 */
export function getConsumerTransactions(transactions: Transaction[]): Transaction[] {
  return (transactions || []).filter(isConsumerTransaction);
}

export interface ConsumerCategoryItem {
  name: string;
  amount: number;
  count: number;
  percentage: number;
  group: ConsumerCategoryGroup;
}

/**
 * Calculates category breakdown for consumer transactions.
 */
export function getConsumerCategoryBreakdown(transactions: Transaction[]): ConsumerCategoryItem[] {
  const consumerTxs = getConsumerTransactions(transactions);
  const totalExpense = consumerTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const categoryMap = new Map<string, { amount: number; count: number }>();

  consumerTxs.forEach((t) => {
    const { major } = parseCategoryString(t.category);
    const prev = categoryMap.get(major) || { amount: 0, count: 0 };
    categoryMap.set(major, {
      amount: prev.amount + (Number(t.amount) || 0),
      count: prev.count + 1,
    });
  });

  const result: ConsumerCategoryItem[] = [];
  categoryMap.forEach((val, key) => {
    const pct = totalExpense > 0 ? Math.round((val.amount / totalExpense) * 1000) / 10 : 0;
    result.push({
      name: key,
      amount: val.amount,
      count: val.count,
      percentage: pct,
      group: getCategoryGroup(key),
    });
  });

  result.sort((a, b) => b.amount - a.amount);
  return result;
}

/**
 * Calculates subcategory breakdown for a specific major category.
 */
export function getConsumerSubcategoryBreakdown(
  transactions: Transaction[],
  majorCategoryName: string
): Array<{ name: string; amount: number; count: number; percentage: number }> {
  const consumerTxs = getConsumerTransactions(transactions).filter((t) => {
    const { major } = parseCategoryString(t.category);
    return major === majorCategoryName;
  });

  const majorTotal = consumerTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const subMap = new Map<string, { amount: number; count: number }>();

  consumerTxs.forEach((t) => {
    const { minor } = parseCategoryString(t.category);
    const subName = minor.trim() || '기타';
    const prev = subMap.get(subName) || { amount: 0, count: 0 };
    subMap.set(subName, {
      amount: prev.amount + (Number(t.amount) || 0),
      count: prev.count + 1,
    });
  });

  return Array.from(subMap.entries())
    .map(([subName, data]) => {
      const pct = majorTotal > 0 ? Math.round((data.amount / majorTotal) * 1000) / 10 : 0;
      return {
        name: subName,
        amount: data.amount,
        count: data.count,
        percentage: pct,
      };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Calculates top merchants for consumer transactions.
 */
export function getConsumerTopMerchants(
  transactions: Transaction[],
  majorCategoryName?: string,
  limit = 3
): Array<{ merchant: string; amount: number; count: number }> {
  let consumerTxs = getConsumerTransactions(transactions);

  if (majorCategoryName) {
    consumerTxs = consumerTxs.filter((t) => {
      const { major } = parseCategoryString(t.category);
      return major === majorCategoryName;
    });
  }

  const merchantMap = new Map<string, { amount: number; count: number }>();

  consumerTxs.forEach((t) => {
    const mName = (t.merchantMaster || t.merchant || '').trim();
    if (!mName) return;
    const prev = merchantMap.get(mName) || { amount: 0, count: 0 };
    merchantMap.set(mName, {
      amount: prev.amount + (Number(t.amount) || 0),
      count: prev.count + 1,
    });
  });

  return Array.from(merchantMap.entries())
    .map(([mName, data]) => ({
      merchant: mName,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export interface ConsumerInsights {
  totalExpense: number;
  prevComparison: {
    diffAmount: number;
    diffPercent: number;
    isIncreased: boolean;
  };
  topCategory: { category: string; amount: number } | null;
  mostIncreasedCategory: { category: string; increaseAmount: number } | null;
  mostDecreasedCategory: { category: string; decreaseAmount: number } | null;
  topMerchant: { merchant: string; count: number; amount: number } | null;
  largestSingleTransaction: { merchant: string; category: string; amount: number } | null;
  diningOut: { count: number; amount: number };
  grocery: { count: number; amount: number };
  convenience: { count: number; amount: number };
  education: { amount: number };
  insurance: { amount: number };
  dailyAverage: number;
}

/**
 * Calculates all 12 consumer insight metrics.
 */
export function calculateConsumerInsights(
  currentTxs: Transaction[],
  prevTxs: Transaction[] = []
): ConsumerInsights {
  const currConsumer = getConsumerTransactions(currentTxs);
  const prevConsumer = getConsumerTransactions(prevTxs);

  const totalExpense = currConsumer.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const prevTotalExpense = prevConsumer.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 1. 지난달 대비 증감
  const diffAmount = totalExpense - prevTotalExpense;
  const isIncreased = diffAmount > 0;
  const diffPercent = prevTotalExpense > 0
    ? Math.round((Math.abs(diffAmount) / prevTotalExpense) * 1000) / 10
    : 0;

  // Category Totals Current & Prev
  const currCatMap = new Map<string, number>();
  currConsumer.forEach((t) => {
    const { major } = parseCategoryString(t.category);
    currCatMap.set(major, (currCatMap.get(major) || 0) + (Number(t.amount) || 0));
  });

  const prevCatMap = new Map<string, number>();
  prevConsumer.forEach((t) => {
    const { major } = parseCategoryString(t.category);
    prevCatMap.set(major, (prevCatMap.get(major) || 0) + (Number(t.amount) || 0));
  });

  // 2. 가장 많이 지출한 카테고리
  let topCategory: { category: string; amount: number } | null = null;
  let maxCatAmt = 0;
  currCatMap.forEach((amt, cat) => {
    if (amt > maxCatAmt) {
      maxCatAmt = amt;
      topCategory = { category: cat, amount: amt };
    }
  });

  // 3 & 4. 가장 많이 증가 / 감소한 카테고리
  let mostIncreasedCategory: { category: string; increaseAmount: number } | null = null;
  let maxIncrease = 0;
  let mostDecreasedCategory: { category: string; decreaseAmount: number } | null = null;
  let maxDecrease = 0;

  const allCategories = new Set([...Array.from(currCatMap.keys()), ...Array.from(prevCatMap.keys())]);
  allCategories.forEach((cat) => {
    const cAmt = currCatMap.get(cat) || 0;
    const pAmt = prevCatMap.get(cat) || 0;
    const diff = cAmt - pAmt;
    if (diff > maxIncrease) {
      maxIncrease = diff;
      mostIncreasedCategory = { category: cat, increaseAmount: diff };
    }
    if (-diff > maxDecrease) {
      maxDecrease = -diff;
      mostDecreasedCategory = { category: cat, decreaseAmount: -diff };
    }
  });

  // 5. 가장 많이 이용한 거래처 (횟수 기준)
  const merchantCountMap = new Map<string, { count: number; amount: number }>();
  currConsumer.forEach((t) => {
    const mName = (t.merchantMaster || t.merchant || '').trim();
    if (!mName) return;
    const prev = merchantCountMap.get(mName) || { count: 0, amount: 0 };
    merchantCountMap.set(mName, {
      count: prev.count + 1,
      amount: prev.amount + (Number(t.amount) || 0),
    });
  });

  let topMerchant: { merchant: string; count: number; amount: number } | null = null;
  let maxCount = 0;
  merchantCountMap.forEach((val, mName) => {
    if (val.count > maxCount || (val.count === maxCount && topMerchant && val.amount > topMerchant.amount)) {
      maxCount = val.count;
      topMerchant = { merchant: mName, count: val.count, amount: val.amount };
    }
  });

  // 6. 가장 큰 단일 소비
  let largestSingleTransaction: { merchant: string; category: string; amount: number } | null = null;
  let maxSingleAmt = 0;
  currConsumer.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (amt > maxSingleAmt) {
      maxSingleAmt = amt;
      const { major } = parseCategoryString(t.category);
      largestSingleTransaction = {
        merchant: (t.merchantMaster || t.merchant || '단일지출').trim(),
        category: major,
        amount: amt,
      };
    }
  });

  // 7, 8, 9. 외식, 장보기, 편의점
  const diningOut = { count: 0, amount: 0 };
  const grocery = { count: 0, amount: 0 };
  const convenience = { count: 0, amount: 0 };
  let educationAmount = 0;
  let insuranceAmount = 0;

  currConsumer.forEach((t) => {
    const amt = Number(t.amount) || 0;
    const { major, minor } = parseCategoryString(t.category);

    if (minor.includes('외식') || t.category.includes('외식')) {
      diningOut.count += 1;
      diningOut.amount += amt;
    } else if (minor.includes('장보기') || t.category.includes('장보기')) {
      grocery.count += 1;
      grocery.amount += amt;
    } else if (minor.includes('편의점') || t.category.includes('편의점')) {
      convenience.count += 1;
      convenience.amount += amt;
    }

    if (minor.includes('교육비') || major.includes('교육') || t.category.includes('교육')) {
      educationAmount += amt;
    }

    if (major === '보험' || minor.includes('보험')) {
      insuranceAmount += amt;
    }
  });

  // 12. 하루 평균 소비 (월 30일 기준)
  const dailyAverage = Math.round(totalExpense / 30);

  return {
    totalExpense,
    prevComparison: {
      diffAmount,
      diffPercent,
      isIncreased,
    },
    topCategory,
    mostIncreasedCategory,
    mostDecreasedCategory,
    topMerchant,
    largestSingleTransaction,
    diningOut,
    grocery,
    convenience,
    education: { amount: educationAmount },
    insurance: { amount: insuranceAmount },
    dailyAverage,
  };
}

/**
 * Generates CFO One-Line Comment based strictly on consumer transactions.
 * Excludes business expenses, financial costs, and debt principal repayments.
 */
export function generateCfoComment(
  currentTxs: Transaction[],
  prevTxs: Transaction[] = []
): string {
  const hasPending = currentTxs.some(
    (t) => !t.userConfirmed && (t.analysisStatus === 'pending' || t.needsReview || t.category === '미분류')
  );

  if (hasPending) {
    return '미분류 거래를 확인하면 분석이 더 정확해집니다.';
  }

  const insights = calculateConsumerInsights(currentTxs, prevTxs);
  if (insights.totalExpense === 0) {
    return '현재 세션에 집계된 소비 지출 내역이 없습니다.';
  }

  const parts: string[] = [];

  if (insights.topCategory) {
    parts.push(`이번 달은 ${insights.topCategory.category} 비중이 가장 높았습니다.`);
  }

  if (insights.diningOut.amount > 0 && insights.grocery.amount > 0) {
    if (insights.diningOut.amount > insights.grocery.amount) {
      parts.push(`장보기(${formatSummaryAmountKRW(insights.grocery.amount)})보다 외식비(${formatSummaryAmountKRW(insights.diningOut.amount)}) 지출이 많았습니다.`);
    } else {
      parts.push(`외식비(${formatSummaryAmountKRW(insights.diningOut.amount)})보다 장보기(${formatSummaryAmountKRW(insights.grocery.amount)}) 지출을 효율적으로 관리하고 계십니다.`);
    }
  } else if (insights.prevComparison.diffAmount !== 0) {
    if (insights.prevComparison.isIncreased) {
      parts.push(`지난달 대비 소비 지출이 ${insights.prevComparison.diffPercent}% 증가했습니다.`);
    } else {
      parts.push(`지난달 대비 소비 지출을 ${insights.prevComparison.diffPercent}% 절감하셨습니다.`);
    }
  }

  return parts.join(' ');
}
