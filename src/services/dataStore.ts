import {
  AppData,
  UserInfo,
  OnboardingAsset,
  Asset,
  OnboardingDebt,
  Debt,
  MonthlyLoanPayment,
  IncomeSource,
  IncomeRecord,
  FixedExpenseItem,
  FinancialProductItem,
  OnboardingGoal,
  Goal,
  BusinessInfo,
  SettlementData,
  ScheduleEvent,
  Transaction,
  UserPreferences,
  MerchantRule,
  CategoryRule,
  ExclusionRule,
  ActiveCsvSession,
} from '../types';
import { resolveSpecialNotes } from '../utils/resolveSpecialNotes';

import {
  INITIAL_TRANSACTIONS,
  INITIAL_ASSETS,
  INITIAL_DEBTS,
  INITIAL_GOALS,
  INITIAL_SCHEDULES,
} from '../initialData';
import {
  INITIAL_MERCHANT_RULES,
  INITIAL_EXCLUSION_RULES,
  INITIAL_CATEGORY_RULES,
} from '../data/initialClassificationRules';
import {
  loadMerchantRules,
  loadCategoryRules,
  loadExclusionRules,
} from '../data/ruleLoader';
import { calculateCurrentDebtPayment } from '../utils/debtCalculator';
import { normalizeIncomeSource } from '../utils/incomeUtils';
import { isConsumerTransaction } from '../utils/consumerExpenseUtils';

import {
  normalizeMerchantName,
  reclassifyTransactions,
} from '../utils/transactionClassifier';
import { SnapshotService } from './snapshotService';
import {
  MonthlySnapshot,
  AssetSnapshot,
  DebtSnapshot,
  MonthlyDebtMovement,
} from '../types';
import { auth } from './firebase';
import { getUserRole } from './householdService';
import {
  fetchMasterFromFirestore,
  fetchLedgerFromFirestore,
  fetchPlannerFromFirestore,
  fetchMonthlySettlementFromFirestore,
  fetchAllMonthlySettlementRecordsFromFirestore,
  backfillLocalMonthlySettlementsToFirestore,
  fetchAllSnapshotsFromFirestore,
  saveMasterToFirestore,
  saveLedgerToFirestore,
  savePlannerToFirestore,
  saveAllToFirestoreFromAppData,
  saveSnapshotToFirestore,
  MasterData,
} from './firestoreDataService';

// Storage key for persistent mock data in browser session/local storage
const LOCAL_STORAGE_KEY = 'cfo_global_mock_datastore_v1';

const DEFAULT_INITIAL_INCOME_SOURCES: IncomeSource[] = [
  {
    id: 'inc-1',
    name: '미용실 본점',
    incomeName: '미용실 본점',
    incomeType: '사업소득',
    incomeMode: 'variable',
    owner: '본인',
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'inc-2',
    name: '미용실 2호점',
    incomeName: '미용실 2호점',
    incomeType: '사업소득',
    incomeMode: 'variable',
    owner: '본인',
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'inc-3',
    name: '게스트하우스1',
    incomeName: '게스트하우스1',
    incomeType: '사업소득',
    incomeMode: 'variable',
    owner: '본인',
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'inc-4',
    name: '현하우스 임대료',
    incomeName: '현하우스 임대료',
    incomeType: '임대소득',
    incomeMode: 'fixed',
    fixedMonthlyIncome: 4180000,
    owner: '본인',
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const DEFAULT_INITIAL_INCOME_RECORDS: IncomeRecord[] = [];

const initNow = new Date();
const initYear = initNow.getFullYear();
const initMonth = initNow.getMonth() + 1;
const initPrevMonth = initMonth === 1 ? 12 : initMonth - 1;
const initPrevYear = initMonth === 1 ? initYear - 1 : initYear;

// Initial default state structured for seamless Firebase migration (Clean 0 defaults)
export const INITIAL_APP_DATA: AppData = {
  // 1. 사용자 정보
  userInfo: {
    profileName: '박은석',
    email: 'park156123@gmail.com',
    householdName: '은석네 가족',
    familyMembers: [],
  },

  // 2. 자산 (기본 설정 자산 + 상세 자산)
  assets: {
    onboardingAssets: [],
    mainAssets: [],
  },

  // 3. 부채 (기본 설정 부채 + 상세 부채)
  debts: {
    onboardingDebts: [],
    mainDebts: [],
  },

  // 4. 월수입 (수입원)
  monthlyIncome: {
    incomeSources: DEFAULT_INITIAL_INCOME_SOURCES,
    incomeRecords: DEFAULT_INITIAL_INCOME_RECORDS,
  },

  // 5. 고정지출
  fixedExpenses: [],

  // 6. 금융상품
  financialProducts: [],

  // 7. 목표
  goals: {
    onboardingGoals: [],
    mainGoals: [],
  },

  // 8. 사업정보
  businessInfo: {
    businessName: '',
    businessType: '개인사업자',
    monthlyRevenue: 0,
    monthlyExpense: 0,
    memo: '',
  },

  // 자동분류 규칙
  rules: {
    merchantRules: INITIAL_MERCHANT_RULES,
    categoryRules: INITIAL_CATEGORY_RULES,
    exclusionRules: INITIAL_EXCLUSION_RULES,
  },

  // 9. 기타 설정
  otherSettings: {
    settlementData: {
      hasData: false,
      targetMonth: `${initYear}년 ${initMonth}월`,
      status: '미결산',
      baseMonth: `${initPrevYear}년 ${initPrevMonth}월 결산`,
      transactionCount: 0,
      lastUpdated: '-',
    },
    schedules: INITIAL_SCHEDULES,
    transactions: INITIAL_TRANSACTIONS,
    preferences: {
      theme: 'light',
      currency: 'KRW',
      notificationEnabled: true,
    },
  },
};

/**
 * Singleton Class representing the Global In-Memory Mock Data Store.
 * Standardized with `IDataStore` interface so that replacing it with
 * `FirebaseDataStore` in the future requires zero changes to the UI layer.
 */
class GlobalMockDataStoreImpl implements IDataStore {
  private data: AppData;
  private listeners: Set<(data: AppData) => void> = new Set();

  private lastFirestoreError: string | null = null;
  private lastFirestoreSaveTime: string | null = null;
  private errorListeners: Set<(errMessage: string) => void> = new Set();

  constructor() {
    this.data = this.loadFromStorage();
    // Automatically trigger Firestore READ sync on load if online
    this.syncWithFirestore();
  }

  public subscribeError(listener: (errMessage: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private notifyErrorListeners(msg: string): void {
    this.errorListeners.forEach((l) => l(msg));
  }

  public getFirestoreWriteStatus() {
    return {
      lastSaveTime: this.lastFirestoreSaveTime,
      lastError: this.lastFirestoreError,
    };
  }

  public async syncWithFirestore(): Promise<boolean> {
    try {
      const fsMaster = await fetchMasterFromFirestore();
      const fsLedger = await fetchLedgerFromFirestore();
      const fsPlanner = await fetchPlannerFromFirestore();
      const fsSettlement = await fetchMonthlySettlementFromFirestore('2026-04');
      const fsSnapshots = await fetchAllSnapshotsFromFirestore();
      const fsSettlementRecords = await fetchAllMonthlySettlementRecordsFromFirestore();

      if (fsSettlementRecords && Object.keys(fsSettlementRecords).length > 0) {
        try {
          const localSaved = localStorage.getItem('cfo_monthly_records_v3');
          const localMap = localSaved ? JSON.parse(localSaved) : {};
          const merged: Record<string, any> = {};

          // First migrate localMap keys to YYYY-MM
          Object.entries(localMap).forEach(([k, v]) => {
            const match = k.match(/(\d{4})년\s*(\d{1,2})월/);
            const keyNorm = match ? `${match[1]}-${String(match[2]).padStart(2, '0')}` : k;
            merged[keyNorm] = v;
          });

          // Apply Firestore records (Firestore primary override, except if local is richer or locked/completed)
          Object.entries(fsSettlementRecords).forEach(([k, v]) => {
            const match = k.match(/(\d{4})년\s*(\d{1,2})월/);
            const keyNorm = match ? `${match[1]}-${String(match[2]).padStart(2, '0')}` : k;
            const existingLocal = merged[keyNorm];

            const localIsLocked = existingLocal?.status === '결산잠금' || existingLocal?.status === '완료';
            const remoteIsLocked = (v as any)?.status === '결산잠금' || (v as any)?.status === '완료';

            if (localIsLocked && !remoteIsLocked) {
              // Protect local locked/completed record from being overwritten by remote stale record
              return;
            }

            const notesRes = resolveSpecialNotes(existingLocal, v as any);

            if (existingLocal && existingLocal.incomes && existingLocal.incomes.length > 0 && Number(existingLocal.totalIncome) > 0) {
              const fsIncomes = (v as any)?.incomes || [];
              const fsTotalIncome = Number((v as any)?.totalIncome) || 0;
              if (fsIncomes.length < existingLocal.incomes.length || fsTotalIncome === 0) {
                merged[keyNorm] = {
                  ...(v as any),
                  incomes: existingLocal.incomes,
                  totalIncome: existingLocal.totalIncome,
                  netCashFlow: Number(existingLocal.totalIncome) - (Number((v as any)?.totalCashOutflow ?? (v as any)?.totalOutflow) || 0),
                  specialNotes: notesRes.specialNotes,
                  noteConfirmedAt: notesRes.noteConfirmedAt,
                };
                return;
              }
            }
            merged[keyNorm] = {
              ...(v as any),
              specialNotes: notesRes.specialNotes,
              noteConfirmedAt: notesRes.noteConfirmedAt,
            };
          });

          // Sanitize legacy income mismatch (totalIncome === 0 while incomes sum > 0)
          Object.entries(merged).forEach(([k, rec]: [string, any]) => {
            if (rec && typeof rec === 'object') {
              const incSum = (rec.incomes || []).reduce(
                (sum: number, inc: any) => sum + (Number(inc.amount) || 0),
                0
              );
              if ((rec.totalIncome === 0 || rec.totalIncome === undefined) && (rec.incomes || []).length > 0 && incSum > 0) {
                rec.totalIncome = incSum;
                const outflow = Number(rec.totalCashOutflow ?? rec.totalOutflow) || 0;
                rec.netCashFlow = incSum - outflow;
              }
            }
          });

          localStorage.setItem('cfo_monthly_records_v3', JSON.stringify(merged));
          this.notifyListeners();
        } catch (e) {
          console.error('Error updating cfo_monthly_records_v3 cache:', e);
        }
      }

      // Safe Backfill: if browser local storage has confirmed 2026-04 settlement record that is missing on Firestore
      await backfillLocalMonthlySettlementsToFirestore(fsSettlementRecords || {});

      if (fsSnapshots && Object.keys(fsSnapshots).length > 0) {
        Object.entries(fsSnapshots).forEach(([monthKey, snapDoc]) => {
          if (snapDoc && snapDoc.monthlySnapshot) {
            SnapshotService.saveMonthlySnapshot(snapDoc.monthlySnapshot);
            if (snapDoc.assetSnapshots) {
              SnapshotService.saveAssetSnapshots(monthKey, snapDoc.assetSnapshots);
            }
            if (snapDoc.debtSnapshots) {
              SnapshotService.saveDebtSnapshots(monthKey, snapDoc.debtSnapshots);
            }
            if (snapDoc.debtMovements) {
              snapDoc.debtMovements.forEach((m) => SnapshotService.saveMonthlyDebtMovement(m));
            }
          }
        });
      }

      if (fsMaster || fsLedger || fsPlanner || (fsSnapshots && Object.keys(fsSnapshots).length > 0) || (fsSettlementRecords && Object.keys(fsSettlementRecords).length > 0)) {
        if (fsMaster?.userInfo) this.data.userInfo = { ...this.data.userInfo, ...fsMaster.userInfo };
        if (fsMaster?.assets) this.data.assets = fsMaster.assets;
        if (fsMaster?.debts) this.data.debts = fsMaster.debts;
        if (fsMaster?.monthlyIncome) this.data.monthlyIncome = fsMaster.monthlyIncome;
        if (fsMaster?.fixedExpenses) this.data.fixedExpenses = fsMaster.fixedExpenses;
        if (fsMaster?.financialProducts) this.data.financialProducts = fsMaster.financialProducts;
        if (fsMaster?.businessInfo) this.data.businessInfo = fsMaster.businessInfo;
        if (fsMaster?.rules) this.data.rules = fsMaster.rules as any;

        if (fsLedger?.transactions) {
          this.data.otherSettings.transactions = fsLedger.transactions;
          if (fsLedger.activeCsvSession) {
            this.data.otherSettings.activeCsvSession = fsLedger.activeCsvSession;
          }
        }

        if (fsPlanner?.goals) this.data.goals.mainGoals = fsPlanner.goals;
        if (fsPlanner?.onboardingGoals) this.data.goals.onboardingGoals = fsPlanner.onboardingGoals;
        if (fsPlanner?.schedules) this.data.otherSettings.schedules = fsPlanner.schedules;

        if (fsSettlement?.settlementData) {
          this.data.otherSettings.settlementData = fsSettlement.settlementData;
        }

        this.notifyListeners();
        return true;
      }
    } catch (err) {
      console.warn('Firestore Primary READ 동기화 실패. localStorage fallback 안전 유지:', err);
    }
    return false;
  }

  public saveToStorage(options?: { domain?: 'all' | 'ledger' | 'ledger_and_master' | 'master' | 'planner' | 'none' }): void {
    const domain = options?.domain || 'all';
    const userEmail = auth.currentUser?.email;
    const role = getUserRole(userEmail);

    try {
      this.syncAutoPlannerSchedules();
      // 1. Safe localStorage Backup (ALWAYS PRESERVED FOR RECOVERY, NEVER DELETED)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage backup:', e);
    }

    // 2. Primary WRITE to Firestore (OWNER ONLY)
    if (role === 'owner' && domain !== 'none') {
      const syncPromise = (async () => {
        if (domain === 'ledger') {
          const ledgerData = {
            transactions: this.data.otherSettings?.transactions || [],
            activeCsvSession: this.data.otherSettings?.activeCsvSession,
          };
          await saveLedgerToFirestore(ledgerData);
        } else if (domain === 'ledger_and_master') {
          const ledgerData = {
            transactions: this.data.otherSettings?.transactions || [],
            activeCsvSession: this.data.otherSettings?.activeCsvSession,
          };
          const masterData: MasterData = {
            userInfo: this.data.userInfo,
            assets: this.data.assets,
            debts: this.data.debts,
            monthlyIncome: this.data.monthlyIncome,
            fixedExpenses: this.data.fixedExpenses,
            financialProducts: this.data.financialProducts,
            businessInfo: this.data.businessInfo,
            rules: this.data.rules,
          };
          await Promise.all([
            saveLedgerToFirestore(ledgerData),
            saveMasterToFirestore(masterData),
          ]);
        } else if (domain === 'master') {
          const masterData: MasterData = {
            userInfo: this.data.userInfo,
            assets: this.data.assets,
            debts: this.data.debts,
            monthlyIncome: this.data.monthlyIncome,
            fixedExpenses: this.data.fixedExpenses,
            financialProducts: this.data.financialProducts,
            businessInfo: this.data.businessInfo,
            rules: this.data.rules,
          };
          await saveMasterToFirestore(masterData);
        } else if (domain === 'planner') {
          const plannerData = {
            goals: this.data.goals?.mainGoals || [],
            onboardingGoals: this.data.goals?.onboardingGoals || [],
            schedules: this.data.otherSettings?.schedules || [],
          };
          await savePlannerToFirestore(plannerData);
        } else {
          // 'all'
          await saveAllToFirestoreFromAppData(this.data);
        }
      })();

      syncPromise
        .then(() => {
          this.lastFirestoreSaveTime = new Date().toISOString();
          this.lastFirestoreError = null;
        })
        .catch((err: any) => {
          const msg = `Firestore Primary WRITE 저장 실패 (${domain}): ${err?.message || '네트워크/권한 오류'}`;
          console.error(msg, err);
          this.lastFirestoreError = msg;
          this.notifyErrorListeners(msg);
        });
    } else if (role === 'viewer') {
      console.warn('VIEWER 계정은 READ ONLY입니다. Firestore WRITE가 실행되지 않습니다.');
    }

    this.notifyListeners();
  }

  private loadFromStorage(): AppData {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        // classificationRuleVersion v2.0 migration
        const existingVersion = parsed.rules?.classificationRuleVersion || parsed.otherSettings?.classificationRuleVersion || '1.0';
        let merchantRules: MerchantRule[] = [];
        let categoryRules: CategoryRule[] = [];
        let exclusionRules: ExclusionRule[] = [];

        if (existingVersion !== '2.0') {
          // Keep existing user-confirmed rules
          const existingMerchants: MerchantRule[] = parsed.rules?.merchantRules || [];
          const userConfirmed = existingMerchants.filter((r) => r.source === 'user-confirmed');
          const userConfirmedIds = new Set(userConfirmed.map((r) => r.id));

          merchantRules = [
            ...userConfirmed,
            ...loadMerchantRules().filter((r) => !userConfirmedIds.has(r.id)),
          ];
          categoryRules = loadCategoryRules();
          exclusionRules = loadExclusionRules();
        } else {
          merchantRules = parsed.rules?.merchantRules || loadMerchantRules();
          categoryRules = parsed.rules?.categoryRules || loadCategoryRules();
          exclusionRules = parsed.rules?.exclusionRules || loadExclusionRules();
        }

        const data: AppData = {
          userInfo: { ...INITIAL_APP_DATA.userInfo, ...(parsed.userInfo || {}) },
          assets: {
            onboardingAssets: parsed.assets?.onboardingAssets || [],
            mainAssets: parsed.assets?.mainAssets || [],
          },
          debts: {
            onboardingDebts: parsed.debts?.onboardingDebts || [],
            mainDebts: parsed.debts?.mainDebts || [],
          },
          monthlyIncome: {
            incomeSources: (parsed.monthlyIncome?.incomeSources && parsed.monthlyIncome.incomeSources.length > 0
              ? parsed.monthlyIncome.incomeSources
              : DEFAULT_INITIAL_INCOME_SOURCES).map(normalizeIncomeSource),
            incomeRecords: (parsed.monthlyIncome?.incomeRecords || []).filter(
              (r: IncomeRecord) => !(r.year === 2026 && (r.month === 5 || r.month === 6))
            ),
            ...(parsed.monthlyIncome?.legacyMonthlyTotalIncome !== undefined
              ? { legacyMonthlyTotalIncome: parsed.monthlyIncome.legacyMonthlyTotalIncome }
              : {}),
          },
          fixedExpenses: parsed.fixedExpenses || [],
          financialProducts: parsed.financialProducts || [],
          goals: {
            onboardingGoals: parsed.goals?.onboardingGoals || [],
            mainGoals: parsed.goals?.mainGoals || [],
          },
          businessInfo: { ...INITIAL_APP_DATA.businessInfo, ...(parsed.businessInfo || {}) },
          rules: {
            merchantRules,
            categoryRules,
            exclusionRules,
            classificationRuleVersion: '2.0',
          } as any,
          otherSettings: {
            ...INITIAL_APP_DATA.otherSettings,
            ...(parsed.otherSettings || {}),
            classificationRuleVersion: '2.0',
            settlementData: {
              ...INITIAL_APP_DATA.otherSettings.settlementData,
              ...(parsed.otherSettings?.settlementData || {}),
            },
          } as any,
        };

        return data;
      }
    } catch (e) {
      console.warn('Failed to parse localStorage dataStore:', e);
    }
    return JSON.parse(JSON.stringify(INITIAL_APP_DATA));
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getData()));
  }

  public subscribe(listener: (data: AppData) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Read Accessors
  public getData(): AppData {
    return JSON.parse(JSON.stringify(this.data));
  }

  public getUserInfo(): UserInfo {
    return JSON.parse(JSON.stringify(this.data.userInfo));
  }

  public getAssets() {
    return JSON.parse(JSON.stringify(this.data.assets));
  }

  public getDebts() {
    return JSON.parse(JSON.stringify(this.data.debts));
  }

  public getIncomeSources(): IncomeSource[] {
    return JSON.parse(
      JSON.stringify(this.data.monthlyIncome.incomeSources.map(normalizeIncomeSource))
    );
  }

  public getFixedExpenses(): FixedExpenseItem[] {
    return JSON.parse(JSON.stringify(this.data.fixedExpenses));
  }

  public getFinancialProducts(): FinancialProductItem[] {
    return JSON.parse(JSON.stringify(this.data.financialProducts));
  }

  public getGoals() {
    return JSON.parse(JSON.stringify(this.data.goals));
  }

  public getBusinessInfo(): BusinessInfo {
    return JSON.parse(JSON.stringify(this.data.businessInfo));
  }

  public getMerchantRules(): MerchantRule[] {
    return JSON.parse(JSON.stringify(this.data.rules?.merchantRules || INITIAL_MERCHANT_RULES));
  }

  public getCategoryRules(): CategoryRule[] {
    return JSON.parse(JSON.stringify(this.data.rules?.categoryRules || INITIAL_CATEGORY_RULES));
  }

  public getExclusionRules(): ExclusionRule[] {
    return JSON.parse(JSON.stringify(this.data.rules?.exclusionRules || INITIAL_EXCLUSION_RULES));
  }

  public getOtherSettings(): AppData['otherSettings'] {
    return JSON.parse(JSON.stringify(this.data.otherSettings));
  }

  // Calculated Summary Helpers for Consistent Data Binding across screens
  public getTotalAssetsSummary() {
    const obAssets = this.data.assets.onboardingAssets || [];
    const mainAssets = this.data.assets.mainAssets || [];

    let realEstateTotal = 0;
    let financialTotal = 0;
    let otherTotal = 0;

    const listToUse = obAssets.length > 0 ? obAssets : [];

    if (listToUse.length > 0) {
      listToUse.forEach((a) => {
        const val = Number(a.currentValue) || 0;
        if (a.assetType === '부동산') realEstateTotal += val;
        else if (a.assetType === '금융자산') financialTotal += val;
        else otherTotal += val;
      });
    } else {
      mainAssets.forEach((a) => {
        const val = Number(a.amount) || 0;
        if (a.category === '부동산') realEstateTotal += val;
        else if (a.category === '금융자산') financialTotal += val;
        else otherTotal += val;
      });
    }

    const total = realEstateTotal + financialTotal + otherTotal;
    return {
      total,
      realEstateTotal,
      financialTotal,
      otherTotal,
    };
  }

  public getTotalDebtsSummary(): number {
    const obDebts = this.data.debts.onboardingDebts || [];
    const mainDebts = this.data.debts.mainDebts || [];

    if (obDebts.length > 0) {
      return obDebts.reduce((sum, d) => sum + (Number(d.currentBalance) || 0), 0);
    }
    return mainDebts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }

  public getNetWorth(): number {
    const assetSummary = this.getTotalAssetsSummary();
    const debtTotal = this.getTotalDebtsSummary();
    return assetSummary.total - debtTotal;
  }

  // Async Mutation Operations (Ready to swap with Firebase async Firestore calls)
  public async updateUserInfo(userInfo: Partial<UserInfo>): Promise<void> {
    this.data.userInfo = { ...this.data.userInfo, ...userInfo };
    this.saveToStorage();
  }

  public async updateOnboardingData(payload: {
    householdName?: string;
    familyMembers?: UserInfo['familyMembers'];
    incomeSources?: IncomeSource[];
    onboardingAssets?: OnboardingAsset[];
    onboardingDebts?: OnboardingDebt[];
    onboardingGoals?: OnboardingGoal[];
    businessInfo?: Partial<BusinessInfo>;
  }): Promise<void> {
    if (payload.householdName !== undefined) {
      this.data.userInfo.householdName = payload.householdName;
    }
    if (payload.familyMembers !== undefined) {
      this.data.userInfo.familyMembers = payload.familyMembers;
    }
    if (payload.incomeSources !== undefined) {
      this.data.monthlyIncome.incomeSources = payload.incomeSources.map(normalizeIncomeSource);
    }
    if (payload.onboardingAssets !== undefined) {
      this.data.assets.onboardingAssets = payload.onboardingAssets;
      this.data.assets.mainAssets = payload.onboardingAssets.map((a) => ({
        id: a.id,
        name: `[${a.assetName}]`,
        category:
          a.assetType === '부동산'
            ? '부동산'
            : a.assetType === '금융자산'
            ? '금융자산'
            : '기타',
        amount: Number(a.currentValue) || 0,
        status: '정상',
      }));
    }
    if (payload.onboardingDebts !== undefined) {
      this.data.debts.onboardingDebts = payload.onboardingDebts;
      this.data.debts.mainDebts = payload.onboardingDebts.map((d) => {
        const calcRes = calculateCurrentDebtPayment(d);
        const effectivePayment = d.manualPaymentOverride
          ? Number(d.manualTotalPayment) || Number(d.manualMonthlyPayment) || Number(d.monthlyPayment) || calcRes.currentTotal
          : calcRes.currentTotal;

        return {
          id: d.id,
          name: `[${d.debtName}]`,
          amount: Number(d.currentBalance) || 0,
          rate: Number(d.interestRate) || Number(d.annualRate) || 0,
          rateType: d.rateType || '고정금리',
          monthlyPayment: effectivePayment,
          nextDueDate: d.paymentDay || '매월 25일',
          repaymentType: d.repaymentType,
          annualRate: d.annualRate ?? Number(d.interestRate),
          calculationMode: d.calculationMode,
          originalPrincipal: d.originalPrincipal,
          loanStartDate: d.loanStartDate,
          principalRepaymentStartDate: d.principalRepaymentStartDate || d.repaymentStartDate,
          repaymentStartDate: d.repaymentStartDate,
          maturityDate: d.maturityDate,
          rateEffectiveDate: d.rateEffectiveDate,
          remainingMonths: d.remainingMonths,
          paymentDay: d.paymentDay,
          currentPrincipalPayment: d.currentPrincipalPayment,
          currentInterestPayment: d.currentInterestPayment,
          currentTotalPayment: d.currentTotalPayment,
          calculatedPrincipalPayment: calcRes.currentPrincipal,
          calculatedInterestPayment: calcRes.currentInterest,
          calculatedMonthlyPayment: calcRes.currentTotal,
          manualPaymentOverride: d.manualPaymentOverride,
          manualPrincipalPayment: d.manualPrincipalPayment,
          manualInterestPayment: d.manualInterestPayment,
          manualTotalPayment: d.manualTotalPayment,
          manualMonthlyPayment: d.manualMonthlyPayment,
          repaymentPhases: d.repaymentPhases,
          calculationBaseDate: d.calculationBaseDate,
        };
      });
    }
    if (payload.onboardingGoals !== undefined) {
      this.data.goals.onboardingGoals = payload.onboardingGoals;
      this.data.goals.mainGoals = payload.onboardingGoals.map((g) => ({
        id: g.id,
        title: g.goalName,
        category:
          g.goalType === '여행'
            ? '여행'
            : g.goalType === '부채상환'
            ? '대출상환'
            : '기타',
        targetAmount: Number(g.targetAmount) || 0,
        currentAmount: 0,
        progressPercentage: 0,
        memo: g.memo,
      }));
    }
    if (payload.businessInfo !== undefined) {
      this.data.businessInfo = { ...this.data.businessInfo, ...payload.businessInfo };
    }
    this.saveToStorage();
  }

  public async saveAsset(asset: Asset | OnboardingAsset): Promise<void> {
    if ('assetType' in asset) {
      const idx = this.data.assets.onboardingAssets.findIndex((a) => a.id === asset.id);
      if (idx >= 0) {
        this.data.assets.onboardingAssets[idx] = asset;
      } else {
        this.data.assets.onboardingAssets.push(asset);
      }
    } else {
      const idx = this.data.assets.mainAssets.findIndex((a) => a.id === asset.id);
      if (idx >= 0) {
        this.data.assets.mainAssets[idx] = asset;
      } else {
        this.data.assets.mainAssets.push(asset);
      }
    }
    this.saveToStorage();
  }

  public async deleteAsset(id: string, isFromOnboarding = false): Promise<void> {
    if (isFromOnboarding) {
      this.data.assets.onboardingAssets = this.data.assets.onboardingAssets.filter(
        (a) => a.id !== id
      );
    } else {
      this.data.assets.mainAssets = this.data.assets.mainAssets.filter((a) => a.id !== id);
    }
    this.saveToStorage();
  }

  public async saveDebt(debt: Debt | OnboardingDebt): Promise<void> {
    if ('debtType' in debt) {
      const idx = this.data.debts.onboardingDebts.findIndex((d) => d.id === debt.id);
      if (idx >= 0) {
        this.data.debts.onboardingDebts[idx] = debt;
      } else {
        this.data.debts.onboardingDebts.push(debt);
      }
    } else {
      const idx = this.data.debts.mainDebts.findIndex((d) => d.id === debt.id);
      if (idx >= 0) {
        this.data.debts.mainDebts[idx] = debt;
      } else {
        this.data.debts.mainDebts.push(debt);
      }
    }
    this.saveToStorage();
  }

  public async deleteDebt(id: string, isFromOnboarding = false): Promise<void> {
    if (isFromOnboarding) {
      this.data.debts.onboardingDebts = this.data.debts.onboardingDebts.filter(
        (d) => d.id !== id
      );
    } else {
      this.data.debts.mainDebts = this.data.debts.mainDebts.filter((d) => d.id !== id);
    }
    this.saveToStorage();
  }

  public async saveIncomeSource(income: IncomeSource): Promise<void> {
    const norm = normalizeIncomeSource(income);
    const idx = this.data.monthlyIncome.incomeSources.findIndex((i) => i.id === norm.id);
    if (idx >= 0) {
      this.data.monthlyIncome.incomeSources[idx] = norm;
    } else {
      this.data.monthlyIncome.incomeSources.push(norm);
    }
    this.saveToStorage();
  }

  public async deleteIncomeSource(id: string): Promise<void> {
    this.data.monthlyIncome.incomeSources = this.data.monthlyIncome.incomeSources.filter(
      (i) => i.id !== id
    );
    this.saveToStorage();
  }

  public getIncomeRecords(year?: number, month?: number): IncomeRecord[] {
    const list = this.data.monthlyIncome.incomeRecords || [];
    if (year !== undefined && month !== undefined) {
      return JSON.parse(
        JSON.stringify(list.filter((r) => r.year === year && r.month === month))
      );
    }
    if (year !== undefined) {
      return JSON.parse(JSON.stringify(list.filter((r) => r.year === year)));
    }
    return JSON.parse(JSON.stringify(list));
  }

  public getIncomeRecord(
    incomeSourceId: string,
    year: number,
    month: number
  ): IncomeRecord | undefined {
    const list = this.data.monthlyIncome.incomeRecords || [];
    const found = list.find(
      (r) => r.incomeSourceId === incomeSourceId && r.year === year && r.month === month
    );
    return found ? JSON.parse(JSON.stringify(found)) : undefined;
  }

  public async saveIncomeRecord(record: IncomeRecord): Promise<void> {
    if (!this.data.monthlyIncome.incomeRecords) {
      this.data.monthlyIncome.incomeRecords = [];
    }
    const list = this.data.monthlyIncome.incomeRecords;
    const idx = list.findIndex(
      (r) =>
        r.incomeSourceId === record.incomeSourceId &&
        r.year === record.year &&
        r.month === record.month
    );
    if (idx >= 0) {
      list[idx] = { ...record, updatedAt: new Date().toISOString() };
    } else {
      list.push({
        ...record,
        createdAt: record.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.saveToStorage();
  }

  public async saveIncomeRecords(records: IncomeRecord[]): Promise<void> {
    if (!this.data.monthlyIncome.incomeRecords) {
      this.data.monthlyIncome.incomeRecords = [];
    }
    const list = this.data.monthlyIncome.incomeRecords;
    records.forEach((rec) => {
      const idx = list.findIndex(
        (r) =>
          r.incomeSourceId === rec.incomeSourceId &&
          r.year === rec.year &&
          r.month === rec.month
      );
      if (idx >= 0) {
        list[idx] = { ...rec, updatedAt: new Date().toISOString() };
      } else {
        list.push({
          ...rec,
          createdAt: rec.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });
    this.saveToStorage();
  }

  public async updateFixedExpenses(expenses: FixedExpenseItem[]): Promise<void> {
    this.data.fixedExpenses = expenses;
    this.saveToStorage();
  }

  public async saveFixedExpense(expense: FixedExpenseItem): Promise<void> {
    const idx = this.data.fixedExpenses.findIndex((f) => f.id === expense.id);
    if (idx >= 0) {
      this.data.fixedExpenses[idx] = expense;
    } else {
      this.data.fixedExpenses.push(expense);
    }
    this.saveToStorage();
  }

  public async deleteFixedExpense(id: string): Promise<void> {
    this.data.fixedExpenses = this.data.fixedExpenses.filter((f) => f.id !== id);
    this.saveToStorage();
  }

  public async saveFinancialProduct(product: FinancialProductItem): Promise<void> {
    const idx = this.data.financialProducts.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      this.data.financialProducts[idx] = product;
    } else {
      this.data.financialProducts.push(product);
    }
    this.saveToStorage();
  }

  public async deleteFinancialProduct(id: string): Promise<void> {
    this.data.financialProducts = this.data.financialProducts.filter((p) => p.id !== id);
    this.saveToStorage();
  }

  public async saveGoal(goal: Goal | OnboardingGoal): Promise<void> {
    if ('goalType' in goal) {
      const idx = this.data.goals.onboardingGoals.findIndex((g) => g.id === goal.id);
      if (idx >= 0) {
        this.data.goals.onboardingGoals[idx] = goal;
      } else {
        this.data.goals.onboardingGoals.push(goal);
      }
    } else {
      const idx = this.data.goals.mainGoals.findIndex((g) => g.id === goal.id);
      if (idx >= 0) {
        this.data.goals.mainGoals[idx] = goal;
      } else {
        this.data.goals.mainGoals.push(goal);
      }
    }
    this.saveToStorage();
  }

  public async deleteGoal(id: string, isFromOnboarding = false): Promise<void> {
    if (isFromOnboarding) {
      this.data.goals.onboardingGoals = this.data.goals.onboardingGoals.filter(
        (g) => g.id !== id
      );
    } else {
      this.data.goals.mainGoals = this.data.goals.mainGoals.filter((g) => g.id !== id);
    }
    this.saveToStorage();
  }

  public async updateBusinessInfo(info: Partial<BusinessInfo>): Promise<void> {
    this.data.businessInfo = { ...this.data.businessInfo, ...info };
    this.saveToStorage();
  }

  public async updateSettlementData(settlement: Partial<SettlementData>): Promise<void> {
    this.data.otherSettings.settlementData = {
      ...this.data.otherSettings.settlementData,
      ...settlement,
    };
    this.saveToStorage();
  }

  public async setSessionTransactions(txs: Transaction[]): Promise<void> {
    this.startNewCsvSession({
      fileName: 'CSV_거래내역.csv',
      transactions: txs,
    });
  }

  public async saveUserMerchantLearning(
    merchantRaw: string,
    merchantMaster: string,
    majorCategory: string,
    minorCategory: string
  ): Promise<void> {
    const raw = (merchantRaw || '').trim();
    const master = (merchantMaster || raw).trim();
    if (!raw) return;

    const normRaw = normalizeMerchantName(raw);
    const normMaster = normalizeMerchantName(master);

    const userRule: MerchantRule = {
      id: `m-rule-user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      merchantMaster: master,
      patterns: Array.from(new Set([raw, master, normRaw, normMaster].filter(Boolean))),
      matchType: 'contains',
      majorCategory,
      minorCategory,
      included: true,
      confidence: 'confirmed',
      source: 'user-confirmed',
      isActive: true,
    };

    // Defer intermediate saveToStorage to prevent multiple full AppData write fan-outs
    await this.saveMerchantRule(userRule, true);

    // Reclassify active session transactions using updated rules
    if (this.data.otherSettings.transactions.length > 0) {
      const reclassified = reclassifyTransactions(this.data.otherSettings.transactions, {
        rules: this.getMerchantRules(),
        exclusionRules: this.getExclusionRules(),
        categoryRules: this.getCategoryRules(),
      });

      const updatedTxList = reclassified.map((item, idx) => {
        const orig = this.data.otherSettings.transactions[idx];
        return {
          ...orig,
          merchant: item.merchant,
          category: item.category,
          needsReview: item.needsReview,
          userConfirmed: item.userConfirmed ?? orig.userConfirmed,
          classification: item.classification,
        };
      });

      this.data.otherSettings.transactions = updatedTxList;
    }

    // Single consolidated save for both rule update & transaction reclassification
    this.saveToStorage({ domain: 'ledger_and_master' });
  }

  public async addTransaction(tx: Transaction): Promise<void> {
    this.data.otherSettings.transactions.unshift(tx);
    this.saveToStorage({ domain: 'ledger' });
  }

  public async updateTransaction(tx: Transaction): Promise<void> {
    const idx = this.data.otherSettings.transactions.findIndex((t) => t.id === tx.id);
    if (idx >= 0) {
      this.data.otherSettings.transactions[idx] = tx;
      this.saveToStorage({ domain: 'ledger' });
    }
  }

  public async deleteTransaction(id: string): Promise<void> {
    this.data.otherSettings.transactions = this.data.otherSettings.transactions.filter(
      (t) => t.id !== id
    );
    this.saveToStorage({ domain: 'ledger' });
  }

  public async addSchedule(sch: ScheduleEvent): Promise<void> {
    this.data.otherSettings.schedules.unshift(sch);
    this.saveToStorage({ domain: 'planner' });
  }

  public async updateSchedule(sch: ScheduleEvent): Promise<void> {
    const list = this.data.otherSettings.schedules || [];
    const idx = list.findIndex((s) => s.id === sch.id);
    if (idx >= 0) {
      list[idx] = sch;
    } else {
      list.unshift(sch);
    }
    this.saveToStorage({ domain: 'planner' });
  }

  public async saveMerchantRule(rule: MerchantRule, skipSave: boolean = false): Promise<void> {
    if (!this.data.rules) {
      this.data.rules = {
        merchantRules: [...INITIAL_MERCHANT_RULES],
        categoryRules: [...INITIAL_CATEGORY_RULES],
        exclusionRules: [...INITIAL_EXCLUSION_RULES],
      };
    }
    const idx = this.data.rules.merchantRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.data.rules.merchantRules[idx] = rule;
    } else {
      this.data.rules.merchantRules.unshift(rule);
    }
    if (!skipSave) {
      this.saveToStorage({ domain: 'master' });
    }
  }

  public async saveCategoryRule(rule: CategoryRule, skipSave: boolean = false): Promise<void> {
    if (!this.data.rules) {
      this.data.rules = {
        merchantRules: [...INITIAL_MERCHANT_RULES],
        categoryRules: [...INITIAL_CATEGORY_RULES],
        exclusionRules: [...INITIAL_EXCLUSION_RULES],
      };
    }
    const idx = this.data.rules.categoryRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.data.rules.categoryRules[idx] = rule;
    } else {
      this.data.rules.categoryRules.unshift(rule);
    }
    if (!skipSave) {
      this.saveToStorage({ domain: 'master' });
    }
  }

  public async saveExclusionRule(rule: ExclusionRule, skipSave: boolean = false): Promise<void> {
    if (!this.data.rules) {
      this.data.rules = {
        merchantRules: [...INITIAL_MERCHANT_RULES],
        categoryRules: [...INITIAL_CATEGORY_RULES],
        exclusionRules: [...INITIAL_EXCLUSION_RULES],
      };
    }
    const idx = this.data.rules.exclusionRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.data.rules.exclusionRules[idx] = rule;
    } else {
      this.data.rules.exclusionRules.unshift(rule);
    }
    if (!skipSave) {
      this.saveToStorage({ domain: 'master' });
    }
  }

  // ============================================================================
  // SINGLE SOURCE OF TRUTH (SSOT) CALCULATION & AUTO-SYNC HELPERS
  // ============================================================================

  /**
   * Auto-synchronizes planner schedule events from registered debts and assets.
   */
  public syncAutoPlannerSchedules(): void {
    const obDebts = this.data.debts.onboardingDebts || [];
    const mainDebts = this.data.debts.mainDebts || [];

    const activeDebtsMap = new Map<
      string,
      { id: string; name: string; repayDate?: string; maturityDate?: string; amount: number; payment: number }
    >();

    obDebts.forEach((d) => {
      const repayDate = d.principalRepaymentStartDate || d.repaymentStartDate || d.principalStartDate;
      activeDebtsMap.set(d.id, {
        id: d.id,
        name: d.debtName,
        repayDate: repayDate ? repayDate.replace(/\./g, '-') : undefined,
        maturityDate: d.maturityDate ? d.maturityDate.replace(/\./g, '-') : undefined,
        amount: Number(d.currentBalance) || Number(d.originalPrincipal) || 0,
        payment: Number(d.monthlyPayment) || 0,
      });
    });

    mainDebts.forEach((d) => {
      if (!activeDebtsMap.has(d.id)) {
        const repayDate = d.principalRepaymentStartDate || d.repaymentStartDate;
        activeDebtsMap.set(d.id, {
          id: d.id,
          name: d.name.replace(/^\[|\]$/g, ''),
          repayDate: repayDate ? repayDate.replace(/\./g, '-') : undefined,
          maturityDate: d.maturityDate ? d.maturityDate.replace(/\./g, '-') : undefined,
          amount: Number(d.currentBalance) || Number(d.amount) || 0,
          payment: Number(d.monthlyPayment) || 0,
        });
      }
    });

    const currentSchedules = this.data.otherSettings?.schedules || [];
    const schedulesMap = new Map<string, ScheduleEvent>();

    // Load existing schedules into map, preserving first occurrence to prevent duplicate IDs
    currentSchedules.forEach((s) => {
      if (!schedulesMap.has(s.id)) {
        schedulesMap.set(s.id, { ...s });
      }
    });

    activeDebtsMap.forEach((debt) => {
      if (debt.repayDate) {
        const autoId = `auto-sch-repay-${debt.id}`;
        const existing = schedulesMap.get(autoId);

        const newTitle = `${debt.name} 원금상환 시작`;
        const newDate = debt.repayDate;
        const newAmount = existing?.userModifiedAmount
          ? existing.amount
          : debt.payment || debt.amount;
        
        const defaultMemo = `[자동 생성] ${debt.name} 원금상환 시작 일정`;
        const isCustomMemo = existing?.userModifiedMemo || (existing?.memo && existing.memo !== defaultMemo && !existing.memo.startsWith('[자동 생성]'));
        const newMemo = isCustomMemo ? existing!.memo : defaultMemo;

        const updatedSchedule: ScheduleEvent = {
          id: autoId,
          title: newTitle,
          date: newDate,
          amount: newAmount,
          category: existing?.category || '대출·원금',
          isPrimary: true,
          memo: newMemo,
          categoryIcon: existing?.categoryIcon || 'account_balance',
          isAutoGenerated: true,
          sourceType: 'debt',
          sourceId: debt.id,
          expectedPayment: debt.payment,
          remainingPrincipal: debt.amount,
          completed: existing?.completed,
          completedAt: existing?.completedAt,
          status: existing?.status,
          userModifiedAmount: existing?.userModifiedAmount || false,
          userModifiedMemo: existing?.userModifiedMemo || isCustomMemo || false,
        };

        schedulesMap.set(autoId, updatedSchedule);
      }

      if (debt.maturityDate) {
        const autoId = `auto-sch-maturity-${debt.id}`;
        const existing = schedulesMap.get(autoId);

        const newTitle = `${debt.name} 대출 만기`;
        const newDate = debt.maturityDate;
        const newAmount = existing?.userModifiedAmount
          ? existing.amount
          : debt.amount;

        const defaultMemo = `[자동 생성] ${debt.name} 대출 만기 일정`;
        const isCustomMemo = existing?.userModifiedMemo || (existing?.memo && existing.memo !== defaultMemo && !existing.memo.startsWith('[자동 생성]'));
        const newMemo = isCustomMemo ? existing!.memo : defaultMemo;

        const updatedSchedule: ScheduleEvent = {
          id: autoId,
          title: newTitle,
          date: newDate,
          amount: newAmount,
          category: existing?.category || '대출·원금',
          isPrimary: true,
          memo: newMemo,
          categoryIcon: existing?.categoryIcon || 'event_busy',
          isAutoGenerated: true,
          sourceType: 'debt',
          sourceId: debt.id,
          expectedPayment: debt.amount,
          remainingPrincipal: 0,
          completed: existing?.completed,
          completedAt: existing?.completedAt,
          status: existing?.status,
          userModifiedAmount: existing?.userModifiedAmount || false,
          userModifiedMemo: existing?.userModifiedMemo || isCustomMemo || false,
        };

        schedulesMap.set(autoId, updatedSchedule);
      }
    });

    this.data.otherSettings.schedules = Array.from(schedulesMap.values());
  }

  /**
   * Unified Income Summary getter for a given year & month.
   */
  public getMonthlyIncomeSummary(year: number, month: number) {
    const sources = this.getIncomeSources().filter((s) => s.isActive !== false);
    const records = this.getIncomeRecords(year, month);

    let businessIncome = 0;
    let rentalIncome = 0;
    let otherIncome = 0;

    const inflowDetails: Array<{ id: string; name: string; type: string; amount: number; isActual: boolean }> = [];

    sources.forEach((src) => {
      const rec = records.find((r) => r.incomeSourceId === src.id);
      let amount = 0;
      let isActual = false;

      if (rec && rec.actualIncome !== undefined && rec.actualIncome !== null) {
        amount = rec.actualIncome;
        isActual = true;
      } else {
        amount = Number(src.fixedMonthlyIncome) || Number(src.monthlyIncome) || 0;
      }

      const type = src.incomeType || '사업소득';
      if (type === '사업소득') {
        businessIncome += amount;
      } else if (type === '임대소득') {
        rentalIncome += amount;
      } else {
        otherIncome += amount;
      }

      inflowDetails.push({
        id: src.id,
        name: src.incomeName || src.name || '수입원',
        type,
        amount,
        isActual,
      });
    });

    const totalIncome = businessIncome + rentalIncome + otherIncome;

    return {
      totalIncome,
      totalInflow: totalIncome,
      businessIncome,
      rentalIncome,
      otherIncome,
      inflowDetails,
    };
  }

  /**
   * Get Monthly Loan Payments for a given year & month.
   */
  public getMonthlyLoanPayments(year: number, month: number): MonthlyLoanPayment[] {
    const obDebts = this.data.debts.onboardingDebts || [];
    const storedPayments = this.data.debts.monthlyLoanPayments || [];

    const result: MonthlyLoanPayment[] = [];

    obDebts.forEach((debt) => {
      const existing = storedPayments.find(
        (p) => p.debtId === debt.id && p.year === year && p.month === month
      );
      if (existing) {
        result.push(existing);
      } else {
        const origPrincipal = Number(debt.originalPrincipal) || Number(debt.currentBalance) || 0;
        const curBalance = Number(debt.currentBalance) || origPrincipal;
        const rate = Number(debt.interestRate) || Number(debt.annualRate) || 0;
        const methodStr = String(debt.repaymentMethod || debt.repaymentType || '원리금균등');
        const targetDateStr = `${year}-${String(month).padStart(2, '0')}-01`;

        let estPrincipal = 0;
        let estInterest = Math.round((curBalance * (rate / 100)) / 12);

        const startDateStr =
          debt.principalRepaymentStartDate || debt.repaymentStartDate || debt.loanStartDate;
        if (startDateStr && new Date(targetDateStr) < new Date(startDateStr)) {
          estPrincipal = 0;
        } else {
          if (methodStr.includes('만기일시') || methodStr.includes('이자만')) {
            estPrincipal = 0;
          } else if (methodStr.includes('원금균등')) {
            const months = debt.remainingMonths || 120;
            estPrincipal = Math.round(origPrincipal / months);
          } else if (methodStr.includes('원리금균등')) {
            const months = debt.remainingMonths || 120;
            const r = rate / 100 / 12;
            if (r > 0 && months > 0) {
              const totalMonthly =
                (origPrincipal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
              estInterest = Math.round(curBalance * r);
              estPrincipal = Math.max(0, Math.round(totalMonthly - estInterest));
            } else {
              estPrincipal = Math.round(origPrincipal / (months || 120));
            }
          } else {
            estPrincipal =
              Number(debt.currentPrincipalPayment) || Number(debt.manualPrincipalPayment) || 0;
            estInterest =
              Number(debt.currentInterestPayment) || Number(debt.manualInterestPayment) || estInterest;
          }
        }

        result.push({
          id: `mlp-${debt.id}-${year}-${month}`,
          debtId: debt.id,
          debtName: debt.debtName,
          year,
          month,
          paymentDay: debt.paymentDay,
          estimatedPrincipal: estPrincipal,
          estimatedInterest: estInterest,
          estimatedTotal: estPrincipal + estInterest,
          actualPrincipal: null,
          actualInterest: null,
          actualTotal: null,
          isConfirmed: false,
          calculatedAt: new Date().toISOString(),
        });
      }
    });

    return result;
  }

  /**
   * Confirm or update a Monthly Loan Payment record.
   */
  public async saveMonthlyLoanPayment(payment: MonthlyLoanPayment): Promise<void> {
    if (!this.data.debts.monthlyLoanPayments) {
      this.data.debts.monthlyLoanPayments = [];
    }

    const idx = this.data.debts.monthlyLoanPayments.findIndex(
      (p) => p.debtId === payment.debtId && p.year === payment.year && p.month === payment.month
    );

    if (idx >= 0) {
      this.data.debts.monthlyLoanPayments[idx] = payment;
    } else {
      this.data.debts.monthlyLoanPayments.push(payment);
    }

    if (payment.isConfirmed && payment.actualPrincipal !== null && payment.actualPrincipal > 0) {
      const debtIdx = this.data.debts.onboardingDebts.findIndex((d) => d.id === payment.debtId);
      if (debtIdx >= 0) {
        const debt = this.data.debts.onboardingDebts[debtIdx];
        const orig = Number(debt.originalPrincipal) || Number(debt.currentBalance) || 0;

        const totalConfirmedPrincipal = this.data.debts.monthlyLoanPayments
          .filter((p) => p.debtId === payment.debtId && p.isConfirmed && p.actualPrincipal !== null)
          .reduce((sum, p) => sum + (p.actualPrincipal || 0), 0);

        const newBalance = Math.max(0, orig - totalConfirmedPrincipal);
        this.data.debts.onboardingDebts[debtIdx].currentBalance = newBalance;

        const mainIdx = this.data.debts.mainDebts.findIndex((m) => m.id === payment.debtId);
        if (mainIdx >= 0) {
          this.data.debts.mainDebts[mainIdx].amount = newBalance;
        }
      }
    }

    this.saveToStorage();
  }

  /**
   * Unified Cashflow Summary formula calculation for a target month.
   */
  public getMonthlyCashflowSummary(year: number, month: number) {
    const incomeSummary = this.getMonthlyIncomeSummary(year, month);
    const loanPayments = this.getMonthlyLoanPayments(year, month);

    let financialCost = 0;
    let principalRepayment = 0;
    let debtReduction = 0;

    loanPayments.forEach((p) => {
      financialCost += p.actualInterest ?? p.estimatedInterest;
      principalRepayment += p.actualPrincipal ?? p.estimatedPrincipal;
      if (p.isConfirmed && p.actualPrincipal) {
        debtReduction += p.actualPrincipal;
      }
    });

    const fixedExps = this.getFixedExpenses();
    const otherFixed = fixedExps.reduce((sum, f) => sum + (Number(f.monthlyAmount) || 0), 0);

    const consumerSummary = this.getConsumerSpendingSummary();
    const livingExpenses = consumerSummary.totalExpense;

    // Retrieve savings & investments for the target month from settlement records
    const formattedMonthKey = `${year}년 ${month}월`;
    let totalSavings = 0;
    try {
      const savedRecords = localStorage.getItem('cfo_monthly_records_v3');
      if (savedRecords) {
        const parsed = JSON.parse(savedRecords);
        const record = parsed[formattedMonthKey];
        if (record && Array.isArray(record.savingsInvestments)) {
          totalSavings = record.savingsInvestments.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
        }
      }
    } catch (e) {
      console.error(e);
    }

    const totalOutflow = livingExpenses + financialCost + principalRepayment + otherFixed + totalSavings;
    const netCashflow = incomeSummary.totalInflow - totalOutflow;

    const outflowDetails = [
      { id: 'living', name: '생활지출 (카드/현금)', category: '생활비', amount: livingExpenses },
      { id: 'interest', name: '금융비용 (대출이자)', category: '금융비용', amount: financialCost },
      { id: 'principal', name: '대출 원금상환액', category: '부채상환', amount: principalRepayment },
      ...(totalSavings > 0 ? [{ id: 'savings', name: '저축·투자 (자산증가)', category: '저축/투자', amount: totalSavings }] : []),
      ...(fixedExps || []).map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category || '고정지출',
        amount: Number(f.monthlyAmount) || 0,
      })),
    ];

    return {
      totalInflow: incomeSummary.totalInflow,
      businessIncome: incomeSummary.businessIncome,
      rentalIncome: incomeSummary.rentalIncome,
      otherIncome: incomeSummary.otherIncome,
      inflowDetails: incomeSummary.inflowDetails,

      livingExpenses,
      financialCost,
      principalRepayment,
      otherFixed,
      totalOutflow,
      netCashflow,
      debtReduction,
      outflowDetails,
    };
  }

  // ============================================================================
  // CSV SESSION MANAGEMENT & SINGLE SOURCE OF TRUTH AGGREGATION
  // ============================================================================

  public isPersonalOrInternalTransferMerchant(
    merchantName: string,
    category?: string,
    memo?: string
  ): boolean {
    if (!merchantName) return true;
    const name = merchantName.trim();
    const cat = (category || '').toLowerCase();

    if (
      cat.includes('제외') ||
      cat.includes('내부이체') ||
      cat.includes('원금상환') ||
      cat.includes('자산이동')
    ) {
      return true;
    }

    const transferKeywords = [
      '스마트출금', '계좌이체', '타행이체', '당행이체', '무통장', '송금',
      '대체', '상환', '자동이체', 'ATM', '카카오페이', '토스', '네이버페이',
      '출금', '입금', '대여금', '현하우스', '수수료', '원금상환', '예적금'
    ];
    if (transferKeywords.some((kw) => name.includes(kw) || (memo && memo.includes(kw)))) {
      return true;
    }

    const cleanNameNoParens = name.replace(/\(.*?\)/g, '').trim();
    const pureKorean2To4 = /^[가-힣]{2,4}$/;
    if (pureKorean2To4.test(cleanNameNoParens)) {
      const commercialSuffixes = [
        '점', '국밥', '치킨', '피자', '갈비', '김밥', '본죽', '미용실',
        '헤어', '의원', '약국', '마트', '슈퍼', '카페', '베이커리', '식당', '반점',
        '스튜디오', '꽃집', '카센터', '공인중개사', '학원', '클라우드', '서버', 'AWS'
      ];
      if (!commercialSuffixes.some((sfx) => name.includes(sfx))) {
        return true;
      }
    }

    return false;
  }

  public getActiveSessionTransactions(): Transaction[] {
    const activeSessionId = this.data.otherSettings?.activeImportSessionId;
    const allTxs = this.data.otherSettings?.transactions || [];
    if (activeSessionId) {
      return allTxs.filter((t) => t.importSessionId === activeSessionId);
    }
    return allTxs;
  }

  public getConsumerSpendingSummary(): ConsumerSpendingSummary {
    const activeSessionInfo = this.data.otherSettings?.activeCsvSession;
    const activeSessionId = this.data.otherSettings?.activeImportSessionId;
    const allTxs = this.data.otherSettings?.transactions || [];

    let sessionTxs = allTxs;
    if (activeSessionId) {
      sessionTxs = allTxs.filter((t) => t.importSessionId === activeSessionId);
    }

    const includedTxs = sessionTxs.filter(isConsumerTransaction);

    const excludedTxs = sessionTxs.filter((t) => {
      if (t.analysisStatus === 'excluded') return true;
      if (t.classification?.classificationType === 'excluded') return true;
      const cat = t.category || '';
      return cat.startsWith('제외') || cat.includes('내부이체');
    });

    const pendingTxs = sessionTxs.filter((t) => {
      if (t.analysisStatus === 'pending') return true;
      if (t.needsReview || t.classification?.needsConfirmation) return true;
      return false;
    });

    const totalExpense = includedTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Category Breakdown (EXCLUDING '제외')
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
      if (this.isPersonalOrInternalTransferMerchant(merchant, t.category, t.memo)) return;

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

    return {
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
      totalSessionRawCount: sessionTxs.length,
    };
  }

  public startNewCsvSession(payload: {
    fileName: string;
    transactions: Transaction[];
    dateRange?: string;
  }): ActiveCsvSession {
    const importSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const importedAt = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const seenIds = new Set<string>();
    const processedTxs: Transaction[] = [];

    let includedCount = 0;
    let excludedCount = 0;
    let pendingCount = 0;

    payload.transactions.forEach((t, idx) => {
      const rawMerchant = t.merchantOriginal || t.merchant || '';
      const dateStr = t.date || '';
      const amt = Number(t.amount) || 0;
      const txId = t.transactionId || `${dateStr}_${t.time || ''}_${amt}_${rawMerchant}_${idx}`;

      if (seenIds.has(txId)) {
        return;
      }
      seenIds.add(txId);

      let status: 'included' | 'excluded' | 'pending' = 'included';
      if (t.classification?.classificationType === 'excluded' || !t.classification?.included || t.category?.startsWith('제외')) {
        status = 'excluded';
        excludedCount++;
      } else if (t.needsReview || t.classification?.needsConfirmation) {
        status = 'pending';
        pendingCount++;
      } else {
        status = 'included';
        includedCount++;
      }

      processedTxs.push({
        ...t,
        importSessionId,
        sourceFileName: payload.fileName,
        importedAt,
        transactionId: txId,
        analysisStatus: status,
      });
    });

    const dateRange =
      payload.dateRange ||
      (processedTxs.length > 0
        ? `${processedTxs[processedTxs.length - 1].date} ~ ${processedTxs[0].date}`
        : '기간 정보 없음');

    const activeSession: ActiveCsvSession = {
      importSessionId,
      sourceFileName: payload.fileName,
      importedAt,
      dateRange,
      totalRawCount: processedTxs.length,
      includedCount,
      excludedCount,
      pendingCount,
    };

    this.data.otherSettings.transactions = processedTxs;
    this.data.otherSettings.activeImportSessionId = importSessionId;
    this.data.otherSettings.activeCsvSession = activeSession;

    this.saveToStorage();
    return activeSession;
  }

  public resetCurrentCsvSession(): void {
    this.data.otherSettings.transactions = [];
    this.data.otherSettings.activeImportSessionId = undefined;
    this.data.otherSettings.activeCsvSession = undefined;
    this.saveToStorage();
  }

  // ==================================================
  // Snapshot Repository & Selector Methods (Phase 2-A)
  // ==================================================
  public getMonthlySnapshot(month: string) {
    return SnapshotService.getMonthlySnapshot(month);
  }
  public getAssetSnapshotsByMonth(month: string) {
    return SnapshotService.getAssetSnapshotsByMonth(month);
  }
  public getDebtSnapshotsByMonth(month: string) {
    return SnapshotService.getDebtSnapshotsByMonth(month);
  }
  public getOpeningSnapshotStatus(month: string) {
    return SnapshotService.getOpeningSnapshotStatus(month);
  }
  public getConfirmedOpeningSnapshot(month: string) {
    return SnapshotService.getConfirmedOpeningSnapshot(month);
  }
  public getOpeningSnapshot(month: string) {
    return SnapshotService.getOpeningSnapshot(month);
  }
  public getMonthlyDebtMovements(month: string) {
    return SnapshotService.getMonthlyDebtMovements(month);
  }
  public hasMonthlySnapshot(month: string) {
    return SnapshotService.hasMonthlySnapshot(month);
  }
  public saveMonthlySnapshot(snapshot: MonthlySnapshot) {
    SnapshotService.saveMonthlySnapshot(snapshot);
  }
  public saveAssetSnapshots(month: string, snapshots: AssetSnapshot[]) {
    SnapshotService.saveAssetSnapshots(month, snapshots);
  }
  public saveDebtSnapshots(month: string, snapshots: DebtSnapshot[]) {
    SnapshotService.saveDebtSnapshots(month, snapshots);
  }
  public saveMonthlyDebtMovement(movement: MonthlyDebtMovement) {
    SnapshotService.saveMonthlyDebtMovement(movement);
  }
  public saveOpeningSnapshot(monthly: MonthlySnapshot, assets: AssetSnapshot[], debts: DebtSnapshot[]) {
    SnapshotService.saveOpeningSnapshot(monthly, assets, debts);
    if (monthly && monthly.status === 'confirmed') {
      const monthKey = monthly.month;
      const movements = SnapshotService.getMonthlyDebtMovements(monthKey) || [];
      saveSnapshotToFirestore(monthKey, {
        monthlySnapshot: monthly,
        assetSnapshots: assets,
        debtSnapshots: debts,
        debtMovements: movements,
      }).catch((err) => {
        console.warn(`[Firestore] Failed to save confirmed snapshot for ${monthKey}:`, err);
      });
    }
  }
  public updateDraftOpeningSnapshot(monthly: MonthlySnapshot, assets: AssetSnapshot[], debts: DebtSnapshot[]) {
    SnapshotService.updateDraftOpeningSnapshot(monthly, assets, debts);
  }
  public confirmOpeningSnapshot(month: string) {
    SnapshotService.confirmOpeningSnapshot(month);
    const monthKey = month.trim();
    const confirmedMonthly = SnapshotService.getOpeningSnapshot(monthKey);
    if (confirmedMonthly && confirmedMonthly.status === 'confirmed') {
      const assets = SnapshotService.getAssetSnapshotsByMonth(monthKey);
      const debts = SnapshotService.getDebtSnapshotsByMonth(monthKey);
      const movements = SnapshotService.getMonthlyDebtMovements(monthKey) || [];
      saveSnapshotToFirestore(monthKey, {
        monthlySnapshot: confirmedMonthly,
        assetSnapshots: assets,
        debtSnapshots: debts,
        debtMovements: movements,
      }).catch((err) => {
        console.warn(`[Firestore] Failed to save confirmed snapshot for ${monthKey}:`, err);
      });
    }
  }

  public createNextMonthSnapshot(prevMonth: string, nextMonth: string) {
    return SnapshotService.createNextMonthSnapshot(prevMonth, nextMonth);
  }

  public getOpeningSnapshotData(month: string) {
    if (!month) return null;
    const monthKey = month.trim();
    const monthly = SnapshotService.getOpeningSnapshot(monthKey);
    if (!monthly) {
      return null;
    }
    const assets = SnapshotService.getAssetSnapshotsByMonth(monthKey);
    const debts = SnapshotService.getDebtSnapshotsByMonth(monthKey);
    return {
      ...monthly,
      assets,
      debts,
    };
  }

  public getOpeningSnapshotDraft(month: string) {
    if (!month) return null;
    return this.getOpeningSnapshotData(month);
  }

  public hasOpeningSnapshotDraft(month: string): boolean {
    return this.getOpeningSnapshotDraft(month) !== null;
  }

  public saveOpeningSnapshotDraft(draftInput: any) {
    let month = draftInput.month;
    let baseDate = draftInput.baseDate || draftInput.referenceDate;
    let assets = draftInput.assets || [];
    let debts = draftInput.debts || [];
    let totalAssets = draftInput.totalAssets;
    let totalDebts = draftInput.totalDebts;
    let netWorth = draftInput.netWorth;

    if (!month && draftInput.monthly) {
      month = draftInput.monthly.month;
      baseDate = baseDate || draftInput.monthly.baseDate || draftInput.monthly.referenceDate;
      totalAssets = totalAssets ?? draftInput.monthly.totalAssets;
      totalDebts = totalDebts ?? draftInput.monthly.totalDebts;
      netWorth = netWorth ?? draftInput.monthly.netWorth;
    }

    if (!month || !/^\d{4}-\d{2}$/.test(String(month).trim())) {
      throw new Error('기준월 형식이 올바르지 않습니다.');
    }
    const monthKey = String(month).trim();

    const existing = SnapshotService.getOpeningSnapshot(monthKey);
    if (existing && existing.status === 'confirmed') {
      throw new Error('확정된 시작 스냅샷은 임시저장으로 덮어쓸 수 없습니다');
    }

    const nowIso = new Date().toISOString();
    const isExistingDraft = existing && existing.status === 'draft';

    const monthlyId = isExistingDraft && existing ? existing.id : (draftInput.id || draftInput.monthly?.id || `opening-${monthKey}-${Date.now()}`);
    const createdAt = isExistingDraft && existing ? existing.createdAt : (draftInput.createdAt || draftInput.monthly?.createdAt || nowIso);

    const calculatedTotalAssets = Math.round(
      totalAssets ?? assets.filter((a: any) => a.isIncluded !== false).reduce((s: number, a: any) => s + (Number(a.value) || 0), 0)
    );
    const calculatedTotalDebts = Math.round(
      totalDebts ?? debts.filter((d: any) => d.isIncluded !== false).reduce((s: number, d: any) => s + (Number(d.openingPrincipal) || 0), 0)
    );
    const calculatedNetWorth = netWorth ?? (calculatedTotalAssets - calculatedTotalDebts);

    const updatedMonthly: MonthlySnapshot = {
      id: monthlyId,
      month: monthKey,
      status: 'draft',
      source: 'opening-seed',
      referenceDate: baseDate || `${monthKey}-01`,
      totalAssets: calculatedTotalAssets,
      totalDebts: calculatedTotalDebts,
      netWorth: calculatedNetWorth,
      createdAt,
      updatedAt: nowIso,
      confirmedAt: undefined,
      assetSnapshotIds: assets.map((a: any) => a.id),
      debtSnapshotIds: debts.map((d: any) => d.id),
    };

    const updatedAssets: AssetSnapshot[] = assets.map((a: any) => ({
      ...a,
      monthlySnapshotId: monthlyId,
      month: monthKey,
      updatedAt: nowIso,
      createdAt: a.createdAt || nowIso,
    }));

    const updatedDebts: DebtSnapshot[] = debts.map((d: any) => ({
      ...d,
      monthlySnapshotId: monthlyId,
      month: monthKey,
      updatedAt: nowIso,
      createdAt: d.createdAt || nowIso,
    }));

    SnapshotService.saveOpeningSnapshot(updatedMonthly, updatedAssets, updatedDebts);

    return {
      ...updatedMonthly,
      assets: updatedAssets,
      debts: updatedDebts,
    };
  }

  public confirmOpeningSnapshotDraft(month: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month.trim())) {
      throw new Error('기준월 형식이 올바르지 않습니다.');
    }
    const monthKey = month.trim();

    const existing = SnapshotService.getOpeningSnapshot(monthKey);

    if (existing && existing.status === 'confirmed') {
      throw new Error('이미 확정된 시작 스냅샷이 존재합니다');
    }

    if (!existing || existing.status !== 'draft') {
      throw new Error('확정할 시작 스냅샷 임시저장 데이터가 없습니다');
    }

    const assets = SnapshotService.getAssetSnapshotsByMonth(monthKey);
    const debts = SnapshotService.getDebtSnapshotsByMonth(monthKey);

    const includedAssets = assets.filter((a) => a.isIncluded !== false);
    const includedDebts = debts.filter((d) => d.isIncluded !== false);

    if (includedAssets.length < 1) {
      throw new Error('자산 항목이 최소 1개 이상 필요합니다.');
    }

    if (includedAssets.some((a) => Number(a.value) < 0)) {
      throw new Error('자산 금액은 음수가 될 수 없습니다.');
    }

    if (includedDebts.some((d) => Number(d.openingPrincipal) < 0)) {
      throw new Error('부채 원금은 음수가 될 수 없습니다.');
    }

    const totalAssets = Number(existing.totalAssets);
    const totalDebts = Number(existing.totalDebts);
    const netWorth = Number(existing.netWorth);

    if (isNaN(totalAssets) || isNaN(totalDebts) || isNaN(netWorth)) {
      throw new Error('스냅샷의 자산, 부채, 순자산 금액이 유효한 숫자가 아닙니다.');
    }

    if (Math.round(totalAssets - totalDebts) !== Math.round(netWorth)) {
      throw new Error('자산과 부채의 차이가 순자산과 일치하지 않습니다.');
    }

    const nowIso = new Date().toISOString();

    const confirmedMonthly: MonthlySnapshot = {
      ...existing,
      status: 'confirmed',
      confirmedAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedAssets = assets.map((a) => ({
      ...a,
      updatedAt: nowIso,
    }));

    const updatedDebts = debts.map((d) => ({
      ...d,
      updatedAt: nowIso,
    }));

    SnapshotService.saveMonthlySnapshot(confirmedMonthly);
    SnapshotService.saveAssetSnapshots(monthKey, updatedAssets);
    SnapshotService.saveDebtSnapshots(monthKey, updatedDebts);

    // Sync identical confirmed snapshot payload to Firestore
    const movements = SnapshotService.getMonthlyDebtMovements(monthKey) || [];
    saveSnapshotToFirestore(monthKey, {
      monthlySnapshot: confirmedMonthly,
      assetSnapshots: updatedAssets,
      debtSnapshots: updatedDebts,
      debtMovements: movements,
    }).catch((err) => {
      console.warn(`[Firestore] Failed to save confirmed snapshot draft for ${monthKey}:`, err);
    });

    this.notifyListeners();

    return {
      ...confirmedMonthly,
      assets: updatedAssets,
      debts: updatedDebts,
    };
  }

  public updateConfirmedOpeningSnapshot(payload: any) {
    let month = payload.month;
    if (!month || !/^\d{4}-\d{2}$/.test(String(month).trim())) {
      throw new Error('기준월 형식이 올바르지 않습니다.');
    }
    const monthKey = String(month).trim();

    const existing = SnapshotService.getOpeningSnapshot(monthKey);
    if (!existing || existing.status !== 'confirmed') {
      throw new Error('수정할 확정 스냅샷이 존재하지 않습니다.');
    }

    const nowIso = new Date().toISOString();

    const draft = SnapshotService.prepareOpeningSnapshotDraft(payload);

    const updatedMonthly: MonthlySnapshot = {
      ...existing,
      status: 'confirmed',
      referenceDate: payload.baseDate || payload.referenceDate || existing.referenceDate,
      totalAssets: draft.totalAssets,
      totalDebts: draft.totalDebts,
      netWorth: draft.netWorth,
      assetSnapshotIds: draft.assets.map((a: any) => a.id),
      debtSnapshotIds: draft.debts.map((d: any) => d.id),
      updatedAt: nowIso,
      revisedAt: nowIso,
    };

    SnapshotService.saveOpeningSnapshot(updatedMonthly, draft.assets, draft.debts);

    // Sync identical updated confirmed snapshot payload to Firestore
    const movements = SnapshotService.getMonthlyDebtMovements(monthKey) || [];
    saveSnapshotToFirestore(monthKey, {
      monthlySnapshot: updatedMonthly,
      assetSnapshots: draft.assets,
      debtSnapshots: draft.debts,
      debtMovements: movements,
    }).catch((err) => {
      console.warn(`[Firestore] Failed to save updated confirmed snapshot for ${monthKey}:`, err);
    });

    this.notifyListeners();

    return {
      ...updatedMonthly,
      assets: draft.assets,
      debts: draft.debts,
    };
  }
}


export interface ConsumerSpendingSummary {
  activeSessionInfo?: ActiveCsvSession;
  totalExpense: number;
  totalCount: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  top5Merchants: Array<{
    merchant: string;
    totalAmount: number;
    count: number;
  }>;
  excludedSummary: {
    count: number;
    totalAmount: number;
  };
  pendingSummary: {
    count: number;
    totalAmount: number;
  };
  totalSessionRawCount: number;
}

// Global Singleton Instance
export const GlobalMockDataStore = new GlobalMockDataStoreImpl();

/**
 * ============================================================================
 * DATA STORE INTERFACE (Requirement 7)
 * ============================================================================
 * Separating the DataStore interface from implementation ensures that when
 * switching to Firebase Firestore in the future, only the implementation class
 * (`FirebaseDataStore`) needs to be plugged in without touching any UI component.
 */
export interface IDataStore {
  // Read All Data
  getData(): AppData;

  // Domain Getters
  getUserInfo(): UserInfo;
  getAssets(): { onboardingAssets: OnboardingAsset[]; mainAssets: Asset[] };
  getDebts(): { onboardingDebts: OnboardingDebt[]; mainDebts: Debt[] };
  getIncomeSources(): IncomeSource[];
  getIncomeRecords(year?: number, month?: number): IncomeRecord[];
  getIncomeRecord(incomeSourceId: string, year: number, month: number): IncomeRecord | undefined;
  getFixedExpenses(): FixedExpenseItem[];
  getFinancialProducts(): FinancialProductItem[];
  getGoals(): { onboardingGoals: OnboardingGoal[]; mainGoals: Goal[] };
  getBusinessInfo(): BusinessInfo;
  getMerchantRules(): MerchantRule[];
  getCategoryRules(): CategoryRule[];
  getExclusionRules(): ExclusionRule[];
  getOtherSettings(): AppData['otherSettings'];

  // SSOT Calculated Summaries
  syncAutoPlannerSchedules(): void;
  getMonthlyIncomeSummary(year: number, month: number): {
    totalIncome: number;
    totalInflow: number;
    businessIncome: number;
    rentalIncome: number;
    otherIncome: number;
    inflowDetails: Array<{ id: string; name: string; type: string; amount: number; isActual: boolean }>;
  };
  getMonthlyLoanPayments(year: number, month: number): MonthlyLoanPayment[];
  saveMonthlyLoanPayment(payment: MonthlyLoanPayment): Promise<void>;
  getMonthlyCashflowSummary(year: number, month: number): {
    totalInflow: number;
    businessIncome: number;
    rentalIncome: number;
    otherIncome: number;
    inflowDetails: Array<{ id: string; name: string; type: string; amount: number; isActual: boolean }>;
    livingExpenses: number;
    financialCost: number;
    principalRepayment: number;
    otherFixed: number;
    totalOutflow: number;
    netCashflow: number;
    debtReduction: number;
    outflowDetails: Array<{ id: string; name: string; category: string; amount: number }>;
  };
  getActiveSessionTransactions(): Transaction[];
  getConsumerSpendingSummary(): ConsumerSpendingSummary;
  startNewCsvSession(payload: { fileName: string; transactions: Transaction[]; dateRange?: string }): ActiveCsvSession;
  resetCurrentCsvSession(): void;

  // Domain Mutations (Async for future Firebase Firestore calls)
  updateUserInfo(userInfo: Partial<UserInfo>): Promise<void>;
  updateOnboardingData(payload: {
    householdName?: string;
    familyMembers?: UserInfo['familyMembers'];
    incomeSources?: IncomeSource[];
    onboardingAssets?: OnboardingAsset[];
    onboardingDebts?: OnboardingDebt[];
    onboardingGoals?: OnboardingGoal[];
    businessInfo?: Partial<BusinessInfo>;
  }): Promise<void>;

  saveAsset(asset: Asset | OnboardingAsset): Promise<void>;
  deleteAsset(id: string, isFromOnboarding?: boolean): Promise<void>;

  saveDebt(debt: Debt | OnboardingDebt): Promise<void>;
  deleteDebt(id: string, isFromOnboarding?: boolean): Promise<void>;

  saveIncomeSource(income: IncomeSource): Promise<void>;
  deleteIncomeSource(id: string): Promise<void>;
  saveIncomeRecord(record: IncomeRecord): Promise<void>;
  saveIncomeRecords(records: IncomeRecord[]): Promise<void>;

  saveFixedExpense(expense: FixedExpenseItem): Promise<void>;
  deleteFixedExpense(id: string): Promise<void>;

  saveFinancialProduct(product: FinancialProductItem): Promise<void>;
  deleteFinancialProduct(id: string): Promise<void>;

  saveGoal(goal: Goal | OnboardingGoal): Promise<void>;
  deleteGoal(id: string, isFromOnboarding?: boolean): Promise<void>;

  updateBusinessInfo(info: Partial<BusinessInfo>): Promise<void>;
  updateSettlementData(settlement: Partial<SettlementData>): Promise<void>;

  addTransaction(tx: Transaction): Promise<void>;
  updateTransaction(tx: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  addSchedule(sch: ScheduleEvent): Promise<void>;
  updateSchedule(sch: ScheduleEvent): Promise<void>;

  saveMerchantRule(rule: MerchantRule, skipSave?: boolean): Promise<void>;
  saveCategoryRule(rule: CategoryRule, skipSave?: boolean): Promise<void>;
  saveExclusionRule(rule: ExclusionRule, skipSave?: boolean): Promise<void>;

  // Snapshot Repository & Selector Methods (Phase 2-A)
  getOpeningSnapshotStatus(month: string): 'confirmed' | 'draft' | 'none';
  getConfirmedOpeningSnapshot(month: string): MonthlySnapshot | null;
  getMonthlySnapshot(month: string): MonthlySnapshot | null;
  getAssetSnapshotsByMonth(month: string): AssetSnapshot[];
  getDebtSnapshotsByMonth(month: string): DebtSnapshot[];
  getOpeningSnapshot(month: string): MonthlySnapshot | null;
  getMonthlyDebtMovements(month: string): MonthlyDebtMovement[];
  hasMonthlySnapshot(month: string): boolean;
  saveMonthlySnapshot(snapshot: MonthlySnapshot): void;
  saveAssetSnapshots(month: string, snapshots: AssetSnapshot[]): void;
  saveDebtSnapshots(month: string, snapshots: DebtSnapshot[]): void;
  saveMonthlyDebtMovement(movement: MonthlyDebtMovement): void;
  saveOpeningSnapshot(monthly: MonthlySnapshot, assets: AssetSnapshot[], debts: DebtSnapshot[]): void;
  updateDraftOpeningSnapshot(monthly: MonthlySnapshot, assets: AssetSnapshot[], debts: DebtSnapshot[]): void;
  confirmOpeningSnapshot(month: string): void;
  createNextMonthSnapshot(prevMonth: string, nextMonth: string): { monthly: MonthlySnapshot; assets: AssetSnapshot[]; debts: DebtSnapshot[] };
  getOpeningSnapshotDraft(month: string): (MonthlySnapshot & { assets: AssetSnapshot[]; debts: DebtSnapshot[] }) | null;
  hasOpeningSnapshotDraft(month: string): boolean;
  saveOpeningSnapshotDraft(draftInput: any): MonthlySnapshot & { assets: AssetSnapshot[]; debts: DebtSnapshot[] };
  confirmOpeningSnapshotDraft(month: string): MonthlySnapshot & { assets: AssetSnapshot[]; debts: DebtSnapshot[] };
  updateConfirmedOpeningSnapshot(payload: any): MonthlySnapshot & { assets: AssetSnapshot[]; debts: DebtSnapshot[] };

  // Subscription for Real-time Reactive UI updates
  saveToStorage(options?: { domain?: 'all' | 'ledger' | 'ledger_and_master' | 'master' | 'planner' | 'none' }): void;
  subscribe(listener: (data: AppData) => void): () => void;
}
