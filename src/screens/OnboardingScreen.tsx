import React, { useState, useEffect } from 'react';
import {
  ScreenId,
  FamilyMember,
  IncomeSource,
  IncomeType,
  IncomeMode,
  FixedExpenseItem,
  OnboardingAsset,
  OnboardingDebt,
  OnboardingGoal,
  RepaymentPhase,
} from '../types';
import { normalizeIncomeSource, getDefaultModeForType } from '../utils/incomeUtils';
import { GlobalMockDataStore } from '../services/dataStore';
import {
  calculateCurrentDebtPayment,
  toRepaymentType,
  toRepaymentMethodLabel,
  getRemainingMonthsFromMaturity,
  getMaturityDateFromMonths,
  validateRepaymentPhases,
} from '../utils/debtCalculator';
import {
  wonToMan,
  manToWon,
  formatManInputValue,
  parseManInputValue,
  formatKoreanAmountFromMan,
} from '../utils/amountUtils';

type OnboardingStep =
  | 'intro'
  | 'step1'
  | 'step2'
  | 'step3'
  | 'step4'
  | 'step5'
  | 'complete';

interface OnboardingScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onFinishOnboarding?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onNavigate,
  onFinishOnboarding,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('intro');

  // Household basic info
  const [householdName, setHouseholdName] = useState<string>(
    () => GlobalMockDataStore.getData().userInfo.householdName || ''
  );

  // Initial local state lists initialized from GlobalMockDataStore with deep copy
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(
    () => JSON.parse(JSON.stringify(GlobalMockDataStore.getData().userInfo.familyMembers || []))
  );
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(
    () => JSON.parse(JSON.stringify(GlobalMockDataStore.getData().monthlyIncome.incomeSources || []))
  );
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseItem[]>(
    () => JSON.parse(JSON.stringify(GlobalMockDataStore.getData().fixedExpenses || []))
  );
  const [assets, setAssets] = useState<OnboardingAsset[]>(
    () => JSON.parse(JSON.stringify(GlobalMockDataStore.getData().assets.onboardingAssets || []))
  );
  const [debts, setDebts] = useState<OnboardingDebt[]>(
    () => JSON.parse(JSON.stringify(GlobalMockDataStore.getData().debts.onboardingDebts || []))
  );
  const [goals, setGoals] = useState<OnboardingGoal[]>(
    () => JSON.parse(JSON.stringify(GlobalMockDataStore.getData().goals.onboardingGoals || []))
  );

  // Reload fresh data from GlobalMockDataStore on component mount
  useEffect(() => {
    const storeData = GlobalMockDataStore.getData();
    setHouseholdName(storeData.userInfo.householdName || '');
    setFamilyMembers(JSON.parse(JSON.stringify(storeData.userInfo.familyMembers || [])));
    setIncomeSources(JSON.parse(JSON.stringify(storeData.monthlyIncome.incomeSources || [])));
    setFixedExpenses(JSON.parse(JSON.stringify(storeData.fixedExpenses || [])));
    setAssets(JSON.parse(JSON.stringify(storeData.assets.onboardingAssets || [])));
    setDebts(JSON.parse(JSON.stringify(storeData.debts.onboardingDebts || [])));
    setGoals(JSON.parse(JSON.stringify(storeData.goals.onboardingGoals || [])));
  }, []);

  // Active modal type for CRUD
  const [activeModal, setActiveModal] = useState<
    'family' | 'income' | 'asset' | 'debt' | 'goal' | null
  >(null);

  // Item being edited or viewed
  const [editingId, setEditingId] = useState<string | null>(null);

  // Temporary Form States for Modals
  // 1. Family Member Form
  const [familyForm, setFamilyForm] = useState<{
    name: string;
    relationship: '본인' | '배우자' | '자녀' | '부모' | '기타';
    birthDate: string;
    memo: string;
  }>({
    name: '',
    relationship: '본인',
    birthDate: '1988-05-12',
    memo: '',
  });

  // 2. Income Form
  const [incomeForm, setIncomeForm] = useState<{
    incomeName: string;
    incomeType: IncomeType;
    incomeMode: IncomeMode;
    fixedMonthlyIncome: string;
    legacyMonthlyIncome: number;
    owner: string;
    memo: string;
    isActive: boolean;
  }>({
    incomeName: '',
    incomeType: '사업소득',
    incomeMode: 'variable',
    fixedMonthlyIncome: '',
    legacyMonthlyIncome: 0,
    owner: '본인',
    memo: '',
    isActive: true,
  });

  // 3. Asset Form
  const [assetForm, setAssetForm] = useState<{
    assetName: string;
    assetType: '부동산' | '금융자산' | '현금' | '기타자산';
    currentValue: string;
    memo: string;
  }>({
    assetName: '',
    assetType: '부동산',
    currentValue: '',
    memo: '',
  });

  // 4. Debt Form
  const [debtForm, setDebtForm] = useState<{
    calculationMode: 'contract' | 'current_status';
    debtName: string;
    debtType:
      | '주택담보대출'
      | '상가·부동산 담보대출'
      | '사업자대출'
      | '신용대출'
      | '마이너스통장'
      | '자동차대출'
      | '전세대출'
      | '가족·지인 차입금'
      | '기타';
    lender: string;
    originalPrincipal: string;
    currentBalance: string;
    loanStartDate: string;
    principalRepaymentStartDate: string;
    maturityDate: string;
    interestRate: string;
    rateType: '고정금리' | '변동금리' | '혼합금리';
    rateEffectiveDate: string;
    repaymentMethod:
      | '원리금균등'
      | '원금균등'
      | '만기일시상환'
      | '이자만 납부'
      | '단계별 상환'
      | '직접설정';
    paymentDay: string;
    remainingMonths: string;
    currentPrincipalPayment: string;
    currentInterestPayment: string;
    currentTotalPayment: string;
    calculationBaseDate: string;
    memo: string;
    manualPaymentOverride: boolean;
    manualPrincipalPayment: string;
    manualInterestPayment: string;
    manualTotalPayment: string;
    manualMonthlyPayment: string;
    repaymentPhases: RepaymentPhase[];
  }>({
    calculationMode: 'contract',
    debtName: '',
    debtType: '주택담보대출',
    lender: '국민은행',
    originalPrincipal: '',
    currentBalance: '',
    loanStartDate: '',
    principalRepaymentStartDate: '',
    maturityDate: '',
    interestRate: '3.90',
    rateType: '변동금리',
    rateEffectiveDate: '',
    paymentDay: '매월 25일',
    repaymentMethod: '원리금균등',
    remainingMonths: '',
    currentPrincipalPayment: '',
    currentInterestPayment: '',
    currentTotalPayment: '',
    calculationBaseDate: '',
    memo: '',
    manualPaymentOverride: false,
    manualPrincipalPayment: '',
    manualInterestPayment: '',
    manualTotalPayment: '',
    manualMonthlyPayment: '',
    repaymentPhases: [],
  });

  // 5. Goal Form
  const [goalForm, setGoalForm] = useState<{
    goalName: string;
    goalType: '부채상환' | '내집마련' | '비상금' | '투자' | '교육' | '은퇴' | '여행' | '기타';
    targetAmount: string;
    targetDate: string;
    memo: string;
  }>({
    goalName: '',
    goalType: '부채상환',
    targetAmount: '',
    targetDate: '2028-12-31',
    memo: '',
  });

  // Utility to calculate 만 나이 from birthDate
  const calculateAge = (birthDateStr: string): number => {
    if (!birthDateStr) return 0;
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age < 0 ? 0 : age;
  };

  // Utility to format number with commas
  const formatNumber = (val: number | string): string => {
    if (val === undefined || val === null || val === '') return '';
    const num = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('ko-KR');
  };

  const parseNumber = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).replace(/,/g, '').trim();
    if (str.includes('억')) {
      const parts = str.split('억');
      const eok = Number(parts[0].replace(/[^0-9.]/g, '')) || 0;
      const rest = parts[1] ? Number(parts[1].replace(/[^0-9.]/g, '')) || 0 : 0;
      return eok * 100000000 + rest * (parts[1] && parts[1].includes('만') ? 10000 : 1);
    }
    if (str.includes('만')) {
      const man = Number(str.replace(/[^0-9.]/g, '')) || 0;
      return man * 10000;
    }
    const raw = str.replace(/[^0-9]/g, '');
    return Number(raw) || 0;
  };

  const todayFormatted = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일`;
  };

  // Step Navigation Logic
  const handleNext = () => {
    switch (currentStep) {
      case 'intro':
        setCurrentStep('step1');
        break;
      case 'step1':
        GlobalMockDataStore.updateUserInfo({ householdName });
        setCurrentStep('step2');
        break;
      case 'step2':
        setCurrentStep('step3');
        break;
      case 'step3':
        setCurrentStep('step4');
        break;
      case 'step4':
        setCurrentStep('step5');
        break;
      case 'step5':
        setCurrentStep('complete');
        break;
      case 'complete':
        GlobalMockDataStore.updateOnboardingData({
          householdName,
          familyMembers,
          incomeSources,
          onboardingAssets: assets,
          onboardingDebts: debts,
          onboardingGoals: goals,
        });
        if (onFinishOnboarding) {
          onFinishOnboarding();
        } else {
          onNavigate('1-0');
        }
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'step1':
        setCurrentStep('intro');
        break;
      case 'step2':
        setCurrentStep('step1');
        break;
      case 'step3':
        setCurrentStep('step2');
        break;
      case 'step4':
        setCurrentStep('step3');
        break;
      case 'step5':
        setCurrentStep('step4');
        break;
      case 'complete':
        setCurrentStep('step5');
        break;
      default:
        onNavigate('1-0');
        break;
    }
  };

  // Step Header Meta
  const getStepInfo = () => {
    switch (currentStep) {
      case 'step1':
        return { num: 1, percent: 20, title: '기본정보' };
      case 'step2':
        return { num: 2, percent: 40, title: '수입원' };
      case 'step3':
        return { num: 3, percent: 60, title: '자산' };
      case 'step4':
        return { num: 4, percent: 80, title: '부채' };
      case 'step5':
        return { num: 5, percent: 100, title: '목표' };
      default:
        return null;
    }
  };

  const stepInfo = getStepInfo();

  // Modal Open Handlers
  const openFamilyModal = (item?: FamilyMember) => {
    if (item) {
      setEditingId(item.id);
      setFamilyForm({
        name: item.name,
        relationship: item.relationship,
        birthDate: item.birthDate,
        memo: item.memo || '',
      });
    } else {
      setEditingId(null);
      setFamilyForm({
        name: '',
        relationship: '본인',
        birthDate: '1988-05-12',
        memo: '',
      });
    }
    setActiveModal('family');
  };

  const openIncomeModal = (item?: IncomeSource) => {
    if (item) {
      const norm = normalizeIncomeSource(item);
      setEditingId(norm.id);
      setIncomeForm({
        incomeName: norm.name || norm.incomeName || '',
        incomeType: norm.incomeType || '사업소득',
        incomeMode: norm.incomeMode || 'variable',
        fixedMonthlyIncome:
          norm.fixedMonthlyIncome !== null && norm.fixedMonthlyIncome !== undefined
            ? String(norm.fixedMonthlyIncome)
            : '',
        legacyMonthlyIncome: norm.legacyMonthlyIncome || 0,
        owner: norm.owner || '본인',
        memo: norm.memo || '',
        isActive: norm.isActive !== undefined ? norm.isActive : true,
      });
    } else {
      setEditingId(null);
      setIncomeForm({
        incomeName: '',
        incomeType: '사업소득',
        incomeMode: 'variable',
        fixedMonthlyIncome: '',
        legacyMonthlyIncome: 0,
        owner: '본인',
        memo: '',
        isActive: true,
      });
    }
    setActiveModal('income');
  };

  const openAssetModal = (item?: OnboardingAsset) => {
    if (item) {
      setEditingId(item.id);
      setAssetForm({
        assetName: item.assetName,
        assetType: item.assetType,
        currentValue: item.currentValue ? String(wonToMan(item.currentValue)) : '',
        memo: item.memo || '',
      });
    } else {
      setEditingId(null);
      setAssetForm({
        assetName: '',
        assetType: '부동산',
        currentValue: '',
        memo: '',
      });
    }
    setActiveModal('asset');
  };

  const openDebtModal = (item?: OnboardingDebt) => {
    if (item) {
      setEditingId(item.id);
      const remMonths =
        item.remainingMonths ||
        (item.maturityDate ? getRemainingMonthsFromMaturity(item.maturityDate) : 0);
      setDebtForm({
        calculationMode: item.calculationMode || 'contract',
        debtName: item.debtName || '',
        debtType: item.debtType || '주택담보대출',
        lender: item.lender || '',
        originalPrincipal: item.originalPrincipal ? String(wonToMan(item.originalPrincipal)) : '',
        currentBalance: item.currentBalance ? String(wonToMan(item.currentBalance)) : '',
        loanStartDate: item.loanStartDate || '',
        principalRepaymentStartDate:
          item.principalRepaymentStartDate || item.repaymentStartDate || item.principalStartDate || '',
        maturityDate: item.maturityDate || '',
        interestRate:
          item.interestRate !== undefined
            ? String(item.interestRate)
            : item.annualRate !== undefined
            ? String(item.annualRate)
            : '3.90',
        rateType: item.rateType || '변동금리',
        rateEffectiveDate: item.rateEffectiveDate || '',
        paymentDay: item.paymentDay || '매월 25일',
        repaymentMethod: item.repaymentMethod || (toRepaymentMethodLabel(item.repaymentType) as any),
        remainingMonths: remMonths ? String(remMonths) : '',
        currentPrincipalPayment: item.currentPrincipalPayment ? String(wonToMan(item.currentPrincipalPayment)) : '',
        currentInterestPayment: item.currentInterestPayment ? String(wonToMan(item.currentInterestPayment)) : '',
        currentTotalPayment: item.currentTotalPayment ? String(wonToMan(item.currentTotalPayment)) : '',
        calculationBaseDate: item.calculationBaseDate || todayFormatted(),
        memo: item.memo || '',
        manualPaymentOverride: Boolean(
          item.manualPaymentOverride || item.repaymentMethod === '직접설정'
        ),
        manualPrincipalPayment: item.manualPrincipalPayment ? String(wonToMan(item.manualPrincipalPayment)) : '',
        manualInterestPayment: item.manualInterestPayment ? String(wonToMan(item.manualInterestPayment)) : '',
        manualTotalPayment: item.manualTotalPayment ? String(wonToMan(item.manualTotalPayment)) : '',
        manualMonthlyPayment: item.manualMonthlyPayment
          ? String(wonToMan(item.manualMonthlyPayment))
          : item.monthlyPayment
          ? String(wonToMan(item.monthlyPayment))
          : '',
        repaymentPhases: item.repaymentPhases || [],
      });
    } else {
      setEditingId(null);
      setDebtForm({
        calculationMode: 'contract',
        debtName: '',
        debtType: '주택담보대출',
        lender: '국민은행',
        originalPrincipal: '',
        currentBalance: '',
        loanStartDate: '',
        principalRepaymentStartDate: '',
        maturityDate: '',
        interestRate: '3.90',
        rateType: '변동금리',
        rateEffectiveDate: '',
        paymentDay: '매월 25일',
        repaymentMethod: '원리금균등',
        remainingMonths: '',
        currentPrincipalPayment: '',
        currentInterestPayment: '',
        currentTotalPayment: '',
        calculationBaseDate: todayFormatted(),
        memo: '',
        manualPaymentOverride: false,
        manualPrincipalPayment: '',
        manualInterestPayment: '',
        manualTotalPayment: '',
        manualMonthlyPayment: '',
        repaymentPhases: [],
      });
    }
    setActiveModal('debt');
  };

  const openGoalModal = (item?: OnboardingGoal) => {
    if (item) {
      setEditingId(item.id);
      setGoalForm({
        goalName: item.goalName,
        goalType: item.goalType,
        targetAmount: item.targetAmount ? String(item.targetAmount) : '',
        targetDate: item.targetDate || '2028-12-31',
        memo: item.memo || '',
      });
    } else {
      setEditingId(null);
      setGoalForm({
        goalName: '',
        goalType: '부채상환',
        targetAmount: '',
        targetDate: '2028-12-31',
        memo: '',
      });
    }
    setActiveModal('goal');
  };

  // Save Handlers
  const handleSaveFamily = () => {
    if (!familyForm.name.trim()) return;
    const calculatedAge = calculateAge(familyForm.birthDate);
    let nextList: FamilyMember[] = [];
    if (editingId) {
      nextList = familyMembers.map((m) =>
        m.id === editingId
          ? {
              ...m,
              name: familyForm.name.trim(),
              relationship: familyForm.relationship,
              birthDate: familyForm.birthDate,
              calculatedAge,
              memo: familyForm.memo,
            }
          : m
      );
    } else {
      const newItem: FamilyMember = {
        id: `fam-${Date.now()}`,
        name: familyForm.name.trim(),
        relationship: familyForm.relationship,
        birthDate: familyForm.birthDate,
        calculatedAge,
        memo: familyForm.memo,
      };
      nextList = [...familyMembers, newItem];
    }
    setFamilyMembers(nextList);
    GlobalMockDataStore.updateOnboardingData({ familyMembers: nextList });
    setActiveModal(null);
  };

  const handleSaveIncome = () => {
    if (!incomeForm.incomeName.trim()) return;

    const isFixed = incomeForm.incomeMode === 'fixed';
    const fixedAmount = isFixed ? parseNumber(incomeForm.fixedMonthlyIncome) : null;
    const legacyAmount =
      incomeForm.legacyMonthlyIncome > 0
        ? incomeForm.legacyMonthlyIncome
        : (fixedAmount ?? 0);

    const nameTrimmed = incomeForm.incomeName.trim();

    const newItem: IncomeSource = {
      id: editingId || `inc-${Date.now()}`,
      name: nameTrimmed,
      incomeName: nameTrimmed,
      incomeType: incomeForm.incomeType,
      incomeMode: incomeForm.incomeMode,
      fixedMonthlyIncome: fixedAmount,
      legacyMonthlyIncome: legacyAmount,
      previousRegisteredIncome: legacyAmount,
      monthlyIncome: isFixed ? (fixedAmount ?? 0) : 0,
      owner: incomeForm.owner.trim() || '본인',
      memo: incomeForm.memo.trim(),
      isActive: incomeForm.isActive,
      createdAt: editingId
        ? incomeSources.find((i) => i.id === editingId)?.createdAt ||
          new Date().toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    let nextList: IncomeSource[] = [];
    if (editingId) {
      nextList = incomeSources.map((i) => (i.id === editingId ? newItem : i));
    } else {
      nextList = [...incomeSources, newItem];
    }
    setIncomeSources(nextList);
    GlobalMockDataStore.updateOnboardingData({ incomeSources: nextList });
    setActiveModal(null);
  };

  const handleSaveAsset = () => {
    if (!assetForm.assetName.trim()) return;
    const amount = manToWon(parseManInputValue(assetForm.currentValue));
    let nextList: OnboardingAsset[] = [];
    if (editingId) {
      nextList = assets.map((a) =>
        a.id === editingId
          ? {
              ...a,
              assetName: assetForm.assetName.trim(),
              assetType: assetForm.assetType,
              currentValue: amount,
              memo: assetForm.memo,
            }
          : a
      );
    } else {
      const newItem: OnboardingAsset = {
        id: `ast-${Date.now()}`,
        assetName: assetForm.assetName.trim(),
        assetType: assetForm.assetType,
        currentValue: amount,
        memo: assetForm.memo,
      };
      nextList = [...assets, newItem];
    }
    setAssets(nextList);
    GlobalMockDataStore.updateOnboardingData({ onboardingAssets: nextList });
    setActiveModal(null);
  };

  const handleSaveDebt = () => {
    if (!debtForm.debtName.trim()) return;
    const origPrincipal = manToWon(parseManInputValue(debtForm.originalPrincipal));
    const balance = manToWon(parseManInputValue(debtForm.currentBalance));
    const rate = Number(debtForm.interestRate) || 0;
    const curP = manToWon(parseManInputValue(debtForm.currentPrincipalPayment));
    const curI = manToWon(parseManInputValue(debtForm.currentInterestPayment));
    const curT = manToWon(parseManInputValue(debtForm.currentTotalPayment)) || (curP + curI);

    const months =
      Number(debtForm.remainingMonths) ||
      (debtForm.maturityDate ? getRemainingMonthsFromMaturity(debtForm.maturityDate) : 0);

    const manualP = manToWon(parseManInputValue(debtForm.manualPrincipalPayment));
    const manualI = manToWon(parseManInputValue(debtForm.manualInterestPayment));
    const manualT = manToWon(parseManInputValue(debtForm.manualTotalPayment));
    const manualM = manToWon(parseManInputValue(debtForm.manualMonthlyPayment));

    const calcRes = calculateCurrentDebtPayment({
      calculationMode: debtForm.calculationMode,
      currentBalance: balance,
      originalPrincipal: origPrincipal,
      interestRate: rate,
      annualRate: rate,
      rateType: debtForm.rateType,
      repaymentMethod: debtForm.repaymentMethod as any,
      repaymentType: toRepaymentType(debtForm.repaymentMethod),
      loanStartDate: debtForm.loanStartDate,
      principalRepaymentStartDate: debtForm.principalRepaymentStartDate,
      repaymentStartDate: debtForm.principalRepaymentStartDate,
      maturityDate: debtForm.maturityDate,
      remainingMonths: months,
      currentPrincipalPayment: curP,
      currentInterestPayment: curI,
      currentTotalPayment: curT,
      manualPaymentOverride: debtForm.manualPaymentOverride,
      manualPrincipalPayment: manualP,
      manualInterestPayment: manualI,
      manualTotalPayment: manualT || manualM,
      manualMonthlyPayment: manualM || manualT,
      repaymentPhases: debtForm.repaymentPhases,
    });

    const finalMonthlyPayment = debtForm.manualPaymentOverride
      ? manualT || manualM || calcRes.currentTotal
      : calcRes.currentTotal;

    const nowStr = todayFormatted();

    const debtItem: OnboardingDebt = {
      id: editingId || `dbt-${Date.now()}`,
      calculationMode: debtForm.calculationMode,
      debtName: debtForm.debtName.trim(),
      debtType: debtForm.debtType,
      lender: debtForm.lender.trim() || '금융기관',
      originalPrincipal: origPrincipal,
      currentBalance: balance,
      interestRate: rate,
      annualRate: rate,
      rateType: debtForm.rateType,
      rateEffectiveDate: debtForm.rateEffectiveDate,
      monthlyPayment: finalMonthlyPayment,
      paymentDay: debtForm.paymentDay.trim() || '매월 25일',
      repaymentMethod: debtForm.repaymentMethod as any,
      repaymentType: toRepaymentType(debtForm.repaymentMethod),
      loanStartDate: debtForm.loanStartDate,
      principalRepaymentStartDate: debtForm.principalRepaymentStartDate,
      repaymentStartDate: debtForm.principalRepaymentStartDate,
      principalStartDate: debtForm.principalRepaymentStartDate,
      maturityDate: debtForm.maturityDate,
      remainingMonths: months,
      currentPrincipalPayment: curP,
      currentInterestPayment: curI,
      currentTotalPayment: curT,
      calculationBaseDate: debtForm.calculationBaseDate || nowStr,
      calculatedPrincipalPayment: calcRes.currentPrincipal,
      calculatedInterestPayment: calcRes.currentInterest,
      calculatedMonthlyPayment: calcRes.currentTotal,
      manualPaymentOverride: debtForm.manualPaymentOverride,
      manualPrincipalPayment: manualP,
      manualInterestPayment: manualI,
      manualTotalPayment: manualT,
      manualMonthlyPayment: manualM || manualT,
      repaymentPhases: debtForm.repaymentPhases,
      memo: debtForm.memo,
      createdAt: editingId ? debts.find((d) => d.id === editingId)?.createdAt || nowStr : nowStr,
      updatedAt: nowStr,
    };

    let nextList: OnboardingDebt[] = [];
    if (editingId) {
      nextList = debts.map((d) => (d.id === editingId ? debtItem : d));
    } else {
      nextList = [...debts, debtItem];
    }
    setDebts(nextList);
    GlobalMockDataStore.updateOnboardingData({ onboardingDebts: nextList });
    setActiveModal(null);
  };

  const handleSaveGoal = () => {
    if (!goalForm.goalName.trim()) return;
    const amount = parseNumber(goalForm.targetAmount);
    let nextList: OnboardingGoal[] = [];
    if (editingId) {
      nextList = goals.map((g) =>
        g.id === editingId
          ? {
              ...g,
              goalName: goalForm.goalName.trim(),
              goalType: goalForm.goalType,
              targetAmount: amount,
              targetDate: goalForm.targetDate,
              memo: goalForm.memo,
            }
          : g
      );
    } else {
      const newItem: OnboardingGoal = {
        id: `gol-${Date.now()}`,
        goalName: goalForm.goalName.trim(),
        goalType: goalForm.goalType,
        targetAmount: amount,
        targetDate: goalForm.targetDate,
        memo: goalForm.memo,
      };
      nextList = [...goals, newItem];
    }
    setGoals(nextList);
    GlobalMockDataStore.updateOnboardingData({ onboardingGoals: nextList });
    setActiveModal(null);
  };

  // Delete Handlers
  const handleDeleteFamily = (id: string) => {
    const nextList = familyMembers.filter((item) => item.id !== id);
    setFamilyMembers(nextList);
    GlobalMockDataStore.updateOnboardingData({ familyMembers: nextList });
  };
  const handleDeleteIncome = (id: string) => {
    const nextList = incomeSources.filter((item) => item.id !== id);
    setIncomeSources(nextList);
    GlobalMockDataStore.updateOnboardingData({ incomeSources: nextList });
  };
  const handleDeleteAsset = (id: string) => {
    const nextList = assets.filter((item) => item.id !== id);
    setAssets(nextList);
    GlobalMockDataStore.updateOnboardingData({ onboardingAssets: nextList });
  };
  const handleDeleteDebt = (id: string) => {
    const nextList = debts.filter((item) => item.id !== id);
    setDebts(nextList);
    GlobalMockDataStore.updateOnboardingData({ onboardingDebts: nextList });
  };
  const handleDeleteGoal = (id: string) => {
    const nextList = goals.filter((item) => item.id !== id);
    setGoals(nextList);
    GlobalMockDataStore.updateOnboardingData({ onboardingGoals: nextList });
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e] flex flex-col justify-between max-w-2xl mx-auto px-5 py-6 font-pretendard">
      {/* Top Header & Wizard Progress */}
      <header className="w-full mb-6">
        <div className="flex items-center justify-between h-10 mb-2">
          {currentStep !== 'intro' ? (
            <button
              onClick={handleBack}
              className="p-2 -ml-2 rounded-full text-[#00236f] hover:bg-[#e6e8ea] transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
          ) : (
            <div className="w-8" />
          )}

          {/* Step numbers indicator (Only for step1 ~ step5) */}
          {stepInfo ? (
            <div className="flex items-center gap-1.5 font-dohyeon text-sm text-[#00236f]">
              <span className="bg-[#00236f] text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                {stepInfo.num} / 5
              </span>
              <span>{stepInfo.title}</span>
            </div>
          ) : (
            <div className="font-dohyeon text-base text-[#00236f] tracking-tight">
              우리집 CFO
            </div>
          )}

          <button
            onClick={() => onNavigate('1-0')}
            className="text-xs font-bold text-[#757682] hover:text-[#00236f] px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            건너뛰기
          </button>
        </div>

        {/* Progress Bar Line */}
        {stepInfo && (
          <div className="w-full bg-[#eceef0] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[#00236f] h-full transition-all duration-300 rounded-full"
              style={{ width: `${stepInfo.percent}%` }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start my-auto pb-28">
        {/* ================= 환영 화면 (Welcome) ================= */}
        {currentStep === 'intro' && (
          <div className="space-y-8 animate-fadeIn my-auto py-4">
            {/* Logo / Header Icon */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-[#00236f] text-[#6cf8bb] rounded-3xl flex items-center justify-center shadow-lg mb-5 relative">
                <span className="material-symbols-outlined text-[42px]">
                  account_balance
                </span>
                <div className="absolute -bottom-1 -right-1 bg-[#6cf8bb] text-[#004d33] w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#f7f9fb] shadow-xs">
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                </div>
              </div>

              <h1 className="font-dohyeon text-2xl sm:text-3xl text-[#00236f] mb-3 leading-snug">
                우리집 CFO를 시작해볼까요
              </h1>
              <p className="font-body-sm text-sm text-[#444651] max-w-sm leading-relaxed whitespace-pre-line text-center">
                {`가족의 소득, 자산, 부채와 목표를 등록하면\n우리집 재무현황을 한눈에 관리할 수 있습니다`}
              </p>
            </div>

            {/* Info Cards */}
            <div className="space-y-3.5">
              <div className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 bg-[#e6f4ea] text-[#006c49] rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">timer</span>
                </div>
                <div>
                  <h3 className="font-dohyeon text-base text-[#191c1e]">약 2분 소요</h3>
                  <p className="text-xs text-[#757682]">
                    복잡한 서류 없이 카드 목록 추가 방식으로 간편하게 완료됩니다.
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 bg-[#e8efff] text-[#00236f] rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">edit_note</span>
                </div>
                <div>
                  <h3 className="font-dohyeon text-base text-[#191c1e]">
                    언제든 다시 수정 가능
                  </h3>
                  <p className="text-xs text-[#757682]">
                    등록된 모든 항목은 이후 자유롭게 추가, 수정, 삭제할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 bg-[#ffedd8] text-[#5c3800] rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">upload_file</span>
                </div>
                <div>
                  <h3 className="font-dohyeon text-base text-[#191c1e]">
                    CSV 업로드는 Home에서 진행
                  </h3>
                  <p className="text-xs text-[#757682]">
                    초기 설정 완료 후 Home에서 매월 거래내역을 업로드하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= Step 1: 기본정보 (Family) ================= */}
        {currentStep === 'step1' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md">
                1단계 / 기본정보
              </span>
              <h2 className="font-dohyeon text-2xl text-[#00236f] mt-3 mb-1">
                가구명과 가족 구성원을 등록해주세요
              </h2>
              <p className="text-xs text-[#757682]">
                가족 구성원의 생년월일을 등록하면 향후 생애주기 이벤트를 파악할 수 있습니다.
              </p>
            </div>

            {/* Household Name */}
            <div className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs">
              <label className="text-xs font-bold text-[#444651] mb-2 block">
                가구명
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                onBlur={() => GlobalMockDataStore.updateUserInfo({ householdName })}
                placeholder="은석네 가족"
                className="w-full px-4 py-3 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] font-semibold focus:outline-none focus:border-[#00236f]"
              />
            </div>

            {/* Family Members List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">group</span>
                  가족 구성원 목록
                  <span className="text-xs font-normal text-[#757682]">
                    ({familyMembers.length}명)
                  </span>
                </h3>
              </div>

              {familyMembers.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-[#c5c5d3] text-center text-xs text-[#757682] space-y-2">
                  <p>등록된 가족 구성원이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0]">
                    아래 버튼을 눌러 본인, 배우자, 자녀 등을 등록해 주세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {familyMembers.map((member) => (
                    <div
                      key={member.id}
                      className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-dohyeon text-base text-[#191c1e]">
                            {member.name}
                          </span>
                          <span className="text-[11px] font-bold bg-[#e8efff] text-[#00236f] px-2 py-0.5 rounded-md">
                            {member.relationship}
                          </span>
                          <span className="text-[11px] font-bold bg-[#e6f4ea] text-[#006c49] px-2 py-0.5 rounded-md">
                            만 {member.calculatedAge}세
                          </span>
                        </div>
                        <p className="text-xs text-[#757682]">
                          {member.birthDate} 출생
                          {member.memo && ` · ${member.memo}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openFamilyModal(member)}
                          className="p-1.5 text-[#757682] hover:text-[#00236f] hover:bg-[#f0f4fd] rounded-lg transition-colors cursor-pointer"
                          title="수정"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteFamily(member.id)}
                          className="p-1.5 text-[#757682] hover:text-[#ba1a1a] hover:bg-[#ffebee] rounded-lg transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Member Button */}
              <button
                onClick={() => openFamilyModal()}
                className="w-full mt-3.5 py-3.5 bg-white border border-[#00236f]/30 text-[#00236f] font-dohyeon text-sm rounded-2xl hover:bg-[#f0f4fd] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                + 가족 구성원 추가
              </button>
            </div>

            <p className="text-center text-xs text-[#757682] mt-6">
              나중에도 언제든 추가하거나 수정할 수 있습니다
            </p>
          </div>
        )}

        {/* ================= Step 2: 수입원 등록 (Income Sources) ================= */}
        {currentStep === 'step2' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md">
                2단계 / 수입원 등록
              </span>
              <h2 className="font-dohyeon text-2xl text-[#00236f] mt-3 mb-1">
                수입원을 등록해주세요
              </h2>
              <p className="text-xs text-[#757682] whitespace-pre-line leading-relaxed">
                {`가정과 사업에서 발생하는 주요 수입원을 등록합니다.\n고정수입은 월 금액을 입력하고, 변동수입은 월간결산에서 실제 금액을 입력합니다.`}
              </p>
            </div>

            {/* Income Source List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">payments</span>
                  등록된 수입원
                  <span className="text-xs font-normal text-[#757682]">
                    ({incomeSources.length}건)
                  </span>
                </h3>
              </div>

              {incomeSources.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-[#c5c5d3] text-center text-xs text-[#757682] space-y-2">
                  <p>등록된 수입원이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0]">
                    아래 버튼을 눌러 수입원을 등록해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomeSources.map((rawIncome) => {
                    const income = normalizeIncomeSource(rawIncome);
                    const isFixed = income.incomeMode === 'fixed';
                    return (
                      <div
                        key={income.id}
                        className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="text-[11px] font-bold bg-[#e6f4ea] text-[#006c49] px-2 py-0.5 rounded-md">
                              {income.incomeType}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                isFixed
                                  ? 'bg-[#e8f0fe] text-[#1a73e8]'
                                  : 'bg-[#fef3c7] text-[#92400e]'
                              }`}
                            >
                              {isFixed ? '고정수입' : '변동수입'}
                            </span>
                            {income.owner && (
                              <span className="text-[10px] bg-[#f0f2f5] text-[#555] px-1.5 py-0.5 rounded">
                                {income.owner}
                              </span>
                            )}
                          </div>

                          <div className="font-dohyeon text-base text-[#191c1e]">
                            {income.name || income.incomeName}
                          </div>

                          {isFixed ? (
                            <p className="text-xs text-[#444651]">
                              월{' '}
                              <span className="font-dohyeon text-base text-[#006c49]">
                                {formatNumber(
                                  income.fixedMonthlyIncome ??
                                    income.legacyMonthlyIncome ??
                                    0
                                )}
                                원
                              </span>
                            </p>
                          ) : (
                            <p className="text-xs text-[#757682] font-medium">
                              월간결산에서 실제 금액 입력
                            </p>
                          )}

                          {income.memo && (
                            <p className="text-xs text-[#757682]">{income.memo}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openIncomeModal(income)}
                            className="w-10 h-10 flex items-center justify-center text-[#757682] hover:text-[#00236f] hover:bg-[#f0f4fd] active:bg-[#e0e8fa] active:scale-95 rounded-xl transition-all cursor-pointer shrink-0"
                            title="수정"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteIncome(income.id)}
                            className="w-10 h-10 flex items-center justify-center text-[#757682] hover:text-[#ba1a1a] hover:bg-[#ffebee] active:bg-[#fcdabf] active:scale-95 rounded-xl transition-all cursor-pointer shrink-0"
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Income Source Button */}
              <button
                type="button"
                onClick={() => openIncomeModal()}
                className="w-full mt-3.5 py-4 px-4 bg-white border-2 border-[#00236f]/30 text-[#00236f] font-dohyeon text-base rounded-2xl hover:bg-[#f0f4fd] active:bg-[#e0e8fa] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[50px]"
              >
                <span className="material-symbols-outlined text-xl">add_circle</span>
                + 수입원 추가
              </button>
            </div>

            <p className="text-center text-xs text-[#757682] mt-6 whitespace-pre-line leading-relaxed">
              {`수입원은 언제든 추가·수정할 수 있으며,\n실제 수입 금액은 매월 결산 시 입력합니다.`}
            </p>
          </div>
        )}

        {/* ================= Step 3: 자산 (Assets) ================= */}
        {currentStep === 'step3' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md">
                3단계 / 자산
              </span>
              <h2 className="font-dohyeon text-2xl text-[#00236f] mt-3 mb-1">
                보유 자산을 등록해주세요
              </h2>
              <p className="text-xs text-[#757682]">
                부동산, 주식, 예적금, 현금 등 보유 중인 모든 자산을 추가하세요.
              </p>
            </div>

            {/* Asset List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
                  등록된 자산 목록
                  <span className="text-xs font-normal text-[#757682]">
                    ({assets.length}건)
                  </span>
                </h3>
              </div>

              {assets.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-[#c5c5d3] text-center text-xs text-[#757682] space-y-2">
                  <p>등록된 자산 항목이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0]">
                    아래 버튼을 눌러 아파트, 주식, 통장 등을 등록해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-dohyeon text-base text-[#191c1e]">
                            {asset.assetName}
                          </span>
                          <span className="text-[11px] font-bold bg-[#e8efff] text-[#00236f] px-2 py-0.5 rounded-md">
                            {asset.assetType}
                          </span>
                        </div>
                        <p className="text-xs text-[#444651]">
                          현재 가치{' '}
                          <span className="font-dohyeon text-base text-[#00236f]">
                            {formatNumber(asset.currentValue)}원
                          </span>
                        </p>
                        {asset.memo && (
                          <p className="text-xs text-[#757682]">{asset.memo}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openAssetModal(asset)}
                          className="p-1.5 text-[#757682] hover:text-[#00236f] hover:bg-[#f0f4fd] rounded-lg transition-colors cursor-pointer"
                          title="수정"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-1.5 text-[#757682] hover:text-[#ba1a1a] hover:bg-[#ffebee] rounded-lg transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Asset Button */}
              <button
                onClick={() => openAssetModal()}
                className="w-full mt-3.5 py-3.5 bg-white border border-[#00236f]/30 text-[#00236f] font-dohyeon text-sm rounded-2xl hover:bg-[#f0f4fd] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                + 자산 추가
              </button>
            </div>

            <p className="text-center text-xs text-[#757682] mt-6">
              나중에도 언제든 추가하거나 수정할 수 있습니다
            </p>
          </div>
        )}

        {/* ================= Step 4: 부채 (Debts) ================= */}
        {currentStep === 'step4' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md">
                4단계 / 부채
              </span>
              <h2 className="font-dohyeon text-2xl text-[#00236f] mt-3 mb-1">
                대출 및 부채 항목을 등록해주세요
              </h2>
              <p className="text-xs text-[#757682]">
                담보대출, 신용대출, 마이너스통장 등 보유 중인 부채 상세정보를 등록합니다.
              </p>
            </div>

            {/* Debt List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">credit_card</span>
                  등록된 부채 목록
                  <span className="text-xs font-normal text-[#757682]">
                    ({debts.length}건)
                  </span>
                </h3>
              </div>

              {debts.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-[#c5c5d3] text-center text-xs text-[#757682] space-y-2">
                  <p>등록된 부채 항목이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0]">
                    아래 버튼을 눌러 담보대출, 신용대출 등을 등록해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {debts.map((debt) => (
                    <div
                      key={debt.id}
                      className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-3"
                    >
                      {/* Top Header: Title & Actions */}
                      <div className="flex items-start justify-between border-b border-[#eceef0] pb-2.5">
                        <div>
                          <h4 className="font-dohyeon text-lg text-[#191c1e] leading-tight">
                            {debt.debtName}
                          </h4>
                          <p className="text-xs text-[#757682] mt-0.5">
                            {debt.debtType} · {debt.lender}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDebtModal(debt)}
                            className="p-1.5 text-[#00236f] bg-[#f0f4fd] rounded-lg text-xs font-bold flex items-center gap-0.5 hover:bg-[#e0eafc] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteDebt(debt.id)}
                            className="p-1.5 text-[#ba1a1a] bg-[#ffebee] rounded-lg text-xs font-bold flex items-center gap-0.5 hover:bg-[#ffdde0] transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <span className="text-[#757682] block text-[11px]">잔액</span>
                          <span className="font-dohyeon text-sm text-[#ba1a1a]">
                            {formatNumber(debt.currentBalance)}원
                          </span>
                        </div>
                        <div>
                          <span className="text-[#757682] block text-[11px]">금리</span>
                          <span className="font-dohyeon text-sm text-[#191c1e]">
                            {debt.interestRate}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[#757682] block text-[11px]">월 상환액</span>
                          <span className="font-dohyeon text-sm text-[#00236f]">
                            {formatNumber(debt.monthlyPayment)}원
                          </span>
                        </div>
                        <div>
                          <span className="text-[#757682] block text-[11px]">월 납부일</span>
                          <span className="font-semibold text-[#191c1e]">
                            {debt.paymentDay}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#757682] block text-[11px]">상환방식</span>
                          <span className="font-semibold text-[#191c1e]">
                            {debt.repaymentMethod}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#757682] block text-[11px]">최근 수정</span>
                          <span className="text-[#757682] text-[11px]">
                            {debt.updatedAt}
                          </span>
                        </div>
                      </div>

                      {debt.customSchedule && (
                        <div className="bg-[#f7f9fb] p-2.5 rounded-xl border border-[#c5c5d3]/20 text-[11px] text-[#444651]">
                          <span className="font-bold text-[#00236f]">상환 스케줄: </span>
                          {debt.customSchedule}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Debt Button */}
              <button
                onClick={() => openDebtModal()}
                className="w-full mt-3.5 py-3.5 bg-white border border-[#00236f]/30 text-[#00236f] font-dohyeon text-sm rounded-2xl hover:bg-[#f0f4fd] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                + 부채 추가
              </button>
            </div>

            <p className="text-center text-xs text-[#757682] mt-6">
              나중에도 언제든 추가하거나 수정할 수 있습니다
            </p>
          </div>
        )}

        {/* ================= Step 5: 목표 (Goals) ================= */}
        {currentStep === 'step5' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md">
                5단계 / 목표
              </span>
              <h2 className="font-dohyeon text-2xl text-[#00236f] mt-3 mb-1">
                재무 목표를 등록해주세요
              </h2>
              <p className="text-xs text-[#757682]">
                부채상환, 내집마련, 비상금, 여행 등 가족의 미래 목표를 설정하세요.
              </p>
            </div>

            {/* Goal List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">flag</span>
                  등록된 목표 목록
                  <span className="text-xs font-normal text-[#757682]">
                    ({goals.length}건)
                  </span>
                </h3>
              </div>

              {goals.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-dashed border-[#c5c5d3] text-center text-xs text-[#757682] space-y-2">
                  <p>등록된 목표 항목이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0]">
                    아래 버튼을 눌러 대출상환, 비상금 목표 등을 등록해 보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-dohyeon text-base text-[#191c1e]">
                            {goal.goalName}
                          </span>
                          <span className="text-[11px] font-bold bg-[#e8efff] text-[#00236f] px-2 py-0.5 rounded-md">
                            {goal.goalType}
                          </span>
                        </div>
                        <p className="text-xs text-[#444651]">
                          목표 금액{' '}
                          <span className="font-dohyeon text-base text-[#00236f]">
                            {formatNumber(goal.targetAmount)}원
                          </span>
                        </p>
                        {goal.targetDate && (
                          <p className="text-[11px] text-[#757682]">
                            목표 날짜: {goal.targetDate}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openGoalModal(goal)}
                          className="p-1.5 text-[#757682] hover:text-[#00236f] hover:bg-[#f0f4fd] rounded-lg transition-colors cursor-pointer"
                          title="수정"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="p-1.5 text-[#757682] hover:text-[#ba1a1a] hover:bg-[#ffebee] rounded-lg transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Goal Button */}
              <button
                onClick={() => openGoalModal()}
                className="w-full mt-3.5 py-3.5 bg-white border border-[#00236f]/30 text-[#00236f] font-dohyeon text-sm rounded-2xl hover:bg-[#f0f4fd] active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                + 목표 추가
              </button>
            </div>

            <p className="text-center text-xs text-[#757682] mt-6">
              나중에도 언제든 추가하거나 수정할 수 있습니다
            </p>
          </div>
        )}

        {/* ================= Step Complete: 설정 완료 ================= */}
        {currentStep === 'complete' && (
          <div className="space-y-6 text-center animate-fadeIn py-6 my-auto">
            <div className="w-20 h-20 bg-[#6cf8bb] text-[#004d33] rounded-3xl flex items-center justify-center mx-auto shadow-md">
              <span className="material-symbols-outlined text-[48px]">
                check_circle
              </span>
            </div>

            <div>
              <h2 className="font-dohyeon text-2xl sm:text-3xl text-[#00236f] mb-2">
                초기 설정이 완료되었습니다
              </h2>
              <p className="text-xs sm:text-sm text-[#444651] max-w-sm mx-auto leading-relaxed">
                이제 Home에서 CSV를 업로드하여 첫 월간 결산을 시작하세요
              </p>
            </div>

            {/* Registration Summary Card */}
            <div className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs text-left text-xs space-y-3">
              <div className="flex justify-between border-b border-[#eceef0] pb-2">
                <span className="text-[#757682]">가구명</span>
                <span className="font-bold text-[#00236f]">{householdName}</span>
              </div>
              <div className="flex justify-between border-b border-[#eceef0] pb-2">
                <span className="text-[#757682]">등록된 가족 구성원</span>
                <span className="font-bold text-[#191c1e]">{familyMembers.length}명</span>
              </div>
              <div className="flex justify-between border-b border-[#eceef0] pb-2">
                <span className="text-[#757682]">등록된 수입원</span>
                <span className="font-bold text-[#006c49]">{incomeSources.length}건</span>
              </div>
              <div className="flex justify-between border-b border-[#eceef0] pb-2">
                <span className="text-[#757682]">등록된 자산</span>
                <span className="font-bold text-[#191c1e]">{assets.length}건</span>
              </div>
              <div className="flex justify-between border-b border-[#eceef0] pb-2">
                <span className="text-[#757682]">등록된 부채</span>
                <span className="font-bold text-[#ba1a1a]">{debts.length}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#757682]">등록된 목표</span>
                <span className="font-bold text-[#00236f]">{goals.length}건</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation Footer */}
      <footer className="fixed bottom-0 left-0 w-full bg-[#f7f9fb]/95 backdrop-blur-md border-t border-[#c5c5d3]/20 p-4 z-40">
        <div className="max-w-2xl mx-auto flex gap-3">
          {currentStep === 'intro' ? (
            <button
              onClick={handleNext}
              className="w-full py-4 bg-[#00236f] text-white font-dohyeon text-base rounded-2xl shadow-lg hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              시작하기
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          ) : currentStep === 'complete' ? (
            <button
              onClick={handleNext}
              className="w-full py-4 bg-[#00236f] text-white font-dohyeon text-base rounded-2xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Home으로 이동
              <span className="material-symbols-outlined text-xl">home</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="w-1/3 py-3.5 bg-white text-[#444651] font-dohyeon text-sm rounded-xl border border-[#c5c5d3]/40 hover:bg-[#eceef0] active:scale-[0.98] transition-all cursor-pointer"
              >
                이전
              </button>
              <button
                onClick={handleNext}
                className="w-2/3 py-3.5 bg-[#00236f] text-white font-dohyeon text-sm rounded-xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                {currentStep === 'step5' ? '완료' : '다음'}
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </>
          )}
        </div>
      </footer>

      {/* ================= MODALS & BOTTOM SHEETS ================= */}

      {/* 1. Family Member Modal */}
      {activeModal === 'family' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#eceef0] pb-3">
              <h3 className="font-dohyeon text-lg text-[#00236f]">
                {editingId ? '가족 구성원 수정' : '가족 구성원 추가'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[#757682] hover:text-[#191c1e]"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#444651] mb-1 block">이름 *</label>
                <input
                  type="text"
                  value={familyForm.name}
                  onChange={(e) =>
                    setFamilyForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="예: 가현, 은석"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">가족관계 *</label>
                <select
                  value={familyForm.relationship}
                  onChange={(e) =>
                    setFamilyForm((prev) => ({
                      ...prev,
                      relationship: e.target.value as any,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                >
                  <option value="본인">본인</option>
                  <option value="배우자">배우자</option>
                  <option value="자녀">자녀</option>
                  <option value="부모">부모</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#444651] mb-1 block">
                    생년월일 *
                  </label>
                  <input
                    type="date"
                    value={familyForm.birthDate}
                    onChange={(e) =>
                      setFamilyForm((prev) => ({
                        ...prev,
                        birthDate: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#444651] mb-1 block">
                    현재 나이 (자동계산)
                  </label>
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/30 bg-[#eceef0] text-sm font-bold text-[#00236f]">
                    만 {calculateAge(familyForm.birthDate)}세
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">메모 (선택)</label>
                <input
                  type="text"
                  value={familyForm.memo}
                  onChange={(e) =>
                    setFamilyForm((prev) => ({ ...prev, memo: e.target.value }))
                  }
                  placeholder="예: 초등학교 2학년, 회사원 등"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="w-1/3 py-3 bg-[#f0f2f5] text-[#444651] font-dohyeon text-xs rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleSaveFamily}
                className="w-2/3 py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-md"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Income Modal */}
      {activeModal === 'income' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#eceef0] pb-3">
              <h3 className="font-dohyeon text-lg text-[#00236f]">
                {editingId ? '수입원 수정' : '수입원 추가'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 flex items-center justify-center text-[#757682] hover:text-[#191c1e] hover:bg-gray-100 active:bg-gray-200 active:scale-95 rounded-full transition-all cursor-pointer"
                aria-label="닫기"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 수입원명 */}
              <div>
                <label className="font-bold text-[#444651] mb-1 block">수입원명 *</label>
                <input
                  type="text"
                  value={incomeForm.incomeName}
                  onChange={(e) =>
                    setIncomeForm((prev) => ({
                      ...prev,
                      incomeName: e.target.value,
                    }))
                  }
                  placeholder="예 : 본점, 현하우스, 급여"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              {/* 수입유형 */}
              <div>
                <label className="font-bold text-[#444651] mb-1 block">수입유형 *</label>
                <select
                  value={incomeForm.incomeType}
                  onChange={(e) => {
                    const newType = e.target.value as IncomeType;
                    const autoMode = getDefaultModeForType(newType);
                    setIncomeForm((prev) => ({
                      ...prev,
                      incomeType: newType,
                      incomeMode: autoMode,
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                >
                  <option value="사업소득">사업소득</option>
                  <option value="임대소득">임대소득</option>
                  <option value="근로소득">근로소득</option>
                  <option value="금융소득">금융소득</option>
                  <option value="기타소득">기타소득</option>
                </select>
              </div>

              {/* 수입형태 (고정수입 / 변동수입) */}
              <div>
                <label className="font-bold text-[#444651] mb-1 block">수입형태 *</label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#f0f2f5] rounded-xl">
                  <button
                    type="button"
                    onClick={() =>
                      setIncomeForm((prev) => ({ ...prev, incomeMode: 'fixed' }))
                    }
                    className={`py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer min-h-[42px] flex items-center justify-center active:scale-[0.98] ${
                      incomeForm.incomeMode === 'fixed'
                        ? 'bg-white text-[#00236f] shadow-xs'
                        : 'text-[#757682] hover:text-[#191c1e]'
                    }`}
                  >
                    고정수입
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIncomeForm((prev) => ({ ...prev, incomeMode: 'variable' }))
                    }
                    className={`py-2.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all cursor-pointer min-h-[42px] flex items-center justify-center active:scale-[0.98] ${
                      incomeForm.incomeMode === 'variable'
                        ? 'bg-[#00236f] text-white shadow-xs'
                        : 'text-[#757682] hover:text-[#191c1e]'
                    }`}
                  >
                    변동수입
                  </button>
                </div>
              </div>

              {/* 월 고정금액 vs 안내 문구 */}
              {incomeForm.incomeMode === 'fixed' ? (
                <div>
                  <label className="font-bold text-[#444651] mb-1 block">
                    월 고정금액 (원) *
                  </label>
                  <input
                    type="text"
                    value={formatNumber(incomeForm.fixedMonthlyIncome)}
                    onChange={(e) =>
                      setIncomeForm((prev) => ({
                        ...prev,
                        fixedMonthlyIncome: e.target.value,
                      }))
                    }
                    placeholder="예: 4,180,000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#006c49] focus:outline-none focus:border-[#00236f]"
                  />
                </div>
              ) : (
                <div className="p-3 bg-[#f0f4fd] border border-[#00236f]/15 rounded-xl text-xs text-[#00236f] flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-[#00236f] shrink-0">
                    info
                  </span>
                  <span className="font-medium">
                    실제 수입 금액은 월간결산에서 해당 월별로 입력합니다
                  </span>
                </div>
              )}

              {/* 이전 등록금액 보존 내역 (참고용) */}
              {incomeForm.legacyMonthlyIncome > 0 && (
                <div className="px-3 py-2 bg-[#f8f9fa] border border-[#e0e2e5] rounded-xl flex items-center justify-between text-xs">
                  <span className="text-[#757682]">이전 등록금액 (보존됨)</span>
                  <span className="font-bold text-[#191c1e]">
                    {formatNumber(incomeForm.legacyMonthlyIncome)}원
                  </span>
                </div>
              )}

              {/* 소유자 */}
              <div>
                <label className="font-bold text-[#444651] mb-1 block">소유자</label>
                <select
                  value={incomeForm.owner}
                  onChange={(e) =>
                    setIncomeForm((prev) => ({ ...prev, owner: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                >
                  <option value="본인">본인</option>
                  <option value="배우자">배우자</option>
                  <option value="공동">공동</option>
                </select>
              </div>

              {/* 메모 */}
              <div>
                <label className="font-bold text-[#444651] mb-1 block">메모 (선택)</label>
                <input
                  type="text"
                  value={incomeForm.memo}
                  onChange={(e) =>
                    setIncomeForm((prev) => ({ ...prev, memo: e.target.value }))
                  }
                  placeholder="메모 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              {/* 활성 여부 */}
              <div className="flex items-center justify-between pt-1">
                <label className="font-bold text-[#444651]">활성 여부</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={incomeForm.isActive}
                    onChange={(e) =>
                      setIncomeForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00236f]"></div>
                  <span className="ml-2 text-xs text-[#555]">
                    {incomeForm.isActive ? '사용 중' : '숨김'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-1/3 py-3.5 bg-[#f0f2f5] text-[#444651] font-dohyeon text-sm rounded-xl hover:bg-[#e4e6eb] active:bg-[#d8dadf] active:scale-[0.98] transition-all cursor-pointer min-h-[46px] flex items-center justify-center"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveIncome}
                className="w-2/3 py-3.5 bg-[#00236f] text-white font-dohyeon text-sm rounded-xl shadow-xs hover:bg-[#001850] active:bg-[#001038] active:scale-[0.98] transition-all cursor-pointer min-h-[46px] flex items-center justify-center"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Asset Modal */}
      {activeModal === 'asset' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#eceef0] pb-3">
              <h3 className="font-dohyeon text-lg text-[#00236f]">
                {editingId ? '자산 항목 수정' : '자산 항목 추가'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[#757682] hover:text-[#191c1e]"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#444651] mb-1 block">자산명 *</label>
                <input
                  type="text"
                  value={assetForm.assetName}
                  onChange={(e) =>
                    setAssetForm((prev) => ({ ...prev, assetName: e.target.value }))
                  }
                  placeholder="예: 현하우스, 은석리더스, 삼성전자 주식, 비상금 통장"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">자산종류 *</label>
                <select
                  value={assetForm.assetType}
                  onChange={(e) =>
                    setAssetForm((prev) => ({
                      ...prev,
                      assetType: e.target.value as any,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                >
                  <option value="부동산">부동산</option>
                  <option value="금융자산">금융자산</option>
                  <option value="현금">현금</option>
                  <option value="기타자산">기타자산</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">
                  현재 가치 (만원) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatManInputValue(assetForm.currentValue)}
                    onChange={(e) =>
                      setAssetForm((prev) => ({
                        ...prev,
                        currentValue: e.target.value.replace(/[^0-9]/g, ''),
                      }))
                    }
                    placeholder="예: 160,000"
                    className="w-full px-3.5 py-2.5 pr-12 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#00236f] focus:outline-none focus:border-[#00236f]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#757682]">
                    만원
                  </span>
                </div>
                <p className="text-xs text-[#00236f] font-medium mt-1 text-right">
                  {formatKoreanAmountFromMan(assetForm.currentValue)}
                </p>
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">메모 (선택)</label>
                <input
                  type="text"
                  value={assetForm.memo}
                  onChange={(e) =>
                    setAssetForm((prev) => ({ ...prev, memo: e.target.value }))
                  }
                  placeholder="메모 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="w-1/3 py-3 bg-[#f0f2f5] text-[#444651] font-dohyeon text-xs rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleSaveAsset}
                className="w-2/3 py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-md"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Debt Modal */}
      {activeModal === 'debt' && (() => {
        const modalOrigPrincipal = manToWon(parseManInputValue(debtForm.originalPrincipal));
        const modalBalance = manToWon(parseManInputValue(debtForm.currentBalance));
        const modalRate = Number(debtForm.interestRate) || 0;
        const modalCurP = manToWon(parseManInputValue(debtForm.currentPrincipalPayment));
        const modalCurI = manToWon(parseManInputValue(debtForm.currentInterestPayment));
        const modalCurT = manToWon(parseManInputValue(debtForm.currentTotalPayment)) || (modalCurP + modalCurI);

        const modalMonths =
          Number(debtForm.remainingMonths) ||
          (debtForm.maturityDate ? getRemainingMonthsFromMaturity(debtForm.maturityDate) : 0);

        const liveCalc = calculateCurrentDebtPayment({
          calculationMode: debtForm.calculationMode,
          currentBalance: modalBalance,
          originalPrincipal: modalOrigPrincipal,
          interestRate: modalRate,
          annualRate: modalRate,
          rateType: debtForm.rateType,
          repaymentMethod: debtForm.repaymentMethod as any,
          repaymentType: toRepaymentType(debtForm.repaymentMethod),
          loanStartDate: debtForm.loanStartDate,
          principalRepaymentStartDate: debtForm.principalRepaymentStartDate,
          repaymentStartDate: debtForm.principalRepaymentStartDate,
          maturityDate: debtForm.maturityDate,
          remainingMonths: modalMonths,
          currentPrincipalPayment: modalCurP,
          currentInterestPayment: modalCurI,
          currentTotalPayment: modalCurT,
          manualPaymentOverride: debtForm.manualPaymentOverride,
          manualPrincipalPayment: manToWon(parseManInputValue(debtForm.manualPrincipalPayment)),
          manualInterestPayment: manToWon(parseManInputValue(debtForm.manualInterestPayment)),
          manualTotalPayment: manToWon(parseManInputValue(debtForm.manualTotalPayment)) || manToWon(parseManInputValue(debtForm.manualMonthlyPayment)),
          manualMonthlyPayment: manToWon(parseManInputValue(debtForm.manualMonthlyPayment)) || manToWon(parseManInputValue(debtForm.manualTotalPayment)),
          repaymentPhases: debtForm.repaymentPhases,
        });

        const phaseValidation = validateRepaymentPhases(debtForm.repaymentPhases, debtForm.maturityDate);

        const loadSampleEx1 = () => {
          setDebtForm((prev) => ({
            ...prev,
            calculationMode: 'contract',
            debtName: '주택담보대출 (단계별 상환 예시)',
            debtType: '주택담보대출',
            lender: '국민은행',
            originalPrincipal: '10000',
            currentBalance: '10000',
            interestRate: '3.62',
            rateType: '변동금리',
            repaymentMethod: '단계별 상환',
            repaymentPhases: [
              {
                id: 'p-1',
                phaseName: '1단계: 이자만 납부',
                startDate: '2025-10-01',
                endDate: '2028-10-31',
                repaymentType: 'interest_only',
                annualRate: 3.62,
                termMonths: 37,
              },
              {
                id: 'p-2',
                phaseName: '2단계: 원금균등상환',
                startDate: '2028-11-01',
                endDate: '2032-10-31',
                repaymentType: 'equal_principal',
                annualRate: 3.62,
                termMonths: 48,
              },
            ],
            maturityDate: '2032-10-31',
            remainingMonths: '85',
          }));
        };

        const loadSampleEx2 = () => {
          setDebtForm((prev) => ({
            ...prev,
            calculationMode: 'current_status',
            debtName: '과거 대출 내역 미확인 (현재 납부상태 예시)',
            debtType: '주택담보대출',
            lender: '신한은행',
            currentBalance: '39886',
            interestRate: '4.23',
            rateType: '변동금리',
            currentPrincipalPayment: '133',
            currentInterestPayment: '125',
            currentTotalPayment: '258',
            remainingMonths: '280',
            maturityDate: '2049-11-01',
            repaymentMethod: '원금균등',
          }));
        };

        const addPhase = () => {
          const count = debtForm.repaymentPhases.length + 1;
          setDebtForm((prev) => ({
            ...prev,
            repaymentPhases: [
              ...prev.repaymentPhases,
              {
                id: `phase-${Date.now()}`,
                phaseName: `${count}단계`,
                startDate: prev.maturityDate ? '2028-11-01' : '',
                endDate: prev.maturityDate || '',
                repaymentType: 'equal_principal',
                annualRate: Number(prev.interestRate) || 3.9,
              },
            ],
          }));
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#eceef0] pb-3">
                <div>
                  <h3 className="font-dohyeon text-lg text-[#00236f]">
                    {editingId ? '부채 상세 수정' : '부채 항목 등록'}
                  </h3>
                  <p className="text-[11px] text-[#757682]">
                    대출 정보 파악 정도에 따라 등록 방식을 선택하세요
                  </p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-[#757682] hover:text-[#191c1e]"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              {/* Mode Selector Toggle */}
              <div className="bg-[#f0f2f5] p-1 rounded-2xl flex text-xs font-bold">
                <button
                  type="button"
                  onClick={() =>
                    setDebtForm((prev) => ({ ...prev, calculationMode: 'contract' }))
                  }
                  className={`flex-1 py-2.5 rounded-xl transition-all ${
                    debtForm.calculationMode === 'contract'
                      ? 'bg-[#00236f] text-white shadow-xs'
                      : 'text-[#5c6068] hover:text-[#191c1e]'
                  }`}
                >
                  A. 계약조건 기준
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDebtForm((prev) => ({ ...prev, calculationMode: 'current_status' }))
                  }
                  className={`flex-1 py-2.5 rounded-xl transition-all ${
                    debtForm.calculationMode === 'current_status'
                      ? 'bg-[#00236f] text-white shadow-xs'
                      : 'text-[#5c6068] hover:text-[#191c1e]'
                  }`}
                >
                  B. 현재 납부상태 기준
                </button>
              </div>

              {/* Mode Description & Sample Buttons */}
              <div className="bg-[#f7f9fb] p-3 rounded-2xl border border-[#c5c5d3]/30 text-[11px] space-y-2">
                <p className="text-[#444651]">
                  {debtForm.calculationMode === 'contract' ? (
                    <span>
                      <strong className="text-[#00236f]">계약조건 기준:</strong> 대출 계약서 상의 최초금액, 실행일, 원금상환 시작일, 만기일, 금리를 기반으로 월 상환액을 자동 계산합니다.
                    </span>
                  ) : (
                    <span>
                      <strong className="text-[#00236f]">현재 납부상태 기준:</strong> 과거 실행일이나 거치기간을 정확히 기억하지 못할 때, 현재 잔액과 실제 납부액(원금/이자) 기반으로 등록합니다.
                    </span>
                  )}
                </p>
                <div className="flex gap-1.5 flex-wrap pt-1 border-t border-[#eceef0]">
                  <span className="text-[#757682] font-semibold flex items-center">샘플 입력:</span>
                  <button
                    type="button"
                    onClick={loadSampleEx1}
                    className="text-[10px] font-bold text-[#00236f] bg-[#00236f]/10 px-2 py-0.5 rounded-lg hover:bg-[#00236f]/20"
                  >
                    예시 1 (단계별 상환)
                  </button>
                  <button
                    type="button"
                    onClick={loadSampleEx2}
                    className="text-[10px] font-bold text-[#006c49] bg-[#e6f4ea] px-2 py-0.5 rounded-lg hover:bg-[#d2ebd9]"
                  >
                    예시 2 (현재납부 기준)
                  </button>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* 1. Basic Information */}
                <div>
                  <label className="font-bold text-[#444651] mb-1 block">부채명 *</label>
                  <input
                    type="text"
                    value={debtForm.debtName}
                    onChange={(e) =>
                      setDebtForm((prev) => ({ ...prev, debtName: e.target.value }))
                    }
                    placeholder="예: 현하우스 담보대출, 사업자 신용대출"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#444651] mb-1 block">부채종류 *</label>
                    <select
                      value={debtForm.debtType}
                      onChange={(e) =>
                        setDebtForm((prev) => ({
                          ...prev,
                          debtType: e.target.value as any,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                    >
                      <option value="주택담보대출">주택담보대출</option>
                      <option value="상가·부동산 담보대출">상가·부동산 담보대출</option>
                      <option value="사업자대출">사업자대출</option>
                      <option value="신용대출">신용대출</option>
                      <option value="마이너스통장">마이너스통장</option>
                      <option value="자동차대출">자동차대출</option>
                      <option value="전세대출">전세대출</option>
                      <option value="가족·지인 차입금">가족·지인 차입금</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#444651] mb-1 block">금융기관</label>
                    <input
                      type="text"
                      value={debtForm.lender}
                      onChange={(e) =>
                        setDebtForm((prev) => ({ ...prev, lender: e.target.value }))
                      }
                      placeholder="예: 국민은행"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                    />
                  </div>
                </div>

                {/* 2. MODE SPECIFIC INPUTS */}
                {debtForm.calculationMode === 'contract' ? (
                  /* CONTRACT MODE FIELDS */
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">
                          최초 대출금액 (만원)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(debtForm.originalPrincipal)}
                            onChange={(e) =>
                              setDebtForm((prev) => ({
                                ...prev,
                                originalPrincipal: e.target.value.replace(/[^0-9]/g, ''),
                              }))
                            }
                            placeholder="예: 10,000"
                            className="w-full px-3.5 py-2.5 pr-12 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#757682]">
                            만원
                          </span>
                        </div>
                        <p className="text-xs text-[#00236f] font-medium mt-1 text-right">
                          {formatKoreanAmountFromMan(debtForm.originalPrincipal)}
                        </p>
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">
                          현재 잔액 (만원) *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(debtForm.currentBalance)}
                            onChange={(e) =>
                              setDebtForm((prev) => ({
                                ...prev,
                                currentBalance: e.target.value.replace(/[^0-9]/g, ''),
                              }))
                            }
                            placeholder="예: 10,000"
                            className="w-full px-3.5 py-2.5 pr-12 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#ba1a1a] focus:outline-none focus:border-[#00236f]"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#757682]">
                            만원
                          </span>
                        </div>
                        <p className="text-xs text-[#00236f] font-medium mt-1 text-right">
                          {formatKoreanAmountFromMan(debtForm.currentBalance)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">대출 실행일</label>
                        <input
                          type="date"
                          value={debtForm.loanStartDate}
                          onChange={(e) =>
                            setDebtForm((prev) => ({ ...prev, loanStartDate: e.target.value }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">
                          원금상환 시작일
                        </label>
                        <input
                          type="date"
                          value={debtForm.principalRepaymentStartDate}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              principalRepaymentStartDate: e.target.value,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    </div>
                    {debtForm.principalRepaymentStartDate && (
                      <p className="text-[11px] text-[#00236f] bg-[#00236f]/5 px-2.5 py-1 rounded-lg">
                        * 원금상환 시작일 이전에는 거치기간으로 판별되어 이자만 납부하도록 계산됩니다.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">만기일</label>
                        <input
                          type="date"
                          value={debtForm.maturityDate}
                          onChange={(e) => {
                            const newMatDate = e.target.value;
                            const autoMonths = getRemainingMonthsFromMaturity(newMatDate);
                            setDebtForm((prev) => ({
                              ...prev,
                              maturityDate: newMatDate,
                              remainingMonths:
                                autoMonths > 0 ? String(autoMonths) : prev.remainingMonths,
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">남은 상환개월</label>
                        <input
                          type="number"
                          value={debtForm.remainingMonths}
                          onChange={(e) => {
                            const mVal = e.target.value;
                            const numM = Number(mVal);
                            const autoDate = numM > 0 ? getMaturityDateFromMonths(numM) : prevDate();
                            function prevDate() {
                              return debtForm.maturityDate;
                            }
                            setDebtForm((prev) => ({
                              ...prev,
                              remainingMonths: mVal,
                              maturityDate: autoDate || prev.maturityDate,
                            }));
                          }}
                          placeholder="예: 48 (자동계산)"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">
                          현재 연이율 (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={debtForm.interestRate}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              interestRate: e.target.value,
                            }))
                          }
                          placeholder="예: 3.62"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">금리유형</label>
                        <select
                          value={debtForm.rateType}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              rateType: e.target.value as any,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        >
                          <option value="변동금리">변동금리</option>
                          <option value="고정금리">고정금리</option>
                          <option value="혼합금리">혼합금리</option>
                        </select>
                      </div>
                    </div>

                    {debtForm.rateType === '변동금리' && (
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">금리 기준일 (선택)</label>
                        <input
                          type="date"
                          value={debtForm.rateEffectiveDate}
                          onChange={(e) =>
                            setDebtForm((prev) => ({ ...prev, rateEffectiveDate: e.target.value }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">상환방식 *</label>
                        <select
                          value={debtForm.repaymentMethod}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              repaymentMethod: e.target.value as any,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#00236f] focus:outline-none focus:border-[#00236f]"
                        >
                          <option value="원리금균등">원리금균등상환</option>
                          <option value="원금균등">원금균등상환</option>
                          <option value="만기일시상환">만기일시상환</option>
                          <option value="이자만 납부">이자만 납부</option>
                          <option value="단계별 상환">단계별 상환</option>
                          <option value="직접설정">직접설정</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">월 납부일</label>
                        <input
                          type="text"
                          value={debtForm.paymentDay}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              paymentDay: e.target.value,
                            }))
                          }
                          placeholder="예: 매월 25일"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  /* CURRENT STATUS MODE FIELDS */
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">
                          현재 잔액 (만원) *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(debtForm.currentBalance)}
                            onChange={(e) =>
                              setDebtForm((prev) => ({
                                ...prev,
                                currentBalance: e.target.value.replace(/[^0-9]/g, ''),
                              }))
                            }
                            placeholder="예: 39,886"
                            className="w-full px-3.5 py-2.5 pr-12 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#ba1a1a] focus:outline-none focus:border-[#00236f]"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#757682]">
                            만원
                          </span>
                        </div>
                        <p className="text-xs text-[#00236f] font-medium mt-1 text-right">
                          {formatKoreanAmountFromMan(debtForm.currentBalance)}
                        </p>
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">
                          현재 연이율 (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={debtForm.interestRate}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              interestRate: e.target.value,
                            }))
                          }
                          placeholder="예: 4.23"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block text-[11px]">
                          현재 월 원금(만원)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(debtForm.currentPrincipalPayment)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setDebtForm((prev) => {
                                const p = parseManInputValue(val);
                                const i = parseManInputValue(prev.currentInterestPayment);
                                return {
                                  ...prev,
                                  currentPrincipalPayment: val,
                                  currentTotalPayment: p + i > 0 ? String(p + i) : prev.currentTotalPayment,
                                };
                              });
                            }}
                            placeholder="예: 133"
                            className="w-full px-2 py-2 pr-10 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-xs font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#757682]">
                            만원
                          </span>
                        </div>
                        <p className="text-[10px] text-[#00236f] font-medium mt-0.5 text-right">
                          {formatKoreanAmountFromMan(debtForm.currentPrincipalPayment)}
                        </p>
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block text-[11px]">
                          현재 월 이자(만원)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(debtForm.currentInterestPayment)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setDebtForm((prev) => {
                                const i = parseManInputValue(val);
                                const p = parseManInputValue(prev.currentPrincipalPayment);
                                return {
                                  ...prev,
                                  currentInterestPayment: val,
                                  currentTotalPayment: p + i > 0 ? String(p + i) : prev.currentTotalPayment,
                                };
                              });
                            }}
                            placeholder="예: 125"
                            className="w-full px-2 py-2 pr-10 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-xs font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#757682]">
                            만원
                          </span>
                        </div>
                        <p className="text-[10px] text-[#00236f] font-medium mt-0.5 text-right">
                          {formatKoreanAmountFromMan(debtForm.currentInterestPayment)}
                        </p>
                      </div>

                      <div>
                        <label className="font-bold text-[#00236f] mb-1 block text-[11px]">
                          현재 총 납입액(만원)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formatManInputValue(debtForm.currentTotalPayment)}
                            onChange={(e) =>
                              setDebtForm((prev) => ({
                                ...prev,
                                currentTotalPayment: e.target.value.replace(/[^0-9]/g, ''),
                              }))
                            }
                            placeholder="예: 258"
                            className="w-full px-2 py-2 pr-10 rounded-xl border border-[#00236f]/30 bg-white text-xs font-bold text-[#00236f] focus:outline-none focus:border-[#00236f]"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#757682]">
                            만원
                          </span>
                        </div>
                        <p className="text-[10px] text-[#00236f] font-medium mt-0.5 text-right">
                          {formatKoreanAmountFromMan(debtForm.currentTotalPayment)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">만기일</label>
                        <input
                          type="date"
                          value={debtForm.maturityDate}
                          onChange={(e) => {
                            const newMatDate = e.target.value;
                            const autoMonths = getRemainingMonthsFromMaturity(newMatDate);
                            setDebtForm((prev) => ({
                              ...prev,
                              maturityDate: newMatDate,
                              remainingMonths:
                                autoMonths > 0 ? String(autoMonths) : prev.remainingMonths,
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">남은 상환회차</label>
                        <input
                          type="number"
                          value={debtForm.remainingMonths}
                          onChange={(e) => {
                            const mVal = e.target.value;
                            const numM = Number(mVal);
                            const autoDate = numM > 0 ? getMaturityDateFromMonths(numM) : prevDate();
                            function prevDate() {
                              return debtForm.maturityDate;
                            }
                            setDebtForm((prev) => ({
                              ...prev,
                              remainingMonths: mVal,
                              maturityDate: autoDate || prev.maturityDate,
                            }));
                          }}
                          placeholder="예: 280 (회)"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">향후 상환방식</label>
                        <select
                          value={debtForm.repaymentMethod}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              repaymentMethod: e.target.value as any,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        >
                          <option value="원금균등">원금균등상환</option>
                          <option value="원리금균등">원리금균등상환</option>
                          <option value="만기일시상환">만기일시상환</option>
                          <option value="이자만 납부">이자만 납부</option>
                          <option value="단계별 상환">단계별 상환</option>
                          <option value="직접설정">직접설정</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-[#444651] mb-1 block">월 납부일</label>
                        <input
                          type="text"
                          value={debtForm.paymentDay}
                          onChange={(e) =>
                            setDebtForm((prev) => ({
                              ...prev,
                              paymentDay: e.target.value,
                            }))
                          }
                          placeholder="예: 매월 25일"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 3. STEPPED REPAYMENT BUILDER */}
                {debtForm.repaymentMethod === '단계별 상환' && (
                  <div className="bg-[#f0f4f8] p-3.5 rounded-2xl border border-[#00236f]/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#00236f] text-xs flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">alt_route</span>
                        단계별 상환 조건 설정 ({debtForm.repaymentPhases.length}단계)
                      </span>
                      <button
                        type="button"
                        onClick={addPhase}
                        className="text-[11px] font-bold text-[#00236f] bg-white px-2.5 py-1 rounded-lg border border-[#00236f]/20 hover:bg-[#e6eeff]"
                      >
                        + 단계 추가
                      </button>
                    </div>

                    {/* Validation warning/error badges */}
                    {!phaseValidation.isValid && phaseValidation.errors.length > 0 && (
                      <div className="bg-red-50 text-red-700 p-2.5 rounded-xl border border-red-200 text-[11px] space-y-1">
                        {phaseValidation.errors.map((err, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">error</span>
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {phaseValidation.warnings.length > 0 && (
                      <div className="bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-200 text-[11px] space-y-1">
                        {phaseValidation.warnings.map((warn, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active Phases List */}
                    {debtForm.repaymentPhases.length === 0 ? (
                      <div className="text-[11px] text-[#757682] bg-white p-3 rounded-xl border border-dashed border-[#c5c5d3]/60 text-center">
                        등록된 상환 단계가 없습니다. 상단 샘플 버튼이나 '+ 단계 추가'로 등록해 보세요.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {debtForm.repaymentPhases.map((phase, idx) => (
                          <div
                            key={phase.id || idx}
                            className="bg-white p-3 rounded-xl border border-[#c5c5d3]/40 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between font-bold text-[#00236f]">
                              <input
                                type="text"
                                value={phase.phaseName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDebtForm((prev) => {
                                    const next = [...prev.repaymentPhases];
                                    next[idx] = { ...next[idx], phaseName: val };
                                    return { ...prev, repaymentPhases: next };
                                  });
                                }}
                                className="font-bold text-xs text-[#00236f] bg-transparent border-b border-dashed border-[#00236f]/30 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setDebtForm((prev) => ({
                                    ...prev,
                                    repaymentPhases: prev.repaymentPhases.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="text-[#ba1a1a] hover:bg-[#ffebee] px-1.5 py-0.5 rounded"
                              >
                                삭제
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <label className="text-[#757682] block mb-0.5">시작일</label>
                                <input
                                  type="date"
                                  value={phase.startDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDebtForm((prev) => {
                                      const next = [...prev.repaymentPhases];
                                      next[idx] = { ...next[idx], startDate: val };
                                      return { ...prev, repaymentPhases: next };
                                    });
                                  }}
                                  className="w-full px-2 py-1 rounded border border-[#c5c5d3]/40 bg-[#f7f9fb]"
                                />
                              </div>
                              <div>
                                <label className="text-[#757682] block mb-0.5">종료일</label>
                                <input
                                  type="date"
                                  value={phase.endDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDebtForm((prev) => {
                                      const next = [...prev.repaymentPhases];
                                      next[idx] = { ...next[idx], endDate: val };
                                      return { ...prev, repaymentPhases: next };
                                    });
                                  }}
                                  className="w-full px-2 py-1 rounded border border-[#c5c5d3]/40 bg-[#f7f9fb]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <label className="text-[#757682] block mb-0.5">상환방식</label>
                                <select
                                  value={phase.repaymentType}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDebtForm((prev) => {
                                      const next = [...prev.repaymentPhases];
                                      next[idx] = { ...next[idx], repaymentType: val as any };
                                      return { ...prev, repaymentPhases: next };
                                    });
                                  }}
                                  className="w-full px-2 py-1 rounded border border-[#c5c5d3]/40 bg-[#f7f9fb]"
                                >
                                  <option value="interest_only">이자만 납부</option>
                                  <option value="equal_principal">원금균등상환</option>
                                  <option value="equal_payment">원리금균등상환</option>
                                  <option value="bullet">만기일시상환</option>
                                  <option value="custom">직접설정</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[#757682] block mb-0.5">연이율 (%)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={phase.annualRate}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setDebtForm((prev) => {
                                      const next = [...prev.repaymentPhases];
                                      next[idx] = { ...next[idx], annualRate: val };
                                      return { ...prev, repaymentPhases: next };
                                    });
                                  }}
                                  className="w-full px-2 py-1 rounded border border-[#c5c5d3]/40 bg-[#f7f9fb]"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. READ-ONLY AUTO-CALCULATED RESULT DISPLAY BOX */}
                <div className="bg-[#f2f7ff] p-4 rounded-2xl border border-[#00236f]/20 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-[#00236f]/10">
                    <span className="font-dohyeon text-xs text-[#00236f] flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">calculate</span>
                      자동 계산 결과
                    </span>
                    <span className="text-[10px] font-bold text-[#006c49] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                      실시간 조건 반영
                    </span>
                  </div>

                  {!liveCalc.isValid ? (
                    <div className="text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">info</span>
                      <span>{liveCalc.message || '정확한 계산을 위해 원금상환 시작일 또는 현재 납부액을 입력해주세요'}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs pt-1">
                      <div className="text-[#5c6068]">현재 적용 방식/단계</div>
                      <div className="text-right font-bold text-[#00236f]">
                        {liveCalc.activePhaseName || liveCalc.repaymentMethodLabel}
                      </div>

                      <div className="text-[#5c6068]">이번 달 예상 원금</div>
                      <div className="text-right font-semibold text-[#191c1e]">
                        {formatNumber(liveCalc.currentPrincipal)}원
                      </div>

                      <div className="text-[#5c6068]">이번 달 예상 이자</div>
                      <div className="text-right font-semibold text-[#191c1e]">
                        {formatNumber(liveCalc.currentInterest)}원
                      </div>

                      <div className="text-[#00236f] font-bold border-t border-[#00236f]/10 pt-1.5 mt-0.5">
                        이번 달 예상 총 납입액
                      </div>
                      <div className="text-right font-dohyeon text-base text-[#00236f] border-t border-[#00236f]/10 pt-1 mt-0.5">
                        {formatNumber(liveCalc.currentTotal)}원
                      </div>

                      <div className="text-[#5c6068]">다음 달 예상 총 납입액</div>
                      <div className="text-right font-semibold text-[#444651]">
                        {formatNumber(liveCalc.nextMonthTotal)}원
                      </div>

                      <div className="text-[#5c6068]">남은 상환개월</div>
                      <div className="text-right font-semibold text-[#444651]">
                        {liveCalc.remainingMonths > 0 ? `${liveCalc.remainingMonths}개월` : '미입력'}
                      </div>

                      {liveCalc.nextPhaseChangeDate && (
                        <>
                          <div className="text-[#5c6068] pt-1 border-t border-[#00236f]/10">
                            다음 방식 변경일
                          </div>
                          <div className="text-right font-semibold text-[#191c1e] pt-1 border-t border-[#00236f]/10">
                            {liveCalc.nextPhaseChangeDate}
                          </div>
                        </>
                      )}

                      {liveCalc.nextPhaseFirstPayment !== undefined && liveCalc.nextPhaseFirstPayment > 0 && (
                        <>
                          <div className="text-[#006c49] font-bold">
                            변경 후 첫 달 예상액
                          </div>
                          <div className="text-right font-bold text-[#006c49]">
                            {formatNumber(liveCalc.nextPhaseFirstPayment)}원
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. MANUAL PAYMENT OVERRIDE TOGGLE */}
                <div className="pt-2 border-t border-[#eceef0]">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#00236f] text-xs">
                    <input
                      type="checkbox"
                      checked={debtForm.manualPaymentOverride}
                      onChange={(e) =>
                        setDebtForm((prev) => ({
                          ...prev,
                          manualPaymentOverride: e.target.checked,
                          manualTotalPayment: e.target.checked
                            ? prev.manualTotalPayment || String(liveCalc.currentTotal)
                            : '',
                          manualMonthlyPayment: e.target.checked
                            ? prev.manualMonthlyPayment || String(liveCalc.currentTotal)
                            : '',
                        }))
                      }
                      className="w-4 h-4 rounded text-[#00236f] focus:ring-[#00236f]"
                    />
                    <span>은행 실제 납부액으로 보정 (직접 입력)</span>
                  </label>

                  {debtForm.manualPaymentOverride && (
                    <div className="mt-2.5 bg-[#fff8e6] p-3 rounded-xl border border-[#ffe082] space-y-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="font-bold text-[#8c6b00] text-[11px] block mb-1">
                            실제 월 원금
                          </label>
                          <input
                            type="text"
                            value={formatNumber(debtForm.manualPrincipalPayment)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setDebtForm((prev) => {
                                const p = parseNumber(val);
                                const i = parseNumber(prev.manualInterestPayment);
                                return {
                                  ...prev,
                                  manualPrincipalPayment: val,
                                  manualTotalPayment: p + i > 0 ? String(p + i) : prev.manualTotalPayment,
                                  manualMonthlyPayment: p + i > 0 ? String(p + i) : prev.manualMonthlyPayment,
                                };
                              });
                            }}
                            placeholder="예: 2,083,333"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#ffd54f] bg-white text-xs font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-[#8c6b00] text-[11px] block mb-1">
                            실제 월 이자
                          </label>
                          <input
                            type="text"
                            value={formatNumber(debtForm.manualInterestPayment)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setDebtForm((prev) => {
                                const i = parseNumber(val);
                                const p = parseNumber(prev.manualPrincipalPayment);
                                return {
                                  ...prev,
                                  manualInterestPayment: val,
                                  manualTotalPayment: p + i > 0 ? String(p + i) : prev.manualTotalPayment,
                                  manualMonthlyPayment: p + i > 0 ? String(p + i) : prev.manualMonthlyPayment,
                                };
                              });
                            }}
                            placeholder="예: 301,667"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#ffd54f] bg-white text-xs font-semibold text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-[#00236f] text-[11px] block mb-1">
                            실제 월 총 납입액 *
                          </label>
                          <input
                            type="text"
                            value={formatNumber(
                              debtForm.manualTotalPayment || debtForm.manualMonthlyPayment
                            )}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setDebtForm((prev) => ({
                                ...prev,
                                manualTotalPayment: val,
                                manualMonthlyPayment: val,
                              }));
                            }}
                            placeholder="예: 2,385,000"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#ffd54f] bg-white text-xs font-bold text-[#00236f] focus:outline-none focus:border-[#00236f]"
                          />
                        </div>
                      </div>

                      {/* Override diff info */}
                      <div className="bg-white/80 p-2 rounded-lg text-[11px] flex justify-between items-center border border-[#ffe082]">
                        <span className="text-[#8c6b00]">
                          자동 계산값({formatNumber(liveCalc.autoCalculatedTotal || liveCalc.currentTotal)}원) 대비 차이:
                        </span>
                        <span className="font-bold text-[#00236f]">
                          {liveCalc.overrideDiff !== undefined
                            ? liveCalc.overrideDiff > 0
                              ? `+${formatNumber(liveCalc.overrideDiff)}원`
                              : `${formatNumber(liveCalc.overrideDiff)}원`
                            : '0원'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Memo */}
                <div>
                  <label className="font-bold text-[#444651] mb-1 block">메모 (선택)</label>
                  <input
                    type="text"
                    value={debtForm.memo}
                    onChange={(e) =>
                      setDebtForm((prev) => ({ ...prev, memo: e.target.value }))
                    }
                    placeholder="추가 메모"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-[#eceef0]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-1/3 py-3 bg-[#f0f2f5] text-[#444651] font-dohyeon text-xs rounded-xl hover:bg-[#e4e7eb]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveDebt}
                  className="w-2/3 py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-md hover:bg-[#001a54]"
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. Goal Modal */}
      {activeModal === 'goal' && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#eceef0] pb-3">
              <h3 className="font-dohyeon text-lg text-[#00236f]">
                {editingId ? '목표 항목 수정' : '목표 항목 추가'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-[#757682] hover:text-[#191c1e]"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#444651] mb-1 block">목표명 *</label>
                <input
                  type="text"
                  value={goalForm.goalName}
                  onChange={(e) =>
                    setGoalForm((prev) => ({ ...prev, goalName: e.target.value }))
                  }
                  placeholder="예: 현하우스 담보대출 5억원 이하 만들기, 비상금 3,000만원 만들기"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">목표종류 *</label>
                <select
                  value={goalForm.goalType}
                  onChange={(e) =>
                    setGoalForm((prev) => ({
                      ...prev,
                      goalType: e.target.value as any,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                >
                  <option value="부채상환">부채상환</option>
                  <option value="내집마련">내집마련</option>
                  <option value="비상금">비상금</option>
                  <option value="투자">투자</option>
                  <option value="교육">교육</option>
                  <option value="은퇴">은퇴</option>
                  <option value="여행">여행</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">
                  목표 금액 (원) *
                </label>
                <input
                  type="text"
                  value={formatNumber(goalForm.targetAmount)}
                  onChange={(e) =>
                    setGoalForm((prev) => ({
                      ...prev,
                      targetAmount: e.target.value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder="예: 500,000,000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm font-semibold text-[#00236f] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">목표 날짜</label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) =>
                    setGoalForm((prev) => ({
                      ...prev,
                      targetDate: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>

              <div>
                <label className="font-bold text-[#444651] mb-1 block">메모 (선택)</label>
                <input
                  type="text"
                  value={goalForm.memo}
                  onChange={(e) =>
                    setGoalForm((prev) => ({ ...prev, memo: e.target.value }))
                  }
                  placeholder="메모 입력"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5c5d3]/40 bg-[#f7f9fb] text-sm text-[#191c1e] focus:outline-none focus:border-[#00236f]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="w-1/3 py-3 bg-[#f0f2f5] text-[#444651] font-dohyeon text-xs rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleSaveGoal}
                className="w-2/3 py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-md"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
