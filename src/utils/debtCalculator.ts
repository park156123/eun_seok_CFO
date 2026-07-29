import { OnboardingDebt, Debt, RepaymentType, RepaymentPhase } from '../types';

export interface PhaseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DebtCalculationResult {
  currentPrincipal: number;
  currentInterest: number;
  currentTotal: number;
  nextMonthTotal: number;
  remainingMonths: number;
  repaymentType: RepaymentType;
  repaymentMethodLabel: string;
  isComplete: boolean;
  isValid: boolean;
  activePhaseName?: string;
  nextPhaseChangeDate?: string;
  nextPhaseFirstPayment?: number;
  manualOverrideUsed: boolean;
  autoCalculatedTotal?: number;
  manualTotal?: number;
  overrideDiff?: number;
  message?: string;
}

/**
 * Maps Korean label to RepaymentType enum string
 */
export function toRepaymentType(label?: string): RepaymentType {
  switch (label) {
    case '이자만 납부':
    case 'interest_only':
      return 'interest_only';
    case '만기일시상환':
    case 'bullet':
      return 'bullet';
    case '원금균등':
    case '원금균등상환':
    case 'equal_principal':
      return 'equal_principal';
    case '원리금균등':
    case '원리금균등상환':
    case 'equal_payment':
      return 'equal_payment';
    case '단계별 상환':
    case 'stepped':
      return 'stepped';
    case '직접설정':
    case 'custom':
      return 'custom';
    default:
      return 'equal_payment';
  }
}

/**
 * Maps RepaymentType enum string to Korean label
 */
export function toRepaymentMethodLabel(type?: RepaymentType | string): string {
  switch (type) {
    case 'interest_only':
    case '이자만 납부':
      return '이자만 납부';
    case 'bullet':
    case '만기일시상환':
      return '만기일시상환';
    case 'equal_principal':
    case '원금균등':
    case '원금균등상환':
      return '원금균등상환';
    case 'equal_payment':
    case '원리금균등':
    case '원리금균등상환':
      return '원리금균등상환';
    case 'stepped':
    case '단계별 상환':
      return '단계별 상환';
    case 'custom':
    case '직접설정':
      return '직접설정';
    default:
      return '원리금균등상환';
  }
}

/**
 * Calculates remaining months from maturity date relative to reference date.
 */
export function getRemainingMonthsFromMaturity(
  maturityDateStr?: string,
  refDate: Date = new Date()
): number {
  if (!maturityDateStr) return 0;
  const matDate = new Date(maturityDateStr);
  if (isNaN(matDate.getTime())) return 0;

  const yearDiff = matDate.getFullYear() - refDate.getFullYear();
  const monthDiff = matDate.getMonth() - refDate.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;

  return Math.max(1, totalMonths);
}

/**
 * Calculates maturity date YYYY-MM-DD from remaining months relative to reference date.
 */
export function getMaturityDateFromMonths(
  months: number,
  refDate: Date = new Date()
): string {
  if (!months || months <= 0) return '';
  const matDate = new Date(refDate.getFullYear(), refDate.getMonth() + months, refDate.getDate());
  const year = matDate.getFullYear();
  const month = String(matDate.getMonth() + 1).padStart(2, '0');
  const day = String(matDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 1. 이자만 납부 계산
 */
export function calculateInterestOnlyPayment(balance: number, annualRate: number) {
  if (balance <= 0) return { principal: 0, interest: 0, total: 0 };
  const rate = Math.max(0, annualRate) / 100 / 12;
  const interest = Math.round(balance * rate);
  return {
    principal: 0,
    interest,
    total: interest,
  };
}

/**
 * 2. 만기일시상환 계산
 */
export function calculateBulletPayment(
  balance: number,
  annualRate: number,
  isMaturityMonth = false
) {
  if (balance <= 0) return { principal: 0, interest: 0, total: 0 };
  const rate = Math.max(0, annualRate) / 100 / 12;
  const interest = Math.round(balance * rate);
  const principal = isMaturityMonth ? balance : 0;
  return {
    principal,
    interest,
    total: principal + interest,
  };
}

/**
 * 3. 원금균등상환 계산
 */
export function calculateEqualPrincipalPayment(
  balance: number,
  annualRate: number,
  remainingMonths: number
) {
  if (balance <= 0)
    return { principal: 0, interest: 0, total: 0, nextInterest: 0, nextTotal: 0 };

  const months = Math.max(1, remainingMonths);
  const principal = Math.round(balance / months);
  const rate = Math.max(0, annualRate) / 100 / 12;

  const interest = Math.round(balance * rate);
  const total = principal + interest;

  const nextBalance = Math.max(0, balance - principal);
  const nextInterest = Math.round(nextBalance * rate);
  const nextTotal = principal + nextInterest;

  return {
    principal,
    interest,
    total,
    nextInterest,
    nextTotal,
  };
}

/**
 * 4. 원리금균등상환 계산
 */
export function calculateEqualPayment(
  balance: number,
  annualRate: number,
  remainingMonths: number
) {
  if (balance <= 0) return { principal: 0, interest: 0, total: 0 };

  const months = Math.max(1, remainingMonths);
  const r = Math.max(0, annualRate) / 100 / 12;

  if (r === 0) {
    const p = Math.round(balance / months);
    return { principal: p, interest: 0, total: p };
  }

  const factor = Math.pow(1 + r, months);
  const monthlyTotal = Math.round((balance * r * factor) / (factor - 1));
  const interest = Math.round(balance * r);
  const principal = Math.max(0, monthlyTotal - interest);

  return {
    principal,
    interest,
    total: monthlyTotal,
  };
}

/**
 * 5. 단계별 상환 검증 (validateRepaymentPhases)
 */
export function validateRepaymentPhases(
  phases: RepaymentPhase[],
  maturityDate?: string
): PhaseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!phases || phases.length === 0) {
    return { isValid: true, errors, warnings };
  }

  const sorted = [...phases].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const pName = p.phaseName || `${i + 1}단계`;

    if (!p.startDate || !p.endDate) {
      errors.push(`${pName}: 시작일과 종료일이 모두 필요합니다.`);
      continue;
    }

    const sTime = new Date(p.startDate).getTime();
    const eTime = new Date(p.endDate).getTime();

    if (eTime <= sTime) {
      errors.push(`${pName}: 종료일은 시작일보다 늦어야 합니다.`);
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const prevName = prev.phaseName || `${i}단계`;
      const prevETime = new Date(prev.endDate).getTime();

      if (sTime <= prevETime) {
        errors.push(`${prevName}와 ${pName}의 상환 기간이 겹칩니다.`);
      } else {
        const gapDays = (sTime - prevETime) / (1000 * 60 * 60 * 24);
        if (gapDays > 32) {
          warnings.push(
            `${prevName} 종료 후 ${pName} 시작 사이에 비어 있는 기간(${Math.round(
              gapDays
            )}일)이 있습니다.`
          );
        }
      }
    }
  }

  if (maturityDate && sorted.length > 0) {
    const lastPhase = sorted[sorted.length - 1];
    if (lastPhase.endDate !== maturityDate) {
      warnings.push(
        `마지막 단계 종료일(${lastPhase.endDate})이 만기일(${maturityDate})과 다릅니다.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 6. 현재 적용 단계 판별 (calculateCurrentPhase)
 */
export function calculateCurrentPhase(
  phases: RepaymentPhase[],
  referenceDate: Date = new Date()
): { activePhase: RepaymentPhase | null; activePhaseIndex: number } {
  if (!phases || phases.length === 0) {
    return { activePhase: null, activePhaseIndex: -1 };
  }

  const refStr = referenceDate.toISOString().slice(0, 10);
  const sorted = [...phases].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let index = sorted.findIndex((p) => p.startDate <= refStr && refStr <= p.endDate);
  if (index === -1) {
    if (refStr < sorted[0].startDate) {
      index = 0;
    } else {
      index = sorted.length - 1;
    }
  }

  return { activePhase: sorted[index], activePhaseIndex: index };
}

/**
 * 7. 단계 간 잔액 연결 (calculatePhaseOpeningBalance)
 */
export function calculatePhaseOpeningBalance(
  originalBalance: number,
  phases: RepaymentPhase[],
  targetPhaseIndex: number
): number {
  if (!phases || targetPhaseIndex <= 0) return originalBalance;

  const sorted = [...phases].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let currentBal = originalBalance;
  for (let i = 0; i < targetPhaseIndex && i < sorted.length; i++) {
    const p = sorted[i];
    const pType = toRepaymentType(p.repaymentType);
    const pMonths =
      p.termMonths || getRemainingMonthsFromMaturity(p.endDate, new Date(p.startDate));

    if (pType === 'equal_principal') {
      const monthlyP = Math.round(currentBal / Math.max(1, pMonths));
      const totalP = monthlyP * pMonths;
      currentBal = Math.max(0, currentBal - totalP);
    } else if (pType === 'equal_payment') {
      const res = calculateEqualPayment(currentBal, p.annualRate, pMonths);
      const totalP = res.principal * pMonths;
      currentBal = Math.max(0, currentBal - totalP);
    }
  }

  return currentBal;
}

/**
 * 8. 단계별 상환 특정 단계 계산
 */
export function calculateRepaymentPhase(
  balance: number,
  phase: RepaymentPhase,
  overrideMonths?: number
) {
  const type = toRepaymentType(phase.repaymentType);
  const rate = phase.annualRate || 0;
  const months = overrideMonths || phase.termMonths || 12;

  switch (type) {
    case 'interest_only':
      return calculateInterestOnlyPayment(balance, rate);
    case 'bullet':
      return calculateBulletPayment(balance, rate, false);
    case 'equal_principal':
      return calculateEqualPrincipalPayment(balance, rate, months);
    case 'equal_payment':
      return calculateEqualPayment(balance, rate, months);
    case 'custom':
    default:
      if (phase.manualTotalPayment) {
        const interest = phase.manualInterestPayment || Math.round(balance * (rate / 100 / 12));
        const principal = phase.manualPrincipalPayment || Math.max(0, phase.manualTotalPayment - interest);
        return { principal, interest, total: phase.manualTotalPayment };
      }
      return calculateInterestOnlyPayment(balance, rate);
  }
}

/**
 * 9. 종합 부채 계산 모듈 (calculateCurrentDebtPayment)
 */
export function calculateCurrentDebtPayment(
  debt: Partial<OnboardingDebt & Debt>,
  referenceDate: Date = new Date()
): DebtCalculationResult {
  const balance = Number(debt.currentBalance ?? debt.amount ?? debt.originalPrincipal ?? 0);
  const rate = Number(debt.annualRate ?? debt.interestRate ?? debt.rate ?? 0);
  const methodLabel = debt.repaymentMethod || (debt as any).rateType;
  const rawType = debt.repaymentType || toRepaymentType(methodLabel);
  const calcMode = debt.calculationMode || 'contract';

  let remainingMonths = Number(debt.remainingMonths || 0);
  if (!remainingMonths && debt.maturityDate) {
    remainingMonths = getRemainingMonthsFromMaturity(debt.maturityDate, referenceDate);
  }

  // 기본 검증: 잔액 존재 여부
  if (balance <= 0) {
    return {
      currentPrincipal: 0,
      currentInterest: 0,
      currentTotal: 0,
      nextMonthTotal: 0,
      remainingMonths: 0,
      repaymentType: rawType,
      repaymentMethodLabel: toRepaymentMethodLabel(rawType),
      isComplete: false,
      isValid: false,
      manualOverrideUsed: false,
      message: '정확한 계산을 위해 원금상환 시작일 또는 현재 납부액을 입력해주세요',
    };
  }

  // 1) 현재 납부상태 기준 (current_status 모드)
  if (calcMode === 'current_status') {
    const hasEnteredCurrentPayment =
      (debt.currentPrincipalPayment !== undefined && debt.currentPrincipalPayment > 0) ||
      (debt.currentInterestPayment !== undefined && debt.currentInterestPayment > 0) ||
      (debt.currentTotalPayment !== undefined && debt.currentTotalPayment > 0);

    if (hasEnteredCurrentPayment) {
      const curInterest =
        debt.currentInterestPayment ?? Math.round(balance * (rate / 100 / 12));
      const curPrincipal = debt.currentPrincipalPayment ?? 0;
      const curTotal =
        debt.currentTotalPayment ?? (curPrincipal + curInterest);

      const autoRes = {
        currentPrincipal: curPrincipal,
        currentInterest: curInterest,
        currentTotal: curTotal,
        nextMonthTotal: curTotal,
        remainingMonths: remainingMonths || 1,
        repaymentType: rawType,
        repaymentMethodLabel: '현재 납부상태 기준',
        isComplete: true,
        isValid: true,
        manualOverrideUsed: Boolean(debt.manualPaymentOverride),
        autoCalculatedTotal: curTotal,
      };

      if (debt.manualPaymentOverride) {
        const manualTotal = Number(debt.manualTotalPayment ?? debt.manualMonthlyPayment ?? curTotal);
        const manualInterest = Number(debt.manualInterestPayment ?? curInterest);
        const manualPrincipal = Number(debt.manualPrincipalPayment ?? Math.max(0, manualTotal - manualInterest));
        return {
          ...autoRes,
          currentPrincipal: manualPrincipal,
          currentInterest: manualInterest,
          currentTotal: manualTotal,
          manualTotal,
          overrideDiff: manualTotal - curTotal,
        };
      }

      return autoRes;
    }
  }

  // 2) 계약조건 기준 (contract 모드) 및 단일/단계 상환 계산
  // 거치기간 (원금상환 시작일 이전) 판별
  const refStr = referenceDate.toISOString().slice(0, 10);
  const isDefermentPeriod =
    debt.principalRepaymentStartDate && refStr < debt.principalRepaymentStartDate;

  let autoPrincipal = 0;
  let autoInterest = 0;
  let autoTotal = 0;
  let nextMonthTotal = 0;
  let activePhaseName: string | undefined = undefined;
  let nextPhaseChangeDate: string | undefined = undefined;
  let nextPhaseFirstPayment: number | undefined = undefined;

  if (isDefermentPeriod) {
    // 거치기간인 경우 이자만 납부
    const res = calculateInterestOnlyPayment(balance, rate);
    autoPrincipal = res.principal;
    autoInterest = res.interest;
    autoTotal = res.total;
    nextMonthTotal = res.total;
  } else if (rawType === 'stepped' && debt.repaymentPhases && debt.repaymentPhases.length > 0) {
    // 단계별 상환
    const { activePhase, activePhaseIndex } = calculateCurrentPhase(debt.repaymentPhases, referenceDate);
    if (activePhase) {
      activePhaseName = activePhase.phaseName;
      const phaseBalance = calculatePhaseOpeningBalance(balance, debt.repaymentPhases, activePhaseIndex);
      const phaseMonths =
        activePhase.termMonths || getRemainingMonthsFromMaturity(activePhase.endDate, referenceDate);
      const activeRes = calculateRepaymentPhase(phaseBalance, activePhase, phaseMonths);

      autoPrincipal = activeRes.principal;
      autoInterest = activeRes.interest;
      autoTotal = activeRes.total;
      nextMonthTotal = ('nextTotal' in activeRes ? (activeRes as any).nextTotal : activeRes.total);

      const sortedPhases = [...debt.repaymentPhases].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      if (activePhaseIndex < sortedPhases.length - 1) {
        const nextPhase = sortedPhases[activePhaseIndex + 1];
        nextPhaseChangeDate = nextPhase.startDate;
        const nextMonths =
          nextPhase.termMonths ||
          getRemainingMonthsFromMaturity(nextPhase.endDate, new Date(nextPhase.startDate));
        const nextRes = calculateRepaymentPhase(phaseBalance, nextPhase, nextMonths);
        nextPhaseFirstPayment = nextRes.total;
      }
    }
  } else {
    // 단일 상환방식
    const months = Math.max(1, remainingMonths || 12);
    switch (rawType) {
      case 'interest_only': {
        const res = calculateInterestOnlyPayment(balance, rate);
        autoPrincipal = res.principal;
        autoInterest = res.interest;
        autoTotal = res.total;
        nextMonthTotal = res.total;
        break;
      }
      case 'bullet': {
        const isMaturity = months === 1;
        const res = calculateBulletPayment(balance, rate, isMaturity);
        autoPrincipal = res.principal;
        autoInterest = res.interest;
        autoTotal = res.total;
        nextMonthTotal = res.interest;
        break;
      }
      case 'equal_principal': {
        const res = calculateEqualPrincipalPayment(balance, rate, months);
        autoPrincipal = res.principal;
        autoInterest = res.interest;
        autoTotal = res.total;
        nextMonthTotal = res.nextTotal;
        break;
      }
      case 'equal_payment':
      default: {
        const res = calculateEqualPayment(balance, rate, months);
        autoPrincipal = res.principal;
        autoInterest = res.interest;
        autoTotal = res.total;
        nextMonthTotal = res.total;
        break;
      }
    }
  }

  const resultBase: DebtCalculationResult = {
    currentPrincipal: autoPrincipal,
    currentInterest: autoInterest,
    currentTotal: autoTotal,
    nextMonthTotal,
    remainingMonths: remainingMonths || 1,
    repaymentType: rawType,
    repaymentMethodLabel: toRepaymentMethodLabel(rawType),
    isComplete: true,
    isValid: true,
    activePhaseName,
    nextPhaseChangeDate,
    nextPhaseFirstPayment,
    manualOverrideUsed: Boolean(debt.manualPaymentOverride),
    autoCalculatedTotal: autoTotal,
  };

  // 3) 은행 실제 납부액 보정 적용
  if (debt.manualPaymentOverride) {
    const manualTotal = Number(
      debt.manualTotalPayment ?? debt.manualMonthlyPayment ?? autoTotal
    );
    const manualInterest = Number(
      debt.manualInterestPayment ?? autoInterest
    );
    const manualPrincipal = Number(
      debt.manualPrincipalPayment ?? Math.max(0, manualTotal - manualInterest)
    );

    return {
      ...resultBase,
      currentPrincipal: manualPrincipal,
      currentInterest: manualInterest,
      currentTotal: manualTotal,
      manualTotal,
      overrideDiff: manualTotal - autoTotal,
    };
  }

  return resultBase;
}

/**
 * 10. 미래 감소 시뮬레이션 및 일정표 (generateRepaymentSchedule)
 */
export function generateRepaymentSchedule(
  debt: Partial<OnboardingDebt & Debt>,
  monthsToGenerate = 12,
  startDate: Date = new Date()
) {
  const schedule = [];
  let currBalance = Number(debt.currentBalance ?? debt.amount ?? debt.originalPrincipal ?? 0);
  const rate = Number(debt.annualRate ?? debt.interestRate ?? debt.rate ?? 0);

  let remaining = Number(debt.remainingMonths || 12);

  for (let m = 1; m <= monthsToGenerate; m++) {
    if (currBalance <= 0) break;

    const simDate = new Date(startDate.getFullYear(), startDate.getMonth() + m - 1, 1);
    const dateStr = `${simDate.getFullYear()}-${String(simDate.getMonth() + 1).padStart(2, '0')}`;

    const res = calculateCurrentDebtPayment(
      {
        ...debt,
        currentBalance: currBalance,
        annualRate: rate,
        remainingMonths: Math.max(1, remaining - m + 1),
      },
      simDate
    );

    schedule.push({
      monthIndex: m,
      date: dateStr,
      startBalance: currBalance,
      principal: res.currentPrincipal,
      interest: res.currentInterest,
      totalPayment: res.currentTotal,
      endBalance: Math.max(0, currBalance - res.currentPrincipal),
    });

    currBalance = Math.max(0, currBalance - res.currentPrincipal);
  }

  return schedule;
}

/**
 * 11. 미래 부채 잔액 예측 (projectDebtBalance)
 */
export function projectDebtBalance(
  debt: Partial<OnboardingDebt & Debt>,
  monthsToProject = 12,
  referenceDate: Date = new Date()
): { monthIndex: number; projectBalance: number }[] {
  const schedule = generateRepaymentSchedule(debt, monthsToProject, referenceDate);
  return schedule.map((s) => ({
    monthIndex: s.monthIndex,
    projectBalance: s.endBalance,
  }));
}
