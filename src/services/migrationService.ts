import { GlobalMockDataStore } from './dataStore';
import { SnapshotService } from './snapshotService';
import {
  saveMasterToFirestore,
  fetchMasterFromFirestore,
  saveSnapshotToFirestore,
  fetchSnapshotFromFirestore,
  saveMonthlySettlementToFirestore,
  fetchMonthlySettlementFromFirestore,
  saveLedgerToFirestore,
  fetchLedgerFromFirestore,
  savePlannerToFirestore,
  fetchPlannerFromFirestore,
  MasterData,
} from './firestoreDataService';
import { getUserRole, PRIMARY_OWNER_EMAIL } from './householdService';

export interface SectionComparison {
  status: 'PASS' | 'WARNING' | 'FAIL';
  summary: string;
  sourceValues: Record<string, any>;
  firestoreValues: Record<string, any>;
  mismatches: string[];
}

export interface MigrationReport {
  executed: boolean;
  timestamp: string;
  ownerEmail: string;
  isOwnerVerified: boolean;
  pathsCreated: string[];
  master: SectionComparison;
  snapshotApril: SectionComparison;
  settlementApril: SectionComparison;
  ledger: SectionComparison;
  planner: SectionComparison;
  localStorageAffected: boolean;
  otherMonthsMigrated: boolean;
  duplicateDocsCreated: boolean;
  overallVerdict: 'PASS' | 'WARNING' | 'FAIL';
}

/**
 * Performs a safe, one-way copy of 2026-04 actual data from localStorage to Firestore.
 * Does NOT delete or alter localStorage in any way.
 */
export const runAprilOneWayMigration = async (userEmail: string): Promise<MigrationReport> => {
  const role = getUserRole(userEmail);
  const isOwner = role === 'owner' && userEmail.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase();

  if (!isOwner) {
    throw new Error('Migration is strictly allowed for the OWNER account only.');
  }

  // 1. Gather Source Data from LocalStore & SnapshotService
  const appData = GlobalMockDataStore.getData();
  
  // Master
  const masterSourceData: MasterData = {
    userInfo: appData.userInfo,
    assets: appData.assets,
    debts: appData.debts,
    monthlyIncome: appData.monthlyIncome,
    fixedExpenses: appData.fixedExpenses,
    financialProducts: appData.financialProducts,
    businessInfo: appData.businessInfo,
    rules: appData.rules,
  };

  // Snapshot 2026-04
  const aprilSnapshot = SnapshotService.getMonthlySnapshot('2026-04');
  const aprilAssetSnapshots = SnapshotService.getAssetSnapshotsByMonth('2026-04');
  const aprilDebtSnapshots = SnapshotService.getDebtSnapshotsByMonth('2026-04');
  const aprilDebtMovements = SnapshotService.getMonthlyDebtMovements('2026-04');

  // Settlement 2026-04
  const aprilSettlement = appData.otherSettings?.settlementData;

  // Ledger
  const transactions = appData.otherSettings?.transactions || [];
  const activeCsvSession = (appData.otherSettings as any)?.activeCsvSession;

  // Planner
  const goals = appData.goals?.mainGoals || [];
  const onboardingGoals = appData.goals?.onboardingGoals || [];
  const schedules = appData.otherSettings?.schedules || [];

  // 2. Write to Firestore
  const pathsCreated = [
    'households/family_cfo/master/current',
    'households/family_cfo/snapshots/2026-04',
    'households/family_cfo/monthlySettlements/2026-04',
    'households/family_cfo/ledger/current',
    'households/family_cfo/planner/current',
  ];

  await saveMasterToFirestore(masterSourceData);

  if (aprilSnapshot) {
    await saveSnapshotToFirestore('2026-04', {
      monthlySnapshot: aprilSnapshot,
      assetSnapshots: aprilAssetSnapshots,
      debtSnapshots: aprilDebtSnapshots,
      debtMovements: aprilDebtMovements,
    });
  }

  if (aprilSettlement) {
    await saveMonthlySettlementToFirestore('2026-04', aprilSettlement, aprilSettlement.lastUpdated);
  }

  await saveLedgerToFirestore({
    transactions,
    activeCsvSession,
  });

  await savePlannerToFirestore({
    goals,
    onboardingGoals,
    schedules,
  });

  // 3. Read back from Firestore for Verification
  const fsMaster = await fetchMasterFromFirestore();
  const fsSnapshot = await fetchSnapshotFromFirestore('2026-04');
  const fsSettlement = await fetchMonthlySettlementFromFirestore('2026-04');
  const fsLedger = await fetchLedgerFromFirestore();
  const fsPlanner = await fetchPlannerFromFirestore();

  // 4. Compare Master
  const masterSourceAssetCount = (appData.assets?.mainAssets?.length || 0) + (appData.assets?.onboardingAssets?.length || 0);
  const masterFsAssetCount = (fsMaster?.assets?.mainAssets?.length || 0) + (fsMaster?.assets?.onboardingAssets?.length || 0);

  const masterSourceDebtCount = (appData.debts?.mainDebts?.length || 0) + (appData.debts?.onboardingDebts?.length || 0);
  const masterFsDebtCount = (fsMaster?.debts?.mainDebts?.length || 0) + (fsMaster?.debts?.onboardingDebts?.length || 0);

  const masterSourceIncomeCount = appData.monthlyIncome?.incomeSources?.length || 0;
  const masterFsIncomeCount = fsMaster?.monthlyIncome?.incomeSources?.length || 0;

  const masterMismatches: string[] = [];
  if (masterSourceAssetCount !== masterFsAssetCount) masterMismatches.push(`Asset count mismatch: local ${masterSourceAssetCount} vs FS ${masterFsAssetCount}`);
  if (masterSourceDebtCount !== masterFsDebtCount) masterMismatches.push(`Debt count mismatch: local ${masterSourceDebtCount} vs FS ${masterFsDebtCount}`);
  if (masterSourceIncomeCount !== masterFsIncomeCount) masterMismatches.push(`Income source count mismatch: local ${masterSourceIncomeCount} vs FS ${masterFsIncomeCount}`);

  const masterComp: SectionComparison = {
    status: masterMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `자산 ${masterFsAssetCount}건, 부채 ${masterFsDebtCount}건, 수입원 ${masterFsIncomeCount}건 복사 완료`,
    sourceValues: { assetCount: masterSourceAssetCount, debtCount: masterSourceDebtCount, incomeCount: masterSourceIncomeCount },
    firestoreValues: { assetCount: masterFsAssetCount, debtCount: masterFsDebtCount, incomeCount: masterFsIncomeCount },
    mismatches: masterMismatches,
  };

  // 5. Compare Snapshot 2026-04
  const snapMismatches: string[] = [];
  const sourceSnap = aprilSnapshot;
  const fsSnapObj = fsSnapshot?.monthlySnapshot;

  if (sourceSnap?.totalAssets !== fsSnapObj?.totalAssets) snapMismatches.push(`totalAssets mismatch`);
  if (sourceSnap?.totalDebts !== fsSnapObj?.totalDebts) snapMismatches.push(`totalDebts mismatch`);
  if (sourceSnap?.netWorth !== fsSnapObj?.netWorth) snapMismatches.push(`netWorth mismatch`);
  if (aprilAssetSnapshots.length !== (fsSnapshot?.assetSnapshots?.length || 0)) snapMismatches.push(`Asset snapshots count mismatch`);
  if (aprilDebtSnapshots.length !== (fsSnapshot?.debtSnapshots?.length || 0)) snapMismatches.push(`Debt snapshots count mismatch`);

  const snapComp: SectionComparison = {
    status: snapMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `총자산 ${(fsSnapObj?.totalAssets ?? 0).toLocaleString()}원, 총부채 ${(fsSnapObj?.totalDebts ?? 0).toLocaleString()}원, 순자산 ${(fsSnapObj?.netWorth ?? 0).toLocaleString()}원 복사 완료`,
    sourceValues: {
      totalAssets: sourceSnap?.totalAssets,
      totalDebts: sourceSnap?.totalDebts,
      netWorth: sourceSnap?.netWorth,
      assetCount: aprilAssetSnapshots.length,
      debtCount: aprilDebtSnapshots.length,
    },
    firestoreValues: {
      totalAssets: fsSnapObj?.totalAssets,
      totalDebts: fsSnapObj?.totalDebts,
      netWorth: fsSnapObj?.netWorth,
      assetCount: fsSnapshot?.assetSnapshots?.length || 0,
      debtCount: fsSnapshot?.debtSnapshots?.length || 0,
    },
    mismatches: snapMismatches,
  };

  // 6. Compare Settlement 2026-04
  const setMismatches: string[] = [];
  const sourceSet = aprilSettlement;
  const fsSetObj = fsSettlement?.settlementData;

  if (sourceSet?.status !== fsSetObj?.status) setMismatches.push(`Settlement status mismatch`);
  if (sourceSet?.transactionCount !== fsSetObj?.transactionCount) setMismatches.push(`Transaction count mismatch`);

  const setComp: SectionComparison = {
    status: setMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `결산 상태: ${fsSetObj?.status || '미결산'}, 거래수: ${fsSetObj?.transactionCount || 0}건 복사 완료`,
    sourceValues: { status: sourceSet?.status, targetMonth: sourceSet?.targetMonth, transactionCount: sourceSet?.transactionCount },
    firestoreValues: { status: fsSetObj?.status, targetMonth: fsSetObj?.targetMonth, transactionCount: fsSetObj?.transactionCount },
    mismatches: setMismatches,
  };

  // 7. Compare Ledger
  const ledgerMismatches: string[] = [];
  const sourceTxCount = transactions.length;
  const fsTxCount = fsLedger?.transactions?.length || 0;
  if (sourceTxCount !== fsTxCount) ledgerMismatches.push(`Transactions count mismatch: local ${sourceTxCount} vs FS ${fsTxCount}`);

  const ledgerComp: SectionComparison = {
    status: ledgerMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `거래내역 ${fsTxCount}건 복사 완료`,
    sourceValues: { txCount: sourceTxCount },
    firestoreValues: { txCount: fsTxCount },
    mismatches: ledgerMismatches,
  };

  // 8. Compare Planner
  const plannerMismatches: string[] = [];
  const sourceSchedCount = schedules.length;
  const fsSchedCount = fsPlanner?.schedules?.length || 0;
  if (sourceSchedCount !== fsSchedCount) plannerMismatches.push(`Schedules count mismatch: local ${sourceSchedCount} vs FS ${fsSchedCount}`);

  const plannerComp: SectionComparison = {
    status: plannerMismatches.length === 0 ? 'PASS' : 'FAIL',
    summary: `일정 ${fsSchedCount}건, 목표 ${fsPlanner?.goals?.length || 0}건 복사 완료`,
    sourceValues: { schedCount: sourceSchedCount, goalCount: goals.length },
    firestoreValues: { schedCount: fsSchedCount, goalCount: fsPlanner?.goals?.length || 0 },
    mismatches: plannerMismatches,
  };

  const allPass =
    masterComp.status === 'PASS' &&
    snapComp.status === 'PASS' &&
    setComp.status === 'PASS' &&
    ledgerComp.status === 'PASS' &&
    plannerComp.status === 'PASS';

  return {
    executed: true,
    timestamp: new Date().toISOString(),
    ownerEmail: userEmail,
    isOwnerVerified: isOwner,
    pathsCreated,
    master: masterComp,
    snapshotApril: snapComp,
    settlementApril: setComp,
    ledger: ledgerComp,
    planner: plannerComp,
    localStorageAffected: false,
    otherMonthsMigrated: false,
    duplicateDocsCreated: false,
    overallVerdict: allPass ? 'PASS' : 'FAIL',
  };
};
