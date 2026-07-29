import {
  AppData,
  UserInfo,
  OnboardingAsset,
  Asset,
  OnboardingDebt,
  Debt,
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
} from '../types';

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

const DEFAULT_INITIAL_INCOME_RECORDS: IncomeRecord[] = [
  // 2026년 5월 기록
  {
    id: 'rec-2026-05-inc-1',
    incomeSourceId: 'inc-1',
    year: 2026,
    month: 5,
    actualIncome: 4200000,
    incomeModeSnapshot: 'variable',
    incomeTypeSnapshot: '사업소득',
    incomeSourceNameSnapshot: '미용실 본점',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  },
  {
    id: 'rec-2026-05-inc-2',
    incomeSourceId: 'inc-2',
    year: 2026,
    month: 5,
    actualIncome: 2100000,
    incomeModeSnapshot: 'variable',
    incomeTypeSnapshot: '사업소득',
    incomeSourceNameSnapshot: '미용실 2호점',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  },
  {
    id: 'rec-2026-05-inc-3',
    incomeSourceId: 'inc-3',
    year: 2026,
    month: 5,
    actualIncome: 1200000,
    incomeModeSnapshot: 'variable',
    incomeTypeSnapshot: '사업소득',
    incomeSourceNameSnapshot: '게스트하우스1',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  },
  {
    id: 'rec-2026-05-inc-4',
    incomeSourceId: 'inc-4',
    year: 2026,
    month: 5,
    actualIncome: 4180000,
    incomeModeSnapshot: 'fixed',
    incomeTypeSnapshot: '임대소득',
    incomeSourceNameSnapshot: '현하우스 임대료',
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  },
  // 2026년 6월 기록
  {
    id: 'rec-2026-06-inc-1',
    incomeSourceId: 'inc-1',
    year: 2026,
    month: 6,
    actualIncome: 4500000,
    incomeModeSnapshot: 'variable',
    incomeTypeSnapshot: '사업소득',
    incomeSourceNameSnapshot: '미용실 본점',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  },
  {
    id: 'rec-2026-06-inc-2',
    incomeSourceId: 'inc-2',
    year: 2026,
    month: 6,
    actualIncome: 2200000,
    incomeModeSnapshot: 'variable',
    incomeTypeSnapshot: '사업소득',
    incomeSourceNameSnapshot: '미용실 2호점',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  },
  {
    id: 'rec-2026-06-inc-3',
    incomeSourceId: 'inc-3',
    year: 2026,
    month: 6,
    actualIncome: 1100000,
    incomeModeSnapshot: 'variable',
    incomeTypeSnapshot: '사업소득',
    incomeSourceNameSnapshot: '게스트하우스1',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  },
  {
    id: 'rec-2026-06-inc-4',
    incomeSourceId: 'inc-4',
    year: 2026,
    month: 6,
    actualIncome: 4180000,
    incomeModeSnapshot: 'fixed',
    incomeTypeSnapshot: '임대소득',
    incomeSourceNameSnapshot: '현하우스 임대료',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-01',
  },
];

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

  constructor() {
    this.data = this.loadFromStorage();
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
            incomeRecords:
              parsed.monthlyIncome?.incomeRecords && parsed.monthlyIncome.incomeRecords.length > 0
                ? parsed.monthlyIncome.incomeRecords
                : DEFAULT_INITIAL_INCOME_RECORDS,
            legacyMonthlyTotalIncome: parsed.monthlyIncome?.legacyMonthlyTotalIncome,
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

  private saveToStorage(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    this.notifyListeners();
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

  public async addTransaction(tx: Transaction): Promise<void> {
    this.data.otherSettings.transactions.unshift(tx);
    this.saveToStorage();
  }

  public async updateTransaction(tx: Transaction): Promise<void> {
    const idx = this.data.otherSettings.transactions.findIndex((t) => t.id === tx.id);
    if (idx >= 0) {
      this.data.otherSettings.transactions[idx] = tx;
      this.saveToStorage();
    }
  }

  public async deleteTransaction(id: string): Promise<void> {
    this.data.otherSettings.transactions = this.data.otherSettings.transactions.filter(
      (t) => t.id !== id
    );
    this.saveToStorage();
  }

  public async addSchedule(sch: ScheduleEvent): Promise<void> {
    this.data.otherSettings.schedules.unshift(sch);
    this.saveToStorage();
  }

  public async saveMerchantRule(rule: MerchantRule): Promise<void> {
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
    this.saveToStorage();
  }

  public async saveCategoryRule(rule: CategoryRule): Promise<void> {
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
    this.saveToStorage();
  }

  public async saveExclusionRule(rule: ExclusionRule): Promise<void> {
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
    this.saveToStorage();
  }
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

  saveMerchantRule(rule: MerchantRule): Promise<void>;
  saveCategoryRule(rule: CategoryRule): Promise<void>;
  saveExclusionRule(rule: ExclusionRule): Promise<void>;

  // Subscription for Real-time Reactive UI updates
  subscribe(listener: (data: AppData) => void): () => void;
}
