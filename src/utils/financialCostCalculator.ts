import { SnapshotService, normalizeMonthKey, getAllMasterDebts, findMatchingMasterDebt } from '../services/snapshotService';
import { GlobalMockDataStore } from '../services/dataStore';
import { OnboardingDebt } from '../types';

export interface DebtFinancialCostItem {
  id: string;
  debtId?: string;
  linkedDebtId?: string;
  name: string;
  creditor: string;
  principal: number;
  rate: number;
  hasRate: boolean;
  monthlyInterest: number;
  sourceTag: string;
  repaymentMethod?: string;
  isHistorical?: boolean;
}

export interface MonthlyFinancialCostResult {
  hasSnapshot: boolean;
  totalCost: number;
  items: DebtFinancialCostItem[];
  message?: string;
}

/**
 * 월 이자 계산 공통 함수 (원 단위 반올림)
 */
export function calculateMonthlyInterest(principal: number, annualRate: number): number {
  if (!principal || principal <= 0 || !annualRate || annualRate <= 0) {
    return 0;
  }
  return Math.round((principal * (annualRate / 100)) / 12);
}

/**
 * 특정 월의 확정 스냅샷 부채 잔액 + 마스터 부채 금리를 조합한 금융비용 계산
 */
export function calculateMonthFinancialCost(
  month: string | { year: number; month: number },
  customOnboardingDebts?: OnboardingDebt[]
): MonthlyFinancialCostResult {
  // 1. 월 키 형식 통일 (YYYY-MM)
  const normalizedMonth = normalizeMonthKey(month);

  // 2. 확정 스냅샷 조회 (SnapshotService 동일 사용)
  const status = SnapshotService.getOpeningSnapshotStatus(normalizedMonth);
  const openingSnap = SnapshotService.getOpeningSnapshot(normalizedMonth);

  const hasConfirmedOpening =
    status === 'confirmed' || openingSnap?.status === 'confirmed';

  const snapshotDebts = hasConfirmedOpening
    ? SnapshotService.getDebtSnapshotsByMonth(normalizedMonth).filter((d) => d.isIncluded !== false)
    : [];

  // 3. 진단 로그 추가 (Requirement 8)
  console.log('[FinancialCost]', {
    selectedMonthRaw: typeof month === 'string' ? month : JSON.stringify(month),
    monthKey: normalizedMonth,
    snapshotFound: hasConfirmedOpening,
    snapshotId: openingSnap?.id || null,
    snapshotMonth: openingSnap?.month || null,
    snapshotStatus: status,
    snapshotSource: openingSnap?.source || null,
    debtsCount: snapshotDebts.length,
  });

  if (!hasConfirmedOpening) {
    console.log(
      `[FinancialCost] Snapshot not found or not confirmed for ${normalizedMonth}. Checking available opening snapshot status:`,
      {
        status,
        snapshot: openingSnap,
      }
    );
    return {
      hasSnapshot: false,
      totalCost: 0,
      items: [],
      message: '선택한 월의 확정 자산·부채 스냅샷이 없어 금융비용을 계산할 수 없습니다',
    };
  }

  const [year, monthNum] = normalizedMonth.split('-');
  const formattedMonthLabel = `${year}년 ${parseInt(monthNum, 10)}월`;

  const masterDebts = getAllMasterDebts(customOnboardingDebts || GlobalMockDataStore.getData().debts);

  const items: DebtFinancialCostItem[] = snapshotDebts.map((d) => {
    const principal = Number(d.openingPrincipal) || 0;
    
    // 마스터 부채 매칭
    const master = findMatchingMasterDebt(d, masterDebts);

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
    const rate = masterRate !== undefined ? masterRate : (snapshotRate !== undefined ? snapshotRate : 0);

    const hasRate = rate > 0;
    const monthlyInterest = calculateMonthlyInterest(principal, rate);

    const name = d.debtNameSnapshot || master?.debtName || master?.name || '부채';
    const creditor = master?.creditorName || master?.creditor || master?.lender || d.creditorNameSnapshot || '금융기관';
    const repaymentMethod =
      master?.repaymentMethod ||
      master?.repaymentType ||
      master?.paymentType ||
      master?.rateType ||
      d.repaymentMethod ||
      d.debtTypeSnapshot ||
      '원리금상환';

    const sourceTag = master
      ? `${formattedMonthLabel} 확정 스냅샷 잔액 + 기본정보 금리`
      : `${formattedMonthLabel} 확정 스냅샷 잔액 및 이율`;

    return {
      id: d.id,
      debtId: d.debtId,
      linkedDebtId: (d as any).linkedDebtId,
      name,
      creditor,
      principal,
      rate,
      hasRate,
      monthlyInterest,
      repaymentMethod,
      sourceTag,
      isHistorical: Boolean(d.isHistoricalOnly),
    };
  });

  const totalCost = items.reduce((sum, item) => sum + item.monthlyInterest, 0);

  return {
    hasSnapshot: true,
    totalCost,
    items,
  };
}
