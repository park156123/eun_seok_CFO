import { IncomeSource, IncomeType, IncomeMode } from '../types';

/**
 * Normalizes and migrates any existing or incoming income source record.
 * Guarantees backward compatibility and safe legacy data preservation.
 */
export function normalizeIncomeSource(item: any): IncomeSource {
  if (!item) {
    return {
      id: `inc-${Date.now()}`,
      name: '새 수입원',
      incomeName: '새 수입원',
      incomeType: '사업소득',
      incomeMode: 'variable',
      fixedMonthlyIncome: null,
      legacyMonthlyIncome: 0,
      previousRegisteredIncome: 0,
      monthlyIncome: 0,
      owner: '본인',
      memo: '',
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
  }

  const name = item.name || item.incomeName || '수입원';
  const rawType = item.incomeType || '사업소득';
  const incomeType: IncomeType =
    rawType === '기타' ? '기타소득' : (rawType as IncomeType);

  // Preserve any legacy monthly income value
  const legacyVal =
    typeof item.legacyMonthlyIncome === 'number'
      ? item.legacyMonthlyIncome
      : typeof item.previousRegisteredIncome === 'number'
      ? item.previousRegisteredIncome
      : typeof item.monthlyIncome === 'number'
      ? item.monthlyIncome
      : typeof item.amount === 'number'
      ? item.amount
      : 0;

  // Auto determine mode if missing
  let mode: IncomeMode = item.incomeMode;
  if (!mode) {
    if (incomeType === '임대소득' || incomeType === '근로소득') {
      mode = 'fixed';
    } else {
      mode = 'variable';
    }
  }

  // Determine fixedMonthlyIncome
  let fixedVal: number | null = null;
  if (mode === 'fixed') {
    if (typeof item.fixedMonthlyIncome === 'number' && item.fixedMonthlyIncome >= 0) {
      fixedVal = item.fixedMonthlyIncome;
    } else if (legacyVal > 0) {
      fixedVal = legacyVal;
    } else {
      fixedVal = 0;
    }
  } else {
    fixedVal = null;
  }

  return {
    id: item.id || `inc-${Date.now()}`,
    name,
    incomeName: name,
    incomeType,
    incomeMode: mode,
    fixedMonthlyIncome: fixedVal,
    legacyMonthlyIncome: legacyVal,
    previousRegisteredIncome: legacyVal,
    monthlyIncome: mode === 'fixed' ? (fixedVal ?? 0) : 0,
    owner: item.owner || '본인',
    memo: item.memo || '',
    isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
    createdAt: item.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: item.updatedAt || new Date().toISOString().split('T')[0],
  };
}

/**
 * Default mode for income type when changing dropdown
 */
export function getDefaultModeForType(type: IncomeType): IncomeMode {
  if (type === '임대소득' || type === '근로소득') {
    return 'fixed';
  }
  return 'variable';
}
