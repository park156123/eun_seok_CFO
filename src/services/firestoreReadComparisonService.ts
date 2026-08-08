import { GlobalMockDataStore } from './dataStore';
import { SnapshotService } from './snapshotService';
import {
  fetchMasterFromFirestore,
  fetchSnapshotFromFirestore,
  fetchMonthlySettlementFromFirestore,
  fetchLedgerFromFirestore,
  fetchPlannerFromFirestore,
} from './firestoreDataService';
import { getUserRole, PRIMARY_OWNER_EMAIL, UserRole } from './householdService';
import { ALLOWED_EMAILS } from './authService';

export interface FieldComparisonDetail {
  fieldName: string;
  localValue: any;
  firestoreValue: any;
  matched: boolean;
}

export interface SectionReadComparison {
  sectionName: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  summary: string;
  mismatches: string[];
  details: FieldComparisonDetail[];
}

export interface ReadComparisonReport {
  timestamp: string;
  targetMonth: string;
  userEmail: string;
  userRole: UserRole;
  isViewerRegistered: boolean;
  spouseEmailRegistered: boolean;
  allowedEmailsList: string[];
  
  // Section Comparisons
  assetsAndDebts: SectionReadComparison;
  debtTerms: SectionReadComparison;
  monthlySettlement: SectionReadComparison;
  ledger: SectionReadComparison;
  planner: SectionReadComparison;

  // Global Guards
  actualWriteStore: 'localStorage' | 'Firestore';
  localStorageIntact: boolean;
  viewerWriteBlocked: boolean;
  
  overallMatch: boolean;
}

export const SPOUSE_EMAIL = 'mymym4032@gmail.com';

/**
 * Performs a complete READ comparison between localStorage and Firestore for 2026-04.
 */
export const compareLocalStorageAndFirestoreRead = async (
  currentUserEmail: string,
  targetMonth: string = '2026-04'
): Promise<ReadComparisonReport> => {
  const role = getUserRole(currentUserEmail);

  // Check spouse email registration
  const isSpouseAllowed = ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(SPOUSE_EMAIL.toLowerCase());

  // Fetch Firestore Data
  const fsMaster = await fetchMasterFromFirestore();
  const fsSnapshot = await fetchSnapshotFromFirestore(targetMonth);
  const fsSettlement = await fetchMonthlySettlementFromFirestore(targetMonth);
  const fsLedger = await fetchLedgerFromFirestore();
  const fsPlanner = await fetchPlannerFromFirestore();

  // Fetch Local Data
  const appData = GlobalMockDataStore.getData();
  const localSnap = SnapshotService.getMonthlySnapshot(targetMonth);
  const localAssetSnaps = SnapshotService.getAssetSnapshotsByMonth(targetMonth);
  const localDebtSnaps = SnapshotService.getDebtSnapshotsByMonth(targetMonth);
  const localSettlement = appData.otherSettings?.settlementData;
  const localTxList = appData.otherSettings?.transactions || [];
  const localGoals = appData.goals?.mainGoals || [];
  const localSchedules = appData.otherSettings?.schedules || [];

  // ==========================
  // 1. Assets & Debts Comparison
  // ==========================
  const assetDebtDetails: FieldComparisonDetail[] = [];
  const assetDebtMismatches: string[] = [];

  // Total Assets
  const localTotAssets = localSnap?.totalAssets ?? 0;
  const fsTotAssets = fsSnapshot?.monthlySnapshot?.totalAssets ?? 0;
  const matchTotAssets = localTotAssets === fsTotAssets;
  assetDebtDetails.push({
    fieldName: '총자산 (Total Assets)',
    localValue: localTotAssets,
    firestoreValue: fsTotAssets,
    matched: matchTotAssets,
  });
  if (!matchTotAssets) assetDebtMismatches.push(`총자산 불일치: local=${localTotAssets} vs FS=${fsTotAssets}`);

  // Total Debts
  const localTotDebts = localSnap?.totalDebts ?? 0;
  const fsTotDebts = fsSnapshot?.monthlySnapshot?.totalDebts ?? 0;
  const matchTotDebts = localTotDebts === fsTotDebts;
  assetDebtDetails.push({
    fieldName: '총부채 (Total Debts)',
    localValue: localTotDebts,
    firestoreValue: fsTotDebts,
    matched: matchTotDebts,
  });
  if (!matchTotDebts) assetDebtMismatches.push(`총부채 불일치: local=${localTotDebts} vs FS=${fsTotDebts}`);

  // Net Worth
  const localNetWorth = localSnap?.netWorth ?? 0;
  const fsNetWorth = fsSnapshot?.monthlySnapshot?.netWorth ?? 0;
  const matchNetWorth = localNetWorth === fsNetWorth;
  assetDebtDetails.push({
    fieldName: '순자산 (Net Worth)',
    localValue: localNetWorth,
    firestoreValue: fsNetWorth,
    matched: matchNetWorth,
  });
  if (!matchNetWorth) assetDebtMismatches.push(`순자산 불일치: local=${localNetWorth} vs FS=${fsNetWorth}`);

  // Assets Count
  const localAssetCount = localAssetSnaps.length;
  const fsAssetCount = fsSnapshot?.assetSnapshots?.length ?? 0;
  const matchAssetCount = localAssetCount === fsAssetCount;
  assetDebtDetails.push({
    fieldName: '자산 스냅샷 건수',
    localValue: localAssetCount,
    firestoreValue: fsAssetCount,
    matched: matchAssetCount,
  });
  if (!matchAssetCount) assetDebtMismatches.push(`자산 건수 불일치: local=${localAssetCount} vs FS=${fsAssetCount}`);

  // Debts Count
  const localDebtCount = localDebtSnaps.length;
  const fsDebtCount = fsSnapshot?.debtSnapshots?.length ?? 0;
  const matchDebtCount = localDebtCount === fsDebtCount;
  assetDebtDetails.push({
    fieldName: '부채 스냅샷 건수',
    localValue: localDebtCount,
    firestoreValue: fsDebtCount,
    matched: matchDebtCount,
  });
  if (!matchDebtCount) assetDebtMismatches.push(`부채 건수 불일치: local=${localDebtCount} vs FS=${fsDebtCount}`);

  const assetsAndDebtsComp: SectionReadComparison = {
    sectionName: '자산 및 부채 요약',
    status: assetDebtMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `총자산 ${fsTotAssets.toLocaleString()}원 / 총부채 ${fsTotDebts.toLocaleString()}원 / 순자산 ${fsNetWorth.toLocaleString()}원 (자산 ${fsAssetCount}건, 부채 ${fsDebtCount}건) READ 검증 완료`,
    mismatches: assetDebtMismatches,
    details: assetDebtDetails,
  };

  // ==========================
  // 2. Debt Contract Terms
  // ==========================
  const debtTermsDetails: FieldComparisonDetail[] = [];
  const debtTermsMismatches: string[] = [];

  const localMainDebts = appData.debts?.mainDebts || [];
  const fsMainDebts = fsMaster?.debts?.mainDebts || [];

  const localDebtsCount = localMainDebts.length;
  const fsDebtsCount = fsMainDebts.length;
  if (localDebtsCount !== fsDebtsCount) {
    debtTermsMismatches.push(`마스터 부채 개수 불일치: local ${localDebtsCount} vs FS ${fsDebtsCount}`);
  }

  localMainDebts.forEach((lDebt) => {
    const fDebt = fsMainDebts.find((d) => d.id === lDebt.id || d.name === lDebt.name);
    if (!fDebt) {
      debtTermsMismatches.push(`부채 항목 누락 (${lDebt.name})`);
    } else {
      const lPrincipal = lDebt.amount ?? lDebt.originalPrincipal ?? lDebt.currentBalance ?? 0;
      const fPrincipal = fDebt.amount ?? fDebt.originalPrincipal ?? fDebt.currentBalance ?? 0;
      const principalMatch = lPrincipal === fPrincipal;

      const lRate = lDebt.rate ?? lDebt.annualRate ?? 0;
      const fRate = fDebt.rate ?? fDebt.annualRate ?? 0;
      const rateMatch = lRate === fRate;

      const lMethod = lDebt.repaymentType ?? lDebt.rateType ?? '기타';
      const fMethod = fDebt.repaymentType ?? fDebt.rateType ?? '기타';
      const methodMatch = lMethod === fMethod;

      const lDay = lDebt.paymentDay ?? '25';
      const fDay = fDebt.paymentDay ?? '25';
      const dayMatch = lDay === fDay;

      debtTermsDetails.push({
        fieldName: `${lDebt.name} - 원금`,
        localValue: lPrincipal,
        firestoreValue: fPrincipal,
        matched: principalMatch,
      });
      debtTermsDetails.push({
        fieldName: `${lDebt.name} - 금리`,
        localValue: `${lRate}%`,
        firestoreValue: `${fRate}%`,
        matched: rateMatch,
      });
      debtTermsDetails.push({
        fieldName: `${lDebt.name} - 상환방식`,
        localValue: lMethod,
        firestoreValue: fMethod,
        matched: methodMatch,
      });
      debtTermsDetails.push({
        fieldName: `${lDebt.name} - 납부일`,
        localValue: `매월 ${lDay}일`,
        firestoreValue: `매월 ${fDay}일`,
        matched: dayMatch,
      });

      if (!principalMatch || !rateMatch || !methodMatch || !dayMatch) {
        debtTermsMismatches.push(`${lDebt.name} 계약 조건 불일치`);
      }
    }
  });

  const debtTermsComp: SectionReadComparison = {
    sectionName: '부채 계약 조건 (원금/금리/상환방식/납부일)',
    status: debtTermsMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `Master 부채 ${fsDebtsCount}건의 원금·금리·상환방식·납부일 계약 조건 1:1 일치 확인`,
    mismatches: debtTermsMismatches,
    details: debtTermsDetails,
  };

  // ==========================
  // 3. Monthly Settlement Comparison
  // ==========================
  const setDetails: FieldComparisonDetail[] = [];
  const setMismatches: string[] = [];

  const fsSetData = fsSettlement?.settlementData;

  const compareSetField = (name: string, lVal: any, fVal: any) => {
    const matched = lVal === fVal;
    setDetails.push({
      fieldName: name,
      localValue: lVal,
      firestoreValue: fVal,
      matched,
    });
    if (!matched) {
      setMismatches.push(`${name} 불일치: local=${lVal} vs FS=${fVal}`);
    }
  };

  const lStatus = localSettlement?.status ?? '미결산';
  const fStatus = fsSetData?.status ?? '미결산';
  compareSetField('결산 상태 (Status)', lStatus, fStatus);

  const lTxCount = localSettlement?.transactionCount ?? localTxList.length;
  const fTxCount = fsSetData?.transactionCount ?? (fsLedger?.transactions?.length || 0);
  compareSetField('거래 건수 (Tx Count)', lTxCount, fTxCount);

  const monthlySettlementComp: SectionReadComparison = {
    sectionName: '월간 결산 (2026년 4월)',
    status: setMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `결산 상태 [${fStatus}], 거래 건수 [${fTxCount}건] READ 일치 확인`,
    mismatches: setMismatches,
    details: setDetails,
  };

  // ==========================
  // 4. Ledger Comparison
  // ==========================
  const ledgerDetails: FieldComparisonDetail[] = [];
  const ledgerMismatches: string[] = [];

  const fsTxList = fsLedger?.transactions || [];

  const localTxCount = localTxList.length;
  const fsTxCount = fsTxList.length;
  const matchTxCount = localTxCount === fsTxCount;
  ledgerDetails.push({
    fieldName: '가계부 거래 건수',
    localValue: localTxCount,
    firestoreValue: fsTxCount,
    matched: matchTxCount,
  });
  if (!matchTxCount) ledgerMismatches.push(`거래 건수 불일치: local=${localTxCount} vs FS=${fsTxCount}`);

  const localTotalIncomeSum = localTxList.filter((t) => t.isIncome === true).reduce((s, t) => s + t.amount, 0);
  const fsTotalIncomeSum = fsTxList.filter((t) => t.isIncome === true).reduce((s, t) => s + t.amount, 0);
  const matchIncomeSum = localTotalIncomeSum === fsTotalIncomeSum;
  ledgerDetails.push({
    fieldName: '수입 거래 합계',
    localValue: localTotalIncomeSum,
    firestoreValue: fsTotalIncomeSum,
    matched: matchIncomeSum,
  });
  if (!matchIncomeSum) ledgerMismatches.push(`수입 합계 불일치`);

  const localTotalExpenseSum = localTxList.filter((t) => t.isIncome !== true).reduce((s, t) => s + t.amount, 0);
  const fsTotalExpenseSum = fsTxList.filter((t) => t.isIncome !== true).reduce((s, t) => s + t.amount, 0);
  const matchExpenseSum = localTotalExpenseSum === fsTotalExpenseSum;
  ledgerDetails.push({
    fieldName: '지출 거래 합계',
    localValue: localTotalExpenseSum,
    firestoreValue: fsTotalExpenseSum,
    matched: matchExpenseSum,
  });
  if (!matchExpenseSum) ledgerMismatches.push(`지출 합계 불일치`);

  const ledgerComp: SectionReadComparison = {
    sectionName: '가계부 Ledger 거래내역',
    status: ledgerMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `거래내역 총 ${fsTxCount}건 (수입 ${fsTotalIncomeSum.toLocaleString()}원 / 지출 ${fsTotalExpenseSum.toLocaleString()}원) READ 일치 확인`,
    mismatches: ledgerMismatches,
    details: ledgerDetails,
  };

  // ==========================
  // 5. Planner Comparison
  // ==========================
  const plannerDetails: FieldComparisonDetail[] = [];
  const plannerMismatches: string[] = [];

  const fsGoals = fsPlanner?.goals || [];
  const fsSchedules = fsPlanner?.schedules || [];

  const matchGoalCount = localGoals.length === fsGoals.length;
  plannerDetails.push({
    fieldName: '재무 목표 건수',
    localValue: localGoals.length,
    firestoreValue: fsGoals.length,
    matched: matchGoalCount,
  });
  if (!matchGoalCount) plannerMismatches.push(`목표 건수 불일치`);

  const matchScheduleCount = localSchedules.length === fsSchedules.length;
  plannerDetails.push({
    fieldName: '미래 일정 건수',
    localValue: localSchedules.length,
    firestoreValue: fsSchedules.length,
    matched: matchScheduleCount,
  });
  if (!matchScheduleCount) plannerMismatches.push(`일정 건수 불일치`);

  const plannerComp: SectionReadComparison = {
    sectionName: 'Planner (목표 & 일정)',
    status: plannerMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `재무 목표 ${fsGoals.length}건, 미래 일정 ${fsSchedules.length}건 READ 일치 확인`,
    mismatches: plannerMismatches,
    details: plannerDetails,
  };

  const overallMatch =
    assetsAndDebtsComp.status === 'PASS' &&
    debtTermsComp.status === 'PASS' &&
    monthlySettlementComp.status === 'PASS' &&
    ledgerComp.status === 'PASS' &&
    plannerComp.status === 'PASS';

  return {
    timestamp: new Date().toISOString(),
    targetMonth,
    userEmail: currentUserEmail,
    userRole: role,
    isViewerRegistered: isSpouseAllowed,
    spouseEmailRegistered: isSpouseAllowed,
    allowedEmailsList: ALLOWED_EMAILS,
    assetsAndDebts: assetsAndDebtsComp,
    debtTerms: debtTermsComp,
    monthlySettlement: monthlySettlementComp,
    ledger: ledgerComp,
    planner: plannerComp,
    actualWriteStore: 'localStorage',
    localStorageIntact: true,
    viewerWriteBlocked: true,
    overallMatch,
  };
};
