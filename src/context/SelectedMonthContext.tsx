import React, { createContext, useContext, useState } from 'react';
import { normalizeMonthKey } from '../utils/monthDataSelectors';

// Format helper functions
// '2026-04' -> '2026년 4월'
export function formatYearMonth(yyyyMm: string): string {
  if (!yyyyMm) return '2026년 4월';
  const match = yyyyMm.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = parseInt(match[2], 10);
    return `${y}년 ${m}월`;
  }
  return yyyyMm;
}

// '2026년 4월' or '2026년 04월' or '2026-04' -> '2026-04'
export function parseToYyyyMm(inputStr: string): string {
  if (!inputStr) return '2026-04';
  if (/^\d{4}-\d{2}$/.test(inputStr)) return inputStr;

  const match = inputStr.match(/(\d{4})년\s*(\d{1,2})월/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    return `${y}-${m}`;
  }
  return '2026-04';
}

// Calculate previous month 'YYYY-MM'
export function getPrevMonth(yyyyMm: string): string {
  const [yStr, mStr] = yyyyMm.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) {
    y = 2026;
    m = 4;
  }
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// Calculate next month 'YYYY-MM'
export function getNextMonth(yyyyMm: string): string {
  const [yStr, mStr] = yyyyMm.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) {
    y = 2026;
    m = 4;
  }
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

// Resolve initial month according to required priorities
function getInitialSelectedMonth(): string {
  // Priority 1: Last user selection in localStorage
  try {
    const saved = localStorage.getItem('cfo_selected_month');
    if (saved && /^\d{4}-\d{2}$/.test(saved)) {
      return saved;
    }
  } catch (e) {
    console.error(e);
  }

  // Priority 2: Most recent completed settlement month from cfo_monthly_records_v3
  try {
    const recordsStr = localStorage.getItem('cfo_monthly_records_v3');
    if (recordsStr) {
      const records = JSON.parse(recordsStr);
      const completedList = Object.keys(records).filter((key) => {
        const status = records[key]?.status;
        return status === '완료' || status === '결산잠금';
      });
      if (completedList.length > 0) {
        completedList.sort((a, b) => {
          const normA = normalizeMonthKey(a);
          const normB = normalizeMonthKey(b);
          if (normA.year !== normB.year) return normB.year - normA.year;
          return normB.month - normA.month;
        });
        const topKey = completedList[0];
        const normTop = normalizeMonthKey(topKey);
        return normTop.yyyyMm;
      }
    }
  } catch (e) {
    console.error(e);
  }

  // Priority 3: Fallback to '2026-04'
  return '2026-04';
}

export interface SelectedMonthContextType {
  selectedMonth: string; // 'YYYY-MM'
  setSelectedMonth: (month: string) => void; // Accepts 'YYYY-MM' or 'YYYY년 M월'
  formattedSelectedMonth: string; // 'YYYY년 M월'
  year: number;
  month: number;
}

const SelectedMonthContext = createContext<SelectedMonthContextType | undefined>(undefined);

export const SelectedMonthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedMonth, setSelectedMonthState] = useState<string>(getInitialSelectedMonth);

  const setSelectedMonth = (monthVal: string) => {
    const normalized = parseToYyyyMm(monthVal);
    setSelectedMonthState(normalized);
    try {
      localStorage.setItem('cfo_selected_month', normalized);
    } catch (e) {
      console.error(e);
    }
  };

  const formattedSelectedMonth = formatYearMonth(selectedMonth);
  const [yStr, mStr] = selectedMonth.split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = parseInt(mStr, 10) || 4;

  return (
    <SelectedMonthContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        formattedSelectedMonth,
        year,
        month,
      }}
    >
      {children}
    </SelectedMonthContext.Provider>
  );
};

export const useSelectedMonth = () => {
  const context = useContext(SelectedMonthContext);
  if (!context) {
    throw new Error('useSelectedMonth must be used within a SelectedMonthProvider');
  }
  return context;
};
