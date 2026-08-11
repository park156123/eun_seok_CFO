import React, { useState, useEffect, useRef } from 'react';
import { SettlementData, IncomeSource, IncomeRecord, ClassificationResult, ExclusionReasonCode, MerchantRule, ExclusionRule, RuleConfidence, Transaction } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { SnapshotService, formatMonthKorean } from '../services/snapshotService';
import { normalizeMonthKey, getMonthlyRecordForMonth } from '../utils/monthDataSelectors';
import { saveMonthlySettlementRecordToFirestore, fetchAllMonthlySettlementRecordsFromFirestore, saveSpecialNotesToFirestore } from '../services/firestoreDataService';
import { ActiveSessionBanner } from '../components/ActiveSessionBanner';
import { isConsumerTransaction } from '../utils/consumerExpenseUtils';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { calculateMonthFinancialCost } from '../utils/financialCostCalculator';
import { OpeningSnapshotModal } from '../components/OpeningSnapshotModal';

import {
  readCsvFileWithEncoding,
  parseCsvText,
  parseAndValidateCsvRows,
  parseAmount,
  parseDateString,
  ColumnMapping,
  CsvParseResult,
} from '../utils/csvParser';
import { classifyTransaction, reclassifyTransactions } from '../utils/transactionClassifier';
import {
  CONSUMER_CATEGORIES,
  EXCLUSION_REASONS,
  getExclusionReasonLabel,
} from '../data/initialClassificationRules';

const parseYearMonth = (monthStr: string) => {
  const norm = normalizeMonthKey(monthStr);
  return { year: norm.year, month: norm.month };
};

const getPrevYearMonth = (year: number, month: number) => {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
};

const mapTypeFromClassification = (cls: ClassificationResult): 'living' | 'business' | 'financial' | 'debt' | 'unclassified' => {
  if (cls.classificationType === 'consumer') return 'living';
  if (cls.classificationType === 'excluded') return 'business';
  return 'unclassified';
};

const createTransactionFingerprint = (date: string, merchant: string, amount: number, year: number, month: number) => {
  return `${year}-${month}-${date}-${merchant}-${amount}`;
};

export interface SavingsInvestmentItem {
  id: string;
  name: string;
  type: '적금' | '예금' | '주식' | 'ETF' | '연금' | '코인' | '기타';
  tradeType: '단순저축' | '매수' | '매도';
  amount: number;
  memo?: string;
}

export interface ReviewTransaction {
  id: string;
  date: string;
  transactionType?: string; // 적요 (스마트출금, 체크카드 등)
  merchant: string; // 보낸분/받는분 (주 거래처)
  merchantOriginal?: string; // 보낸분/받는분 원본
  transferMemo?: string; // 송금메모
  classificationText?: string; // 분류용 결합 문자열
  amount: number; // 출금액
  depositAmount?: number; // 입금액
  balance?: number; // 잔액
  rawRow?: Record<string, string>; // 원본 CSV Row
  category: string;
  type: 'living' | 'business' | 'financial' | 'debt' | 'unclassified';
  needsReview: boolean;
  applyFuture?: boolean;
  confidenceLevel: RuleConfidence;
  confidenceScore: number; // e.g., 96, 84, 61
  classificationStatus?: 'pending' | 'classified' | 'needs_confirmation' | 'user_confirmed';

  // 자동분류 확장 필드
  classification?: ClassificationResult;
  userConfirmed?: boolean;
  transactionFingerprint?: string;
  isDuplicate?: boolean;
  settlementYear?: number;
  settlementMonth?: number;
}

export interface MonthlySettlementRecord {
  month: string; // e.g., '2026년 6월'
  status: '미시작' | '진행중' | '완료' | '결산잠금';
  currentStep: 1 | 2 | 3 | 4 | 5;
  incomes: {
    id: string;
    incomeName: string;
    incomeType: string;
    amount: number;
    prevAmount?: number; // Previous month income reference
  }[];
  savingsInvestments: SavingsInvestmentItem[];
  csvUploaded: boolean;
  isSampleData?: boolean;
  csvFileName?: string;
  csvTotalCount?: number;
  csvValidDateCount?: number;
  csvValidMerchantCount?: number;
  csvValidAmountCount?: number;
  csvErrorCount?: number;
  csvAutoCount?: number;
  csvReviewCount?: number;
  csvExcludedCount?: number;
  csvDuplicateCount?: number;
  csvAutoRate?: number;
  transactions: ReviewTransaction[];
  financialCost?: number;
  totalOutflow?: number;
  netCashFlow?: number;
  specialNotes?: string;
  noteConfirmedAt?: string;
  completedAtDate?: string; // e.g., "2026.07.02"
  completedAtTime?: string; // e.g., "21:14"
}

interface SpecialNotesSectionProps {
  selectedMonth: string;
  currentRecord: MonthlySettlementRecord;
  onNotesSaved: (normMonth: string, notes: string, confirmedAt: string) => void;
}

const SpecialNotesSection: React.FC<SpecialNotesSectionProps> = ({
  selectedMonth,
  currentRecord,
  onNotesSaved,
}) => {
  const normMonth = normalizeMonthKey(selectedMonth).yyyyMm;
  const initialNotes = currentRecord?.specialNotes || '';
  const initialConfirmedAt = currentRecord?.noteConfirmedAt || null;

  const [draftNotes, setDraftNotes] = useState<string>(initialNotes);
  const [savedNotes, setSavedNotes] = useState<string>(initialNotes);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initialConfirmedAt);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync draftNotes & savedNotes when selectedMonth or currentRecord's specialNotes/noteConfirmedAt changes
  useEffect(() => {
    const notes = currentRecord?.specialNotes || '';
    const timeAt = currentRecord?.noteConfirmedAt || null;
    setDraftNotes(notes);
    setSavedNotes(notes);
    setConfirmedAt(timeAt);
    setSaveError(null);
  }, [selectedMonth, currentRecord?.specialNotes, currentRecord?.noteConfirmedAt]);

  const isDirty = draftNotes !== savedNotes;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestampStr = `${year}.${month}.${day} ${hours}:${minutes}`;

    try {
      await saveSpecialNotesToFirestore(normMonth, draftNotes, timestampStr);
      setSavedNotes(draftNotes);
      setConfirmedAt(timestampStr);
      setIsSaving(false);
      onNotesSaved(normMonth, draftNotes, timestampStr);
    } catch (err: any) {
      console.error('Failed to save special notes to Firestore:', err);
      setSaveError(err?.message || 'Firestore 저장 중 오류가 발생했습니다.');
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#eceef0] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-[#00236f]">edit_note</span>
          <div>
            <h3 className="font-dohyeon text-base text-[#00236f]">이번 달 특이사항</h3>
            <p className="text-[11px] text-[#757682]">
              이번 달 숫자가 평소와 달라진 이유나 중요한 자금 흐름을 기록해 두세요
            </p>
          </div>
        </div>
      </div>

      <textarea
        value={draftNotes}
        onChange={(e) => {
          setDraftNotes(e.target.value);
          setSaveError(null);
        }}
        placeholder={`예: 현하우스 임차보증금 입금,\n신규 스타일리스트 입사로 매출 증가,\n증가한 현금으로 차입금 원금 상환`}
        className="w-full p-3.5 bg-[#f8f9fc] border border-[#e1e2ec] rounded-xl text-xs text-[#191c1e] placeholder-[#a4a5b2] focus:outline-none focus:border-[#00236f] focus:bg-white focus:ring-1 focus:ring-[#00236f] transition-all resize-none min-h-[90px] leading-relaxed"
        rows={3}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1">
        <div className="text-xs">
          {isSaving ? (
            <span className="text-[#00236f] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm animate-spin">sync</span>
              저장 중...
            </span>
          ) : saveError ? (
            <span className="text-[#dc2626] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">error</span>
              저장 실패 ({saveError})
            </span>
          ) : isDirty ? (
            <span className="text-[#d97706] font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#d97706] animate-pulse"></span>
              ● 저장되지 않은 변경사항
            </span>
          ) : savedNotes.trim() !== '' || confirmedAt ? (
            <span className="text-[#006c49] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              ✓ 저장됨{confirmedAt ? ` (${confirmedAt})` : ''}
            </span>
          ) : (
            <span className="text-[#757682]">작성 후 [특이사항 저장] 버튼을 누르면 Firestore에 영구 저장됩니다.</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <span className="material-symbols-outlined text-base">
            {isSaving ? 'sync' : 'save'}
          </span>
          {isSaving ? '저장 중...' : '특이사항 저장'}
        </button>
      </div>
    </section>
  );
};

interface MonthlySettlementScreenProps {
  onImportCSV?: (csvText: string) => void;
  settlementData?: SettlementData;
  onUpdateSettlement?: (newData: Partial<SettlementData>) => void;
}

export const MonthlySettlementScreen: React.FC<MonthlySettlementScreenProps> = ({
  onImportCSV,
  settlementData,
  onUpdateSettlement,
}) => {
  const { formattedSelectedMonth, setSelectedMonth: setGlobalSelectedMonth } = useSelectedMonth();
  // Available Months for Settlement (전월 결산 기준)
  const monthList = ['2026년 4월', '2026년 5월', '2026년 6월', '2026년 7월'];
  // Default base settlement month receives global selectedMonth as default initial value
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    normalizeMonthKey(formattedSelectedMonth || '2026년 4월').yyyyMm
  );

  // Sync internal selectedMonth state with global SelectedMonthContext
  useEffect(() => {
    if (selectedMonth && setGlobalSelectedMonth) {
      const localNorm = normalizeMonthKey(selectedMonth).yyyyMm;
      const globalNorm = normalizeMonthKey(formattedSelectedMonth || '').yyyyMm;
      if (localNorm !== globalNorm) {
        setGlobalSelectedMonth(localNorm);
      }
    }
  }, [selectedMonth, formattedSelectedMonth, setGlobalSelectedMonth]);

  useEffect(() => {
    if (formattedSelectedMonth) {
      const localNorm = normalizeMonthKey(selectedMonth).yyyyMm;
      const globalNorm = normalizeMonthKey(formattedSelectedMonth).yyyyMm;
      if (localNorm !== globalNorm) {
        setSelectedMonth(globalNorm);
      }
    }
  }, [formattedSelectedMonth, selectedMonth]);


  // Accordion state for Step Progress Card (Requirement 11 - Collapsed by default)
  const [isStepsExpanded, setIsStepsExpanded] = useState<boolean>(false);

  // Celebration overlay state during settlement confirmation (Requirement 10)
  const [isCompleting, setIsCompleting] = useState<boolean>(false);

  // Default initial income sources with previous month reference (Requirement 7)
  const getInitialIncomes = () => {
    try {
      const savedOb = localStorage.getItem('cfo_onboarding_data');
      if (savedOb) {
        const parsed = JSON.parse(savedOb);
        if (parsed.incomeSources && parsed.incomeSources.length > 0) {
          return parsed.incomeSources.map((item: any, idx: number) => ({
            id: item.id || `inc-${Date.now()}-${idx}`,
            incomeName: item.incomeName || '수입원',
            incomeType: item.incomeType || '사업소득',
            amount: item.amount || 0,
            prevAmount: item.amount ? Math.round(item.amount * 0.95) : 3000000,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [
      { id: 'inc-1', incomeName: '미용실 본점', incomeType: '사업소득', amount: 4500000, prevAmount: 4200000 },
      { id: 'inc-2', incomeName: '미용실 2호점', incomeType: '사업소득', amount: 2200000, prevAmount: 2100000 },
      { id: 'inc-3', incomeName: '게스트하우스1', incomeType: '사업소득', amount: 1100000, prevAmount: 1200000 },
      { id: 'inc-4', incomeName: '현하우스 임대료', incomeType: '임대소득', amount: 1500000, prevAmount: 1500000 },
    ];
  };

  // Sample transactions generator with AI classification & confidence levels
  const getSampleTransactions = (sYear: number = 2026, sMonth: number = 6): ReviewTransaction[] => {
    const rawSamples = [
      { id: 'tx-201', date: '06.28 14:20', merchant: '정성자', amount: 350000 },
      { id: 'tx-202', date: '06.26 19:30', merchant: 'GS25 상봉', amount: 14200 },
      { id: 'tx-203', date: '06.25 11:00', merchant: '박진석(현하우스)', amount: 1500000 },
      { id: 'tx-204', date: '06.24 10:15', merchant: '이재호 대여금반환', amount: 800000 },
      { id: 'tx-205', date: '06.22 18:40', merchant: '09079791469875', amount: 125000 },
      { id: 'tx-206', date: '06.20 12:15', merchant: '김용학', amount: 500000 },
      { id: 'tx-207', date: '06.18 20:10', merchant: '신규 음식점', amount: 48000 },
      { id: 'tx-208', date: '06.15 09:30', merchant: 'AWS 클라우드 서버', amount: 124000 },
      { id: 'tx-209', date: '06.12 11:30', merchant: '스타벅스 선릉점', amount: 8500 },
    ];

    const context = {
      rules: GlobalMockDataStore.getMerchantRules(),
      exclusionRules: GlobalMockDataStore.getExclusionRules(),
      categoryRules: GlobalMockDataStore.getCategoryRules(),
    };

    return rawSamples.map((s) => {
      const classification = classifyTransaction(s.merchant, context);
      const isConsumer = classification.classificationType === 'consumer';
      const isExcluded = classification.classificationType === 'excluded';
      const needsConf = classification.needsConfirmation;

      let categoryStr = '미분류';
      if (isConsumer && classification.majorCategory) {
        categoryStr = `${classification.majorCategory} > ${classification.minorCategory}`;
      } else if (isExcluded && classification.exclusionType && !needsConf) {
        categoryStr = `제외 > ${classification.exclusionType}`;
      }

      const fingerprint = createTransactionFingerprint(s.date, s.merchant, s.amount, sYear, sMonth);

      return {
        id: s.id,
        date: s.date,
        merchant: classification.merchantMaster || s.merchant,
        merchantOriginal: s.merchant,
        amount: s.amount,
        category: categoryStr,
        type: mapTypeFromClassification(classification),
        needsReview: needsConf,
        confidenceLevel: classification.confidence,
        confidenceScore:
          classification.confidence === 'high'
            ? 95
            : classification.confidence === 'medium'
            ? 75
            : 40,
        classification,
        userConfirmed: false,
        transactionFingerprint: fingerprint,
        settlementYear: sYear,
        settlementMonth: sMonth,
      };
    });
  };

  // Records map per month stored in localStorage
  const [recordsMap, setRecordsMap] = useState<Record<string, MonthlySettlementRecord>>(() => {
    try {
      const saved = localStorage.getItem('cfo_monthly_records_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed['2026년 5월'];
        delete parsed['2026년 6월'];
        const normalized: Record<string, MonthlySettlementRecord> = {};
        Object.entries(parsed).forEach(([k, v]) => {
          if (v && typeof v === 'object') {
            const norm = normalizeMonthKey(k);
            normalized[norm.yyyyMm] = v as MonthlySettlementRecord;
          }
        });
        return normalized;
      }
    } catch (e) {
      console.error(e);
    }
    // Return default state in React state only (keyed by YYYY-MM) without writing to localStorage/Firestore
    return {
      '2026-04': {
        month: '2026-04',
        year: 2026,
        monthNum: 4,
        status: '결산잠금',
        currentStep: 5,
        incomes: [
          { id: 'inc-401', incomeName: '미용실 본점', incomeType: '사업소득', amount: 28000000, prevAmount: 27500000 },
          { id: 'inc-402', incomeName: '게스트하우스1', incomeType: '사업소득', amount: 4080000, prevAmount: 4000000 },
          { id: 'inc-403', incomeName: '현하우스 임대료', incomeType: '임대소득', amount: 4180000, prevAmount: 4180000 },
        ],
        savingsInvestments: [
          { id: 'sav-401', name: '청년희망적금', type: '적금', tradeType: '단순저축', amount: 500000, memo: '매월 자동이체' },
          { id: 'sav-402', name: '삼성전자 ETF', type: 'ETF', tradeType: '매수', amount: 500000, memo: '적립식 매수' },
        ],
        livingExpense: 8765098,
        financialCost: 8475400,
        principalRepayment: 21330000,
        totalIncome: 36260000,
        totalCashOutflow: 39570498,
        netCashFlow: -3310498,
        csvUploaded: true,
        csvFileName: '2026-04_거래내역.csv',
        csvTotalCount: 42,
        csvAutoCount: 38,
        csvReviewCount: 4,
        transactions: [],
        completedAtDate: '2026.05.02',
        completedAtTime: '18:30',
      },
    };
  });

  // Sync from Firestore on component mount
  useEffect(() => {
    fetchAllMonthlySettlementRecordsFromFirestore().then((fsRecords) => {
      if (fsRecords && Object.keys(fsRecords).length > 0) {
        let mergedToSave: Record<string, MonthlySettlementRecord> | null = null;
        setRecordsMap((prev) => {
          const merged = { ...prev };
          Object.entries(fsRecords).forEach(([k, rec]) => {
            if (rec && typeof rec === 'object') {
              const norm = normalizeMonthKey(k);
              merged[norm.yyyyMm] = rec;
            }
          });
          mergedToSave = merged;
          return merged;
        });

        if (mergedToSave) {
          try {
            localStorage.setItem('cfo_monthly_records_v3', JSON.stringify(mergedToSave));
          } catch (e) {
            console.warn('Failed to save firestore monthly records to local', e);
          }
          (GlobalMockDataStore as any).notifyListeners();
        }
      }
    }).catch((e) => console.warn('MonthlySettlementScreen: Firestore sync failed', e));
  }, []);

  // Current selected month record
  const normSelectedMonth = normalizeMonthKey(selectedMonth);
  const rawRecord =
    recordsMap[normSelectedMonth.yyyyMm] ||
    recordsMap[selectedMonth] ||
    recordsMap[normSelectedMonth.formattedMonth] ||
    getMonthlyRecordForMonth(selectedMonth);

  const currentRecord = {
    month: normSelectedMonth.yyyyMm,
    status: rawRecord?.status || '미시작',
    currentStep: rawRecord?.currentStep || 1,
    csvUploaded: Boolean(rawRecord?.csvUploaded),
    ...rawRecord,
    incomes: Array.isArray(rawRecord?.incomes) ? rawRecord.incomes : getInitialIncomes(),
    savingsInvestments: Array.isArray(rawRecord?.savingsInvestments) ? rawRecord.savingsInvestments : [],
    transactions: Array.isArray(rawRecord?.transactions) && rawRecord.transactions.length > 0
      ? rawRecord.transactions
      : (GlobalMockDataStore.getOtherSettings()?.transactions || []),
  };

  // Expanded breakdown card state
  const [expandedCard, setExpandedCard] = useState<'none' | 'living' | 'financial' | 'debt' | 'savings'>('none');
  const [selectedLivingCategory, setSelectedLivingCategory] = useState<string | null>(null);
  const [isOpeningSnapshotModalOpen, setIsOpeningSnapshotModalOpen] = useState(false);

  // STEP 3 Local States for upload animation, drag & drop, column mapping, and error handling
  const [csvUploadState, setCsvUploadState] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('CSV 업로드 중...');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  // Column Mapping state if auto-detection fails or requires confirmation
  const [pendingCsvData, setPendingCsvData] = useState<CsvParseResult | null>(null);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
  const [mappingForm, setMappingForm] = useState<ColumnMapping>({
    dateCol: '',
    merchantCol: '',
    amountCol: '',
  });
  const [pendingFileName, setPendingFileName] = useState<string>('');

  useEffect(() => {
    setCsvUploadState('idle');
    setCsvErrorMsg(null);
    setUploadProgress(0);
    setIsMappingModalOpen(false);
    setPendingCsvData(null);
  }, [selectedMonth]);

  // Helper mutation
  const updateCurrentRecord = (updater: (prev: MonthlySettlementRecord) => MonthlySettlementRecord) => {
    const normMonth = normalizeMonthKey(selectedMonth).yyyyMm;
    let nextUpdated: MonthlySettlementRecord | null = null;
    let nextMap: Record<string, MonthlySettlementRecord> | null = null;

    setRecordsMap((prev) => {
      const rec = prev[normMonth] || prev[selectedMonth] || {
        month: normMonth,
        status: '미시작',
        currentStep: 1,
        incomes: getInitialIncomes(),
        savingsInvestments: [],
        csvUploaded: false,
        transactions: [],
      };
      const updated = updater(rec);
      nextUpdated = updated;
      nextMap = {
        ...prev,
        [normMonth]: updated,
      };
      return nextMap;
    });

    if (nextMap && nextUpdated) {
      try {
        localStorage.setItem('cfo_monthly_records_v3', JSON.stringify(nextMap));
        saveMonthlySettlementRecordToFirestore(normMonth, nextUpdated);
        (GlobalMockDataStore as any).notifyListeners();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleNotesSaved = (normMonth: string, notes: string, confirmedAt: string) => {
    setRecordsMap((prev) => {
      const rec = prev[normMonth] || prev[selectedMonth] || {
        month: normMonth,
        status: '미시작',
        currentStep: 1,
        incomes: getInitialIncomes(),
        savingsInvestments: [],
        csvUploaded: false,
        transactions: [],
      };
      const updated: MonthlySettlementRecord = {
        ...rec,
        specialNotes: notes,
        noteConfirmedAt: confirmedAt,
      };
      const nextMap = {
        ...prev,
        [normMonth]: updated,
      };
      try {
        localStorage.setItem('cfo_monthly_records_v3', JSON.stringify(nextMap));
      } catch (e) {
        console.error(e);
      }
      return nextMap;
    });
    (GlobalMockDataStore as any).notifyListeners();
  };

  // Selected settlement year & month
  const { year: currentYear, month: currentMonth } = parseYearMonth(selectedMonth);
  const { year: prevYear, month: prevMonth } = getPrevYearMonth(currentYear, currentMonth);

  // Active IncomeSources loaded from GlobalMockDataStore
  const [activeIncomeSources, setActiveIncomeSources] = useState<IncomeSource[]>(() => {
    return GlobalMockDataStore.getIncomeSources().filter((i) => i.isActive !== false);
  });

  useEffect(() => {
    const unsub = GlobalMockDataStore.subscribe(() => {
      const sources = GlobalMockDataStore.getIncomeSources().filter((i) => i.isActive !== false);
      setActiveIncomeSources(sources);
    });
    return unsub;
  }, []);

  // Helper to load inputs for selected month
  const loadStep1InputsForMonth = (sYear: number, sMonth: number, sources: IncomeSource[]) => {
    const records = GlobalMockDataStore.getIncomeRecords(sYear, sMonth);
    const newInputs: Record<string, string> = {};

    sources.forEach((src) => {
      const rec = records.find((r) => r.incomeSourceId === src.id);
      if (rec && rec.actualIncome !== undefined && rec.actualIncome !== null) {
        newInputs[src.id] = rec.actualIncome.toLocaleString('ko-KR');
      } else if (rec && rec.actualIncome === null) {
        newInputs[src.id] = '';
      } else {
        // No IncomeRecord exists yet
        if (src.incomeMode === 'fixed') {
          const defaultVal = src.fixedMonthlyIncome ?? 0;
          newInputs[src.id] = defaultVal > 0 ? defaultVal.toLocaleString('ko-KR') : '0';
        } else {
          // variable income -> default empty
          newInputs[src.id] = '';
        }
      }
    });

    return newInputs;
  };

  // Step 1 Input Values State (map sourceId -> string)
  const [step1Inputs, setStep1Inputs] = useState<Record<string, string>>(() => {
    const { year, month } = parseYearMonth(formattedSelectedMonth || '2026년 4월');
    const initialSources = GlobalMockDataStore.getIncomeSources().filter((i) => i.isActive !== false);
    return loadStep1InputsForMonth(year, month, initialSources);
  });

  // Reload step1Inputs when selectedMonth or activeIncomeSources changes
  useEffect(() => {
    setStep1Inputs(loadStep1InputsForMonth(currentYear, currentMonth, activeIncomeSources));
  }, [selectedMonth, activeIncomeSources]);

  // Previous month actual income helper
  const getPrevMonthActualIncome = (incomeSourceId: string): number | null => {
    const prevRecords = GlobalMockDataStore.getIncomeRecords(prevYear, prevMonth);
    const rec = prevRecords.find((r) => r.incomeSourceId === incomeSourceId);
    if (rec && rec.actualIncome !== undefined && rec.actualIncome !== null) {
      return rec.actualIncome;
    }
    return null;
  };

  // Input change handler
  const handleStep1InputChange = (sourceId: string, rawInput: string) => {
    const cleaned = rawInput.replace(/[^0-9]/g, '');
    let formatted = '';
    if (cleaned.length > 0) {
      const num = parseInt(cleaned, 10);
      if (!isNaN(num) && num >= 0) {
        formatted = num.toLocaleString('ko-KR');
      }
    } else {
      formatted = '';
    }

    setStep1Inputs((prev) => ({
      ...prev,
      [sourceId]: formatted,
    }));
  };

  // Quick apply previous month income
  const handleApplyPrevIncomeForSource = (sourceId: string) => {
    const prevVal = getPrevMonthActualIncome(sourceId);
    if (prevVal !== null) {
      setStep1Inputs((prev) => ({
        ...prev,
        [sourceId]: prevVal.toLocaleString('ko-KR'),
      }));
    }
  };

  // Real-time step 1 total calculation
  const calculatedStep1Total = activeIncomeSources.reduce((sum, src) => {
    const valStr = step1Inputs[src.id] ?? '';
    if (valStr.trim() === '') return sum;
    const num = parseInt(valStr.replace(/[^0-9]/g, ''), 10) || 0;
    return sum + num;
  }, 0);

  // Modal for unentered variable income validation
  const [unenteredValidationModal, setUnenteredValidationModal] = useState<{
    isOpen: boolean;
    unenteredSources: IncomeSource[];
  }>({
    isOpen: false,
    unenteredSources: [],
  });

  // Modal for month switch unsaved changes confirmation
  const [pendingMonthSwitch, setPendingMonthSwitch] = useState<string | null>(null);

  // Check unsaved changes
  const checkHasUnsavedChanges = (sYear: number, sMonth: number) => {
    const savedInputs = loadStep1InputsForMonth(sYear, sMonth, activeIncomeSources);
    for (const src of activeIncomeSources) {
      const currentVal = (step1Inputs[src.id] ?? '').trim();
      const savedVal = (savedInputs[src.id] ?? '').trim();
      if (currentVal !== savedVal) {
        return true;
      }
    }
    return false;
  };

  const getMonthIndex = (mStr: string) => {
    const norm = normalizeMonthKey(mStr).yyyyMm;
    return monthList.findIndex((m) => normalizeMonthKey(m).yyyyMm === norm);
  };

  // Month Switchers with unsaved changes check
  const handlePrevMonth = () => {
    const idx = getMonthIndex(selectedMonth);
    if (idx > 0) {
      const targetMonth = monthList[idx - 1];
      if (checkHasUnsavedChanges(currentYear, currentMonth)) {
        setPendingMonthSwitch(targetMonth);
      } else {
        setSelectedMonth(targetMonth);
      }
    }
  };

  const handleNextMonth = () => {
    const idx = getMonthIndex(selectedMonth);
    if (idx >= 0 && idx < monthList.length - 1) {
      const targetMonth = monthList[idx + 1];
      if (checkHasUnsavedChanges(currentYear, currentMonth)) {
        setPendingMonthSwitch(targetMonth);
      } else {
        setSelectedMonth(targetMonth);
      }
    }
  };

  // Save Step 1 Records
  const saveStep1Records = (overrideUnenteredAsZero: boolean = false) => {
    const recordsToSave: IncomeRecord[] = activeIncomeSources.map((src) => {
      let rawVal = step1Inputs[src.id] ?? '';
      let actualIncome: number | null = null;

      if (rawVal.trim() === '') {
        if (overrideUnenteredAsZero && src.incomeMode === 'variable') {
          actualIncome = 0;
        } else {
          actualIncome = null;
        }
      } else {
        actualIncome = parseInt(rawVal.replace(/[^0-9]/g, ''), 10);
        if (isNaN(actualIncome) || actualIncome < 0) actualIncome = 0;
      }

      const existingRecord = GlobalMockDataStore.getIncomeRecord(src.id, currentYear, currentMonth);

      return {
        id: existingRecord?.id || `rec-${currentYear}-${currentMonth}-${src.id}`,
        incomeSourceId: src.id,
        year: currentYear,
        month: currentMonth,
        actualIncome,
        incomeModeSnapshot: src.incomeMode || 'variable',
        incomeTypeSnapshot: src.incomeType || '사업소득',
        incomeSourceNameSnapshot: src.incomeName || src.name || '수입원',
        memo: src.memo,
        createdAt: existingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    GlobalMockDataStore.saveIncomeRecords(recordsToSave);

    // Update recordsMap for this month so rest of application screens use saved incomes
    const newIncomesList = activeIncomeSources.map((src) => {
      const rec = recordsToSave.find((r) => r.incomeSourceId === src.id);
      return {
        id: src.id,
        incomeName: src.incomeName || src.name || '수입원',
        incomeType: src.incomeType || '사업소득',
        amount: rec?.actualIncome ?? 0,
        prevAmount: getPrevMonthActualIncome(src.id) ?? undefined,
      };
    });

    updateCurrentRecord((rec) => ({
      ...rec,
      status: '진행중',
      incomes: newIncomesList,
      currentStep: 2,
    }));
  };

  const handleStep1Complete = () => {
    const unenteredVariable = activeIncomeSources.filter((src) => {
      if (src.incomeMode !== 'variable') return false;
      const val = step1Inputs[src.id] ?? '';
      return val.trim() === '';
    });

    if (unenteredVariable.length > 0) {
      setUnenteredValidationModal({
        isOpen: true,
        unenteredSources: unenteredVariable,
      });
    } else {
      saveStep1Records(false);
    }
  };

  // STEP 2: Savings & Investments Handlers (Requirement 8 - Trade Type support)
  const [isAddingSavingsModal, setIsAddingSavingsModal] = useState(false);
  const [savingsForm, setSavingsForm] = useState<{
    name: string;
    type: '적금' | '예금' | '주식' | 'ETF' | '연금' | '코인' | '기타';
    tradeType: '단순저축' | '매수' | '매도';
    amount: string;
    memo: string;
  }>({
    name: '',
    type: '적금',
    tradeType: '단순저축',
    amount: '',
    memo: '',
  });

  const handleAddSavings = () => {
    if (!savingsForm.name.trim()) return;
    const val = parseInt(savingsForm.amount.replace(/[^0-9]/g, ''), 10) || 0;
    const newItem: SavingsInvestmentItem = {
      id: `sav-${Date.now()}`,
      name: savingsForm.name.trim(),
      type: savingsForm.type,
      tradeType: savingsForm.tradeType,
      amount: val,
      memo: savingsForm.memo,
    };
    updateCurrentRecord((rec) => ({
      ...rec,
      savingsInvestments: [...rec.savingsInvestments, newItem],
    }));
    setSavingsForm({ name: '', type: '적금', tradeType: '단순저축', amount: '', memo: '' });
    setIsAddingSavingsModal(false);
  };

  const handleDeleteSavings = (id: string) => {
    updateCurrentRecord((rec) => ({
      ...rec,
      savingsInvestments: rec.savingsInvestments.filter((s) => s.id !== id),
    }));
  };

  const handleStep2Complete = () => {
    updateCurrentRecord((rec) => ({
      ...rec,
      currentStep: 3,
    }));
  };

  // STEP 3: Real CSV Upload Handlers with UTF-8 / CP949 encoding detection & PapaParse
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processRealCsvFile = async (file: File) => {
    if (
      file.name &&
      !file.name.endsWith('.csv') &&
      !file.name.endsWith('.txt') &&
      !file.name.endsWith('.xls') &&
      !file.name.endsWith('.xlsx')
    ) {
      setCsvErrorMsg('지원하지 않는 파일 형식입니다. (.csv 또는 .txt 파일)을 선택해주세요.');
      setCsvUploadState('error');
      return;
    }

    setCsvErrorMsg(null);
    setCsvUploadState('uploading');
    setUploadProgress(20);
    setUploadStatusText('파일 인코딩 및 내용 확인 중...');

    try {
      // 1. Read actual file content handling Korean encodings
      const csvText = await readCsvFileWithEncoding(file);

      setUploadProgress(50);
      setUploadStatusText('CSV 헤더 및 거래 내역 파싱 중...');

      // 2. Parse CSV text without calling AI classifier
      const parseResult = parseCsvText(csvText);

      if (parseResult.totalRows === 0 && parseResult.transactions.length === 0) {
        setCsvErrorMsg('CSV 파일에 거래 데이터가 없거나 형식을 읽을 수 없습니다.');
        setCsvUploadState('error');
        return;
      }

      setUploadProgress(85);
      setUploadStatusText('거래내역 파싱 및 검증 진행 중...');

      if (onImportCSV) {
        onImportCSV(csvText);
      }

      setPendingFileName(file.name);
      setPendingCsvData(parseResult);

      // 3. Check if auto column mapping succeeded
      if (parseResult.hasAutoMapping) {
        setTimeout(() => {
          setUploadProgress(100);
          const stats = parseResult.stats;

          const merchantRules = GlobalMockDataStore.getMerchantRules();
          const exclusionRules = GlobalMockDataStore.getExclusionRules();
          const categoryRules = GlobalMockDataStore.getCategoryRules();
          const classifiedTxs = reclassifyTransactions(parseResult.transactions, {
            rules: merchantRules,
            exclusionRules,
            categoryRules,
          });

          const autoCount = classifiedTxs.filter((t) => !t.needsReview).length;
          const reviewCount = classifiedTxs.filter((t) => t.needsReview).length;
          const excludedCount = classifiedTxs.filter((t) => t.classification?.classificationType === 'excluded').length;
          const totalCount = classifiedTxs.length;
          const autoRate = totalCount > 0 ? Math.round((autoCount / totalCount) * 1000) / 10 : 0;

          // Requirement 1 & 5: CSV upload starts a fresh independent session in GlobalMockDataStore
          const sessionTxs: Transaction[] = classifiedTxs.map((t) => ({
            id: t.id,
            date: t.date,
            time: t.time || '12:00',
            merchant: t.merchant,
            merchantOriginal: t.merchantOriginal,
            amount: t.amount,
            type: 'living',
            category: t.category || '분류 대기',
            icon: 'receipt',
            userConfirmed: t.userConfirmed,
            needsReview: t.needsReview,
            classification: t.classification,
          }));
          GlobalMockDataStore.startNewCsvSession({
            fileName: file.name,
            transactions: sessionTxs,
          });

          updateCurrentRecord((rec) => ({
            ...rec,
            csvUploaded: true,
            isSampleData: false,
            csvFileName: file.name,
            csvTotalCount: totalCount,
            csvAutoCount: autoCount,
            csvReviewCount: reviewCount,
            csvExcludedCount: excludedCount,
            csvAutoRate: autoRate,
            csvValidDateCount: stats.validDateCount,
            csvValidMerchantCount: stats.validMerchantCount,
            csvValidAmountCount: stats.validAmountCount,
            csvErrorCount: stats.errorCount,
            transactions: classifiedTxs,
            currentStep: 3,
          }));
          setCsvUploadState('completed');
        }, 500);
      } else {
        setMappingForm(parseResult.detectedMapping);
        setUploadProgress(100);
        setCsvUploadState('idle');
        setIsMappingModalOpen(true);
      }
    } catch (err) {
      console.error('CSV File Parsing Error:', err);
      setCsvErrorMsg('CSV 파일을 읽는 중 오류가 발생했습니다. 파일 인코딩 및 형식을 확인해주세요.');
      setCsvUploadState('error');
    }
  };

  const handleConfirmMapping = () => {
    if (!pendingCsvData) return;
    const { transactions, stats } = parseAndValidateCsvRows(
      pendingCsvData.rawRows,
      mappingForm
    );

    const merchantRules = GlobalMockDataStore.getMerchantRules();
    const exclusionRules = GlobalMockDataStore.getExclusionRules();
    const categoryRules = GlobalMockDataStore.getCategoryRules();
    const classifiedTxs = reclassifyTransactions(transactions, {
      rules: merchantRules,
      exclusionRules,
      categoryRules,
    });

    const autoCount = classifiedTxs.filter((t) => !t.needsReview).length;
    const reviewCount = classifiedTxs.filter((t) => t.needsReview).length;
    const excludedCount = classifiedTxs.filter((t) => t.classification?.classificationType === 'excluded').length;
    const totalCount = classifiedTxs.length;
    const autoRate = totalCount > 0 ? Math.round((autoCount / totalCount) * 1000) / 10 : 0;

    const sessionTxs: Transaction[] = classifiedTxs.map((t) => ({
      id: t.id,
      date: t.date,
      time: t.time || '12:00',
      merchant: t.merchant,
      merchantOriginal: t.merchantOriginal,
      amount: t.amount,
      type: 'living',
      category: t.category || '분류 대기',
      icon: 'receipt',
      userConfirmed: t.userConfirmed,
      needsReview: t.needsReview,
      classification: t.classification,
    }));
    GlobalMockDataStore.startNewCsvSession({
      fileName: pendingFileName || '업로드_거래내역.csv',
      transactions: sessionTxs,
    });

    updateCurrentRecord((rec) => ({
      ...rec,
      csvUploaded: true,
      isSampleData: false,
      csvFileName: pendingFileName || '업로드_거래내역.csv',
      csvTotalCount: totalCount,
      csvAutoCount: autoCount,
      csvReviewCount: reviewCount,
      csvExcludedCount: excludedCount,
      csvAutoRate: autoRate,
      csvValidDateCount: stats.validDateCount,
      csvValidMerchantCount: stats.validMerchantCount,
      csvValidAmountCount: stats.validAmountCount,
      csvErrorCount: stats.errorCount,
      transactions: classifiedTxs,
      currentStep: 3,
    }));

    setIsMappingModalOpen(false);
    setCsvUploadState('completed');
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processRealCsvFile(file);
    }
    e.target.value = '';
  };

  const handleLoadSampleCSV = () => {
    setCsvErrorMsg(null);
    setCsvUploadState('uploading');
    setUploadProgress(30);
    setUploadStatusText('샘플 데이터 불러오는 중...');

    setTimeout(() => {
      setUploadProgress(70);
      setUploadStatusText('샘플 거래내역 로드 중...');
    }, 400);

    setTimeout(() => {
      setUploadProgress(100);
      const { year: sYear, month: sMonth } = parseYearMonth(selectedMonth);
      const sampleTxs = getSampleTransactions(sYear, sMonth);
      const autoCount = sampleTxs.filter((t) => !t.needsReview).length;
      const reviewCount = sampleTxs.filter((t) => t.needsReview).length;
      const excludedCount = sampleTxs.filter((t) => !t.classification?.included).length;
      const totalCount = sampleTxs.length;
      const autoRate = totalCount > 0 ? Math.round((autoCount / totalCount) * 1000) / 10 : 0;

      updateCurrentRecord((rec) => ({
        ...rec,
        csvUploaded: true,
        isSampleData: true,
        csvFileName: `${selectedMonth.replace('2026년 ', '')}_신한카드_통장(샘플).csv`,
        csvTotalCount: totalCount,
        csvAutoCount: autoCount,
        csvReviewCount: reviewCount,
        csvExcludedCount: excludedCount,
        csvDuplicateCount: 0,
        csvAutoRate: autoRate,
        transactions: sampleTxs,
        currentStep: 3,
      }));
      setCsvUploadState('completed');
    }, 800);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processRealCsvFile(file);
    }
  };

  const handleResetCSVUpload = () => {
    GlobalMockDataStore.resetCurrentCsvSession();
    setCsvUploadState('idle');
    setCsvErrorMsg(null);
    setPendingCsvData(null);
    updateCurrentRecord((rec) => ({
      ...rec,
      csvUploaded: false,
      csvFileName: undefined,
      csvTotalCount: 0,
      csvAutoCount: 0,
      csvReviewCount: 0,
      csvExcludedCount: 0,
      csvDuplicateCount: 0,
      csvAutoRate: 0,
      csvValidDateCount: 0,
      csvValidMerchantCount: 0,
      csvValidAmountCount: 0,
      csvErrorCount: 0,
      transactions: [],
    }));
  };

  // STEP 4: Transaction Review Handlers (Requirements 5 & 6)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'needsReview' | 'consumer' | 'excluded'>('all');
  const [consumerSubFilter, setConsumerSubFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    setSearchQuery('');
  }, [selectedMonth]);

  const [editingTx, setEditingTx] = useState<ReviewTransaction | null>(null);
  const [modalChoice, setModalChoice] = useState<'consumer' | 'excluded'>('consumer');
  const [modalMajorCat, setModalMajorCat] = useState<string>('식비');
  const [modalMinorCat, setModalMinorCat] = useState<string>('외식');
  const [modalExclusionReason, setModalExclusionReason] = useState<ExclusionReasonCode>('internal_transfer');
  const [applyFuture, setApplyFuture] = useState<boolean>(true);

  const openEditModal = (tx: ReviewTransaction) => {
    setEditingTx(tx);
    const cls = tx.classification;
    const isExcluded = cls?.classificationType === 'excluded' || tx.type === 'business' || tx.type === 'debt' || tx.type === 'financial';
    setModalChoice(isExcluded ? 'excluded' : 'consumer');

    if (cls?.majorCategory && CONSUMER_CATEGORIES[cls.majorCategory]) {
      setModalMajorCat(cls.majorCategory);
      setModalMinorCat(cls.minorCategory || CONSUMER_CATEGORIES[cls.majorCategory][0]);
    } else {
      setModalMajorCat('식비');
      setModalMinorCat('외식');
    }

    if (cls?.exclusionReason) {
      setModalExclusionReason(cls.exclusionReason);
    } else {
      setModalExclusionReason('internal_transfer');
    }

    setApplyFuture(true);
  };

  const handleToggleTxReview = (id: string) => {
    updateCurrentRecord((rec) => ({
      ...rec,
      transactions: rec.transactions.map((t) =>
        t.id === id ? { ...t, needsReview: !t.needsReview } : t
      ),
    }));
  };

  const handleApproveAllTx = () => {
    updateCurrentRecord((rec) => ({
      ...rec,
      transactions: rec.transactions.map((t) => ({ ...t, needsReview: false })),
    }));
  };

  const handleSaveTxClassification = () => {
    if (!editingTx) return;

    const targetMerchant = editingTx.merchant;
    const isConsumer = modalChoice === 'consumer';

    if (applyFuture && targetMerchant) {
      if (isConsumer) {
        GlobalMockDataStore.saveUserMerchantLearning(
          editingTx.merchantOriginal || targetMerchant,
          targetMerchant,
          modalMajorCat,
          modalMinorCat
        );
      } else {
        const userExRule: ExclusionRule = {
          id: `user-ex-rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          patterns: Array.from(new Set([targetMerchant, editingTx.merchantOriginal || targetMerchant])).filter(Boolean),
          matchType: 'contains',
          exclusionType: getExclusionReasonLabel(modalExclusionReason),
          exclusionReason: modalExclusionReason,
          dashboardTreatment: 'exclude',
          debtTreatment: 'none',
          isActive: true,
        };
        GlobalMockDataStore.saveExclusionRule(userExRule);
      }
    }

    updateCurrentRecord((rec) => {
      const newCls: ClassificationResult = isConsumer
        ? {
            merchantOriginal: editingTx.merchantOriginal || targetMerchant,
            merchantNormalized: targetMerchant,
            merchantMaster: targetMerchant,
            classificationType: 'consumer',
            majorCategory: modalMajorCat,
            minorCategory: modalMinorCat,
            exclusionReason: null,
            exclusionType: null,
            included: true,
            confidence: 'high',
            needsConfirmation: false,
            appliedRuleType: 'user-confirmed',
            userConfirmed: true,
            reviewCompleted: true,
          }
        : {
            merchantOriginal: editingTx.merchantOriginal || targetMerchant,
            merchantNormalized: targetMerchant,
            merchantMaster: targetMerchant,
            classificationType: 'excluded',
            majorCategory: null,
            minorCategory: null,
            exclusionReason: modalExclusionReason,
            exclusionType: getExclusionReasonLabel(modalExclusionReason),
            included: false,
            confidence: 'high',
            needsConfirmation: false,
            appliedRuleType: 'user-confirmed',
            userConfirmed: true,
            reviewCompleted: true,
          };

      const newCategoryStr = isConsumer
        ? `${modalMajorCat} > ${modalMinorCat}`
        : `제외 > ${getExclusionReasonLabel(modalExclusionReason)}`;

      return {
        ...rec,
        transactions: rec.transactions.map((t) => {
          const isMatch = applyFuture ? t.merchant === targetMerchant : t.id === editingTx.id;
          if (isMatch) {
            return {
              ...t,
              category: newCategoryStr,
              type: isConsumer ? 'living' : 'business',
              needsReview: false,
              confidenceLevel: 'high',
              confidenceScore: 100,
              userConfirmed: true,
              classificationStatus: 'user_confirmed',
              classification: newCls,
            };
          }
          return t;
        }),
      };
    });

    setEditingTx(null);
  };

  const handleStep4Complete = () => {
    updateCurrentRecord((rec) => ({
      ...rec,
      currentStep: 5,
    }));
  };

  // STEP 5 & Celebration Confirmation (Requirement 9 & 10 & 3 & 2)
  const handleConfirmSettlement = () => {
    // Trigger celebration overlay for ~2.2 seconds (Requirement 10)
    setIsCompleting(true);

    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    setTimeout(() => {
      setIsCompleting(false);
      setGlobalSelectedMonth(selectedMonth);
      updateCurrentRecord((rec) => ({
        ...rec,
        status: '결산잠금', // Lock status (Requirement 2)
        financialCost: financialCostResult.totalCost, // Save financial cost snapshot at lock time
        totalOutflow: totalCashOutflow,
        netCashFlow: netCashFlow,
        completedAtDate: dateStr,
        completedAtTime: timeStr,
      }));

      // Notify parent App component
      if (onUpdateSettlement) {
        onUpdateSettlement({
          hasData: true,
          targetMonth: '2026년 8월',
          status: '완료',
          baseMonth: `${selectedMonth} 결산 완료`,
          lastUpdated: `${dateStr} ${timeStr}`,
        });
      }
    }, 2200);
  };

  // Unlock / Re-edit workspace
  const handleReeditSettlement = () => {
    updateCurrentRecord((rec) => ({
      ...rec,
      status: '진행중',
      currentStep: 1,
    }));
  };

  // Financial calculations
  const calculatedTotalIncome = currentRecord.incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const calculatedTotalSavings = currentRecord.savingsInvestments.reduce((s, i) => s + (i.amount || 0), 0);

  const consumerTransactions = currentRecord.transactions.filter(isConsumerTransaction);
  const calculatedLivingExpense = consumerTransactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const isLockedSettlement = currentRecord.status === '결산잠금' || currentRecord.status === '완료';

  const totalIncome = (isLockedSettlement && currentRecord.totalIncome !== undefined && currentRecord.totalIncome !== null)
    ? Number(currentRecord.totalIncome)
    : calculatedTotalIncome;

  const totalSavings = (isLockedSettlement && currentRecord.totalSavings !== undefined && currentRecord.totalSavings !== null)
    ? Number(currentRecord.totalSavings)
    : calculatedTotalSavings;

  const livingExpense = (isLockedSettlement && currentRecord.livingExpense !== undefined && currentRecord.livingExpense !== null)
    ? Number(currentRecord.livingExpense)
    : calculatedLivingExpense;
  const consumerExpense = livingExpense;

  // Living category breakdown
  const livingCategoryMap: Record<string, { amount: number; count: number }> = {};
  consumerTransactions.forEach((t) => {
    const cat = t.category || '기타소비';
    if (!livingCategoryMap[cat]) {
      livingCategoryMap[cat] = { amount: 0, count: 0 };
    }
    livingCategoryMap[cat].amount += Number(t.amount) || 0;
    livingCategoryMap[cat].count += 1;
  });

  const livingCategoryBreakdown = Object.entries(livingCategoryMap).map(([name, data]) => ({
    name,
    amount: data.amount,
    count: data.count,
    pct: livingExpense > 0 ? Math.round((data.amount / livingExpense) * 100) : 0,
  }));

  // Opening Snapshot & Debt Interest Calculation
  const monthKey = normalizeMonthKey(currentRecord.month || selectedMonth || '2026-04').yyyyMm;
  const snapshotStatus = SnapshotService.getOpeningSnapshotStatus(monthKey);
  const financialCostResult = calculateMonthFinancialCost(monthKey);
  const hasConfirmedOpeningForMonth = financialCostResult.hasSnapshot;
  const snapshotDebtsForMonth = (SnapshotService.getDebtSnapshotsByMonth(monthKey) || []).filter((d) => d.isIncluded !== false);
  const interestBreakdownList = financialCostResult.items;

  // Check if locked settlement has 0 or uncalculated financial cost due to prior snapshot lookup error
  const isLockedWithSnapshotLookupError =
    isLockedSettlement &&
    hasConfirmedOpeningForMonth &&
    (currentRecord.financialCost === 0 || currentRecord.financialCost === undefined) &&
    financialCostResult.totalCost > 0;

  const financialCost = (isLockedSettlement && currentRecord.financialCost !== undefined && !isLockedWithSnapshotLookupError)
    ? Number(currentRecord.financialCost)
    : financialCostResult.totalCost;

  const isFinancialCostMismatchWithSnapshot =
    isLockedSettlement &&
    !isLockedWithSnapshotLookupError &&
    currentRecord.financialCost !== undefined &&
    currentRecord.financialCost !== financialCostResult.totalCost;

  const debtCount = interestBreakdownList.length;

  // Debt Principal Repayments
  const csvDebtPrincipalTxs = currentRecord.transactions.filter((t) => {
    if (t.isIncome) return false;
    const cls = t.classification;
    if (cls) {
      return (
        cls.classificationType === 'debt_principal' ||
        cls.exclusionReason === 'debt_principal_repayment' ||
        cls.exclusionReason === 'debt'
      );
    }
    const cat = t.category || '';
    return t.type === 'debt' || cat.includes('부채상환') || cat.includes('원금상환');
  });

  const csvDebtPrincipalItems = csvDebtPrincipalTxs.map((t) => ({
    id: t.id,
    title: t.merchant,
    amount: Number(t.amount) || 0,
    sourceType: 'csv' as const,
    sourceLabel: 'CSV 확정 내역',
    detail: `${t.date} • ${t.category || '원금상환'}`,
  }));

  const snapshotScheduledItems = (hasConfirmedOpeningForMonth ? snapshotDebtsForMonth : [])
    .filter((d) => (Number(d.scheduledPrincipalRepayment) || 0) > 0)
    .map((d) => ({
      id: `snap-rep-${d.id}`,
      title: `${d.debtNameSnapshot || '부채'} 예정 원금상환`,
      amount: Number(d.scheduledPrincipalRepayment) || 0,
      sourceType: 'snapshot' as const,
      sourceLabel: '스냅샷 예정 상환액',
      detail: `${d.creditorNameSnapshot || '금융기관'} • 스냅샷 설정`,
    }));

  const debtPrincipalItems = [...csvDebtPrincipalItems, ...snapshotScheduledItems];
  const calculatedDebtPrincipal = debtPrincipalItems.reduce((s, i) => s + i.amount, 0);
  const debtPrincipal = (isLockedSettlement && (currentRecord.principalRepayment !== undefined || currentRecord.debtPrincipalRepayment !== undefined))
    ? Number(currentRecord.principalRepayment ?? currentRecord.debtPrincipalRepayment)
    : calculatedDebtPrincipal;

  const totalCashOutflow = (isLockedSettlement && currentRecord.totalCashOutflow !== undefined && currentRecord.totalCashOutflow !== null)
    ? Number(currentRecord.totalCashOutflow)
    : (consumerExpense + financialCost + debtPrincipal + totalSavings);

  const netCashFlow = (isLockedSettlement && currentRecord.netCashFlow !== undefined && currentRecord.netCashFlow !== null)
    ? Number(currentRecord.netCashFlow)
    : (totalIncome - totalCashOutflow);

  const needsReviewCount = currentRecord.transactions.filter((t) => {
    const cls = t.classification;
    const isUserConfirmed = t.userConfirmed || t.classificationStatus === 'user_confirmed';
    return !isUserConfirmed && (t.needsReview || cls?.needsConfirmation || t.classificationStatus === 'needs_confirmation');
  }).length;

  const unclassifiedCount = currentRecord.transactions.filter((t) => {
    const cls = t.classification;
    return !t.userConfirmed && (t.classificationStatus === 'pending' || (!cls && t.category === '미분류'));
  }).length;

  const consumerCount = currentRecord.transactions.filter((t) => {
    const cls = t.classification;
    const isPending = t.classificationStatus === 'pending' || (!cls && t.category === '미분류' && !t.userConfirmed);
    return !isPending && (cls ? cls.classificationType === 'consumer' : t.type === 'living');
  }).length;

  const excludedCount = currentRecord.transactions.filter((t) => {
    const cls = t.classification;
    const isPending = t.classificationStatus === 'pending' || (!cls && t.category === '미분류' && !t.userConfirmed);
    return !isPending && (cls ? cls.classificationType === 'excluded' : (t.type === 'business' || t.type === 'financial' || t.type === 'debt'));
  }).length;

  const formatKRW = (val: number) => val.toLocaleString('ko-KR');

  // Filtered transactions for Step 4
  const filteredTransactions = currentRecord.transactions.filter((t) => {
    const cls = t.classification;
    const isPending = t.classificationStatus === 'pending' || (!cls && t.category === '미분류' && !t.userConfirmed);
    const isUserConfirmed = t.userConfirmed || t.classificationStatus === 'user_confirmed';
    const isNeedsReview = !isUserConfirmed && (t.needsReview || cls?.needsConfirmation || t.classificationStatus === 'needs_confirmation');
    const isConsumer = cls ? cls.classificationType === 'consumer' : t.type === 'living';
    const isExcluded = cls ? cls.classificationType === 'excluded' : (t.type === 'business' || t.type === 'financial' || t.type === 'debt');

    if (reviewFilter === 'needsReview') {
      if (!isNeedsReview) return false;
    } else if (reviewFilter === 'consumer') {
      if (!isConsumer || isPending) return false;
      if (consumerSubFilter !== 'all') {
        if (cls?.majorCategory !== consumerSubFilter) return false;
      }
    } else if (reviewFilter === 'excluded') {
      if (!isExcluded || isPending) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qNoComma = q.replace(/,/g, '');

      // 1. Amount matching
      let amountMatch = false;
      if (t.amount !== undefined && t.amount !== null) {
        const rawAmt = String(t.amount);
        const formattedAmt = t.amount.toLocaleString('ko-KR');
        if (rawAmt.includes(qNoComma) || formattedAmt.toLowerCase().includes(q)) {
          amountMatch = true;
        }
      }

      // 2. Text fields matching
      const statusKeywords = [
        isPending ? '분류대기 분류 대기 미분류' : '',
        isNeedsReview ? '확인필요 확인 필요 검토' : '',
        isUserConfirmed ? '검토완료 검토 완료 사용자확인 승인' : '',
        isConsumer ? '소비' : '',
        isExcluded ? '제외' : '',
      ].join(' ');

      const exclusionLabel = cls?.exclusionReason ? getExclusionReasonLabel(cls.exclusionReason) : '';

      const textFields = [
        t.merchant,
        (t as any).merchantOriginal,
        (t as any).merchantMaster,
        (t as any).transactionType,
        (t as any).transferMemo,
        t.memo,
        (t as any).userMemo,
        t.category,
        cls?.majorCategory,
        cls?.minorCategory,
        cls?.exclusionReason,
        cls?.exclusionType,
        exclusionLabel,
        cls?.userQuestion,
        statusKeywords,
      ];

      const textMatch = textFields.some((field) => {
        if (!field) return false;
        return String(field).toLowerCase().includes(q);
      });

      if (!amountMatch && !textMatch) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-28">
      {/* ================= 1. Top Month Selector Header ================= */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            disabled={getMonthIndex(selectedMonth) <= 0}
            className="p-1.5 rounded-xl text-[#757682] hover:bg-[#f0f4fd] hover:text-[#00236f] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>

          <div className="text-center">
            <span className="font-dohyeon text-lg text-[#00236f] block">
              {normalizeMonthKey(selectedMonth).formattedMonth} 결산
            </span>
            <span className="text-[10px] text-[#757682] font-medium block -mt-1">
              (전월 결산 기준)
            </span>
          </div>

          <button
            onClick={handleNextMonth}
            disabled={getMonthIndex(selectedMonth) >= monthList.length - 1 || getMonthIndex(selectedMonth) === -1}
            className="p-1.5 rounded-xl text-[#757682] hover:bg-[#f0f4fd] hover:text-[#00236f] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>

        {/* Status Badges (Requirement 2 & 3) */}
        <div>
          {currentRecord.status === '결산잠금' ? (
            <span className="bg-[#f3e8ff] text-[#6b21a8] border border-[#e9d5ff] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs">
              <span className="material-symbols-outlined text-sm text-[#6b21a8]">lock</span>
              결산잠금
            </span>
          ) : currentRecord.status === '완료' ? (
            <span className="bg-[#e6f4ed] text-[#006c49] border border-[#c3e9d5] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#006c49]"></span>
              완료
            </span>
          ) : currentRecord.status === '진행중' ? (
            <span className="bg-[#f0f4fd] text-[#00236f] border border-[#d0e0fc] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#00236f] animate-pulse"></span>
              진행중 ({currentRecord.currentStep}/5)
            </span>
          ) : (
            <span className="bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#c2410c]"></span>
              미시작
            </span>
          )}
        </div>
      </section>

      {/* ================= COMPLETED / LOCKED MONTH VIEW MODE ================= */}
      {currentRecord.status === '결산잠금' || currentRecord.status === '완료' ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Overview Summary Cards */}
          <section className="bg-gradient-to-br from-[#00236f] to-[#1e3a8a] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs text-[#6cf8bb] font-bold tracking-wider uppercase flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  {selectedMonth} 확정 및 결산잠금
                </span>
                <h2 className="font-dohyeon text-2xl">
                  {netCashFlow >= 0 ? '+' : ''}
                  {formatKRW(netCashFlow)}원
                </h2>
                <p className="text-xs text-white/80 mt-0.5">순현금흐름 (총수입 - 총유출)</p>
              </div>

              {/* Requirement 3: 결산 완료일 / 완료시간 표시 */}
              <div className="text-right bg-white/15 px-3 py-1.5 rounded-xl backdrop-blur-xs text-[11px] font-medium border border-white/20">
                <span className="block text-white/70 text-[10px]">결산 완료일시</span>
                <span className="font-bold text-white">
                  {currentRecord.completedAtDate || '2026.07.02'}{' '}
                  {currentRecord.completedAtTime || '21:14'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/15 text-xs">
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-white/70 text-[11px] block">총 수입</span>
                <span className="font-dohyeon text-base text-[#6cf8bb]">
                  +{formatKRW(totalIncome)}원
                </span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-white/70 text-[11px] block">총 현금유출</span>
                <span className="font-dohyeon text-base text-[#ff9999]">
                  -{formatKRW(totalCashOutflow)}원
                </span>
              </div>
            </div>
          </section>

          {/* ② 이번 달 특이사항 Card */}
          <SpecialNotesSection
            selectedMonth={selectedMonth}
            currentRecord={currentRecord}
            onNotesSaved={handleNotesSaved}
          />

          {/* Requirement 3 & 4: 4개 핵심 항목 카드 확장/접힘 UI 및 근거 추적 */}
          <section className="space-y-3 text-xs">
            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. 생활지출 Card */}
              <div
                onClick={() => {
                  setExpandedCard(expandedCard === 'living' ? 'none' : 'living');
                  setSelectedLivingCategory(null);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                  expandedCard === 'living'
                    ? 'bg-[#fff5f5] border-[#ba1a1a] ring-2 ring-[#ba1a1a]/20'
                    : 'bg-white border-[#c5c5d3]/30 hover:border-[#ba1a1a]/50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[#757682] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#ba1a1a]">shopping_bag</span>
                    생활지출
                  </span>
                  <span className="material-symbols-outlined text-sm text-[#757682]">
                    {expandedCard === 'living' ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                <span className="font-dohyeon text-lg text-[#ba1a1a] block">
                  {formatKRW(livingExpense)}원
                </span>
                <span className="text-[10px] text-[#757682] mt-1 block">
                  {consumerTransactions.length}건 소비지출 • 클릭 시 상세 근거
                </span>
              </div>

              {/* 2. 금융비용 (이자) Card */}
              <div
                onClick={() => setExpandedCard(expandedCard === 'financial' ? 'none' : 'financial')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                  expandedCard === 'financial'
                    ? 'bg-[#fffbeb] border-[#d97706] ring-2 ring-[#d97706]/20'
                    : 'bg-white border-[#c5c5d3]/30 hover:border-[#d97706]/50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[#757682] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#d97706]">percent</span>
                    금융비용 (이자)
                  </span>
                  <span className="material-symbols-outlined text-sm text-[#757682]">
                    {expandedCard === 'financial' ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                {hasConfirmedOpeningForMonth ? (
                  <>
                    <span className="font-dohyeon text-lg text-[#d97706] block">
                      {formatKRW(financialCost)}원
                    </span>
                    {isLockedWithSnapshotLookupError ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#ba1a1a] block leading-tight font-semibold">
                          확정 당시 스냅샷 조회 오류로 금융비용이 계산되지 않았습니다
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCurrentRecord((rec) => ({
                              ...rec,
                              financialCost: financialCostResult.totalCost,
                            }));
                          }}
                          className="px-2 py-0.5 bg-[#d97706] text-white font-bold text-[10px] rounded hover:bg-[#b45309] transition-colors cursor-pointer shrink-0"
                        >
                          금융비용 다시 계산
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#757682] mt-1 block">
                        {debtCount}건 부채 이자 추정합계 • 클릭 시 상세 근거
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-dohyeon text-sm text-[#757682] block mt-1">
                      계산 불가 (스냅샷 없음)
                    </span>
                    <span className="text-[10px] text-[#ba1a1a] mt-1 block leading-tight">
                      선택한 월의 확정 자산·부채 스냅샷이 없어 금융비용을 계산할 수 없습니다
                    </span>
                  </>
                )}
              </div>

              {/* 3. 부채상환 원금 Card */}
              <div
                onClick={() => setExpandedCard(expandedCard === 'debt' ? 'none' : 'debt')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                  expandedCard === 'debt'
                    ? 'bg-[#f4f4f6] border-[#00236f] ring-2 ring-[#00236f]/20'
                    : 'bg-white border-[#c5c5d3]/30 hover:border-[#00236f]/50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[#757682] font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#00236f]">account_balance</span>
                    부채상환 원금
                  </span>
                  <span className="material-symbols-outlined text-sm text-[#757682]">
                    {expandedCard === 'debt' ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                <span className="font-dohyeon text-lg text-[#00236f] block">
                  {formatKRW(debtPrincipal)}원
                </span>
                <span className="text-[10px] text-[#757682] mt-1 block">
                  CSV 원금상환 + 예정 원금상환 • 클릭 시 상세 근거
                </span>
              </div>
            </div>

            {/* 4. 저축·투자 Card */}
            <div
              onClick={() => setExpandedCard(expandedCard === 'savings' ? 'none' : 'savings')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex justify-between items-center ${
                expandedCard === 'savings'
                  ? 'bg-[#e8f5e9] border-[#006c49] ring-2 ring-[#006c49]/20'
                  : 'bg-[#f0f4fd] border-[#00236f]/20 hover:border-[#006c49]/50'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="material-symbols-outlined text-base text-[#006c49]">savings</span>
                  <span className="text-[#00236f] font-bold">저축·투자 (자산증가)</span>
                </div>
                <span className="text-[11px] text-[#757682]">
                  {currentRecord.savingsInvestments.length}건 등록 • 클릭 시 상세 목록 보기
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-dohyeon text-lg text-[#006c49]">
                  +{formatKRW(totalSavings)}원
                </span>
                <span className="material-symbols-outlined text-sm text-[#757682]">
                  {expandedCard === 'savings' ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </div>

            {/* ================= Expanded Details Panels ================= */}
            {expandedCard === 'living' && (
              <div className="bg-white p-5 rounded-2xl border border-[#ba1a1a]/30 shadow-md space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#eceef0] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#ba1a1a]">shopping_bag</span>
                    <div>
                      <h4 className="font-dohyeon text-base text-[#191c1e]">생활지출 산출 근거 상세</h4>
                      <p className="text-[11px] text-[#757682]">CSV 소비 트랜잭션 카테고리별 분류 및 내역</p>
                    </div>
                  </div>
                  <span className="font-dohyeon text-base text-[#ba1a1a]">{formatKRW(livingExpense)}원</span>
                </div>

                {/* Category breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {livingCategoryBreakdown.map((cat) => {
                    const isSelected = selectedLivingCategory === cat.name;
                    return (
                      <div
                        key={cat.name}
                        onClick={() => {
                          if (cat.count === 0) return;
                          setSelectedLivingCategory(isSelected ? null : cat.name);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none text-left ${
                          isSelected
                            ? 'bg-[#fff5f5] border-[#ba1a1a] ring-2 ring-[#ba1a1a]/30 shadow-xs'
                            : 'bg-[#f8f9fc] border-[#e1e2ec] hover:border-[#ba1a1a]/40 hover:bg-[#fff9f9]'
                        } ${cat.count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-[11px] text-[#757682] font-semibold truncate block max-w-[85%]">
                            {cat.name}
                          </span>
                          <span className={`material-symbols-outlined text-xs transition-transform ${isSelected ? 'text-[#ba1a1a] rotate-180' : 'text-[#757682]'}`}>
                            expand_more
                          </span>
                        </div>
                        <span className="font-bold text-sm text-[#191c1e] block mt-0.5">
                          {formatKRW(cat.amount)}원
                        </span>
                        <div className="flex justify-between items-center mt-1 text-[10px]">
                          <span className="text-[#006c49] font-medium">{cat.count}건 ({cat.pct}%)</span>
                          {isSelected && (
                            <span className="text-[#ba1a1a] font-bold">선택됨</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Category Detail List or Initial Guidance */}
                {selectedLivingCategory ? (() => {
                  const categoryTxs = consumerTransactions.filter(
                    (t) => (t.category || '기타소비') === selectedLivingCategory
                  );
                  const categoryTotal = categoryTxs.reduce(
                    (s, t) => s + (Number(t.amount) || 0),
                    0
                  );

                  return (
                    <div className="space-y-2 pt-3 border-t border-[#eceef0] animate-in fade-in duration-150">
                      <div className="flex justify-between items-center">
                        <h5 className="font-bold text-xs text-[#191c1e] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#ba1a1a]">sell</span>
                          <span>{selectedLivingCategory} 상세 내역 {categoryTxs.length}건</span>
                        </h5>
                        <div className="flex items-center gap-2">
                          <span className="font-dohyeon text-sm text-[#ba1a1a]">
                            {formatKRW(categoryTotal)}원
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedLivingCategory(null)}
                            className="text-[11px] text-[#757682] hover:text-[#191c1e] underline cursor-pointer"
                          >
                            접기
                          </button>
                        </div>
                      </div>

                      {categoryTxs.length === 0 ? (
                        <p className="text-xs text-[#757682] py-4 text-center bg-[#f8f9fc] rounded-xl border border-[#e1e2ec]">
                          해당 카테고리의 거래 내역이 없습니다
                        </p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                          {categoryTxs.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex justify-between items-center p-2.5 bg-[#f8f9fc] rounded-lg text-xs hover:bg-[#f0f4fd] transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-semibold text-[#191c1e] block truncate">
                                  {tx.merchant || '거래처'}
                                </span>
                                <span className="text-[10px] text-[#757682] block truncate">
                                  {tx.date}{tx.time ? ` • ${tx.time}` : ''}
                                  {tx.subCategory ? ` • ${tx.subCategory}` : ''}
                                  {tx.memo ? ` (${tx.memo})` : ''}
                                </span>
                              </div>
                              <span className="font-bold text-[#ba1a1a] shrink-0">
                                -{formatKRW(Number(tx.amount))}원
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div className="p-3.5 bg-[#f8f9fc] rounded-xl border border-[#e1e2ec] text-center text-xs text-[#757682] font-medium">
                    카테고리를 선택하면 상세 거래 내역을 확인할 수 있습니다
                  </div>
                )}
              </div>
            )}

            {expandedCard === 'financial' && (
              <div className="bg-white p-5 rounded-2xl border border-[#d97706]/30 shadow-md space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#eceef0] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#d97706]">percent</span>
                    <div>
                      <h4 className="font-dohyeon text-base text-[#191c1e]">금융비용(이자) 산출 근거 상세</h4>
                      <p className="text-[11px] text-[#757682]">
                        {hasConfirmedOpeningForMonth
                          ? `출처: ${formatMonthKorean(monthKey)} 확정 스냅샷 잔액 + 기본정보 금리`
                          : '확정 스냅샷 없음'}
                      </p>
                    </div>
                  </div>
                  <span className="font-dohyeon text-base text-[#d97706]">
                    {hasConfirmedOpeningForMonth ? `${formatKRW(financialCost)}원` : '0원'}
                  </span>
                </div>

                {!hasConfirmedOpeningForMonth ? (
                  <div className="bg-[#fff5f5] p-4 rounded-xl border border-[#ffdad6] text-xs text-[#ba1a1a] space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="material-symbols-outlined text-base">warning</span>
                      <span>선택한 월의 확정 자산·부채 스냅샷이 없어 금융비용을 계산할 수 없습니다</span>
                    </div>
                    <p className="text-[11px] text-[#757682]">
                      과거 기본정보 마스터 잔액을 임의로 대입하지 않으며, 해당 월의 Confirmed opening snapshot에 기재된 부채 잔액을 기준으로 이자가 계산됩니다.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpeningSnapshotModalOpen(true);
                      }}
                      className="mt-2 px-3 py-1.5 bg-[#00236f] text-white font-bold text-xs rounded-lg hover:bg-[#1e3a8a] transition-colors cursor-pointer"
                    >
                      {snapshotStatus === 'confirmed'
                        ? `${formatMonthKorean(monthKey)} 시작 스냅샷 보기`
                        : snapshotStatus === 'draft'
                        ? `${formatMonthKorean(monthKey)} 시작 스냅샷 이어쓰기`
                        : `${formatMonthKorean(monthKey)} 시작 스냅샷 작성하기`}
                    </button>
                  </div>
                ) : (
                  <>
                    {isLockedWithSnapshotLookupError && (
                      <div className="bg-[#fff8f1] p-3.5 rounded-xl border border-[#ffddb8] text-xs text-[#824700] space-y-2 mb-3">
                        <div className="flex items-center gap-2 font-bold">
                          <span className="material-symbols-outlined text-base text-[#d97706]">warning</span>
                          <span>확정 당시 스냅샷 조회 오류로 금융비용이 계산되지 않았습니다</span>
                        </div>
                        <p className="text-[11px] text-[#757682]">
                          현재 확정 스냅샷 기준 계산된 금융비용은 <strong>{formatKRW(financialCostResult.totalCost)}원</strong>입니다. 아래 버튼을 클릭하여 확정 결산의 금융비용을 다시 계산하여 반영할 수 있습니다.
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCurrentRecord((rec) => ({
                              ...rec,
                              financialCost: financialCostResult.totalCost,
                            }));
                          }}
                          className="px-3 py-1.5 bg-[#d97706] text-white font-bold text-xs rounded-lg hover:bg-[#b45309] transition-colors cursor-pointer"
                        >
                          금융비용 다시 계산
                        </button>
                      </div>
                    )}

                    {isFinancialCostMismatchWithSnapshot && (
                      <div className="bg-[#fff8f1] p-3 rounded-xl border border-[#ffddb8] text-[11px] text-[#824700] flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">info</span>
                        <span>확정된 결산의 금융비용과 수정된 자산·부채 스냅샷 값이 다를 수 있습니다.</span>
                      </div>
                    )}

                    <div className="bg-[#fffbeb] p-3 rounded-xl border border-[#fef3c7] text-[11px] text-[#b45309] flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span>
                        {formatMonthKorean(monthKey)} 확정 스냅샷의 부채 원금잔액과 기본정보 마스터의 연금리를 조합하여 월 이자를 산출합니다. (공식: 원금 × 연금리 / 12)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {interestBreakdownList.length === 0 ? (
                        <p className="text-xs text-[#757682] py-2">등록된 부채 내역이 없습니다.</p>
                      ) : (
                        interestBreakdownList.map((item) => (
                          <div key={item.id} className="p-3 bg-[#f8f9fc] rounded-xl border border-[#e1e2ec] flex justify-between items-center text-xs">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#191c1e]">{item.name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-[#f0f4fd] text-[#00236f] rounded font-semibold">{item.creditor}</span>
                                {item.isHistorical && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#fef3c7] text-[#92400e] rounded font-bold">과거전용</span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#757682] mt-1 space-y-0.5">
                                <p>
                                  스냅샷 잔액: <strong className="text-[#191c1e]">{formatKRW(item.principal)}원</strong>
                                  {item.hasRate ? ` • 연금리: ${item.rate}%` : ' • 금리 정보 없음'}
                                </p>
                                <p className="text-[10px] text-[#006c49]">출처: {item.sourceTag}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-sm text-[#d97706]">
                                {item.hasRate ? `${formatKRW(item.monthlyInterest)}원` : '0원 (금리 미등록)'}
                              </span>
                              <span className="text-[10px] text-[#757682] block">월 예상 이자</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {expandedCard === 'debt' && (
              <div className="bg-white p-5 rounded-2xl border border-[#00236f]/30 shadow-md space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#eceef0] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#00236f]">account_balance</span>
                    <div>
                      <h4 className="font-dohyeon text-base text-[#191c1e]">부채상환 원금 산출 근거 상세</h4>
                      <p className="text-[11px] text-[#757682]">CSV 확정 상환 내역 + 스냅샷 예정 원금 상환액 합산</p>
                    </div>
                  </div>
                  <span className="font-dohyeon text-base text-[#00236f]">{formatKRW(debtPrincipal)}원</span>
                </div>

                <div className="bg-[#f0f4fd] p-3 rounded-xl border border-[#00236f]/20 text-[11px] text-[#00236f] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span>검증 완료: 계좌간 내부송금, 사업경비, 자산이동 항목은 원금상환에서 엄격히 제외됨</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="font-bold text-xs text-[#444651]">원금상환 세부 구성 목록</h5>
                  {debtPrincipalItems.map((item) => (
                    <div key={item.id} className="p-3 bg-[#f8f9fc] rounded-xl border border-[#e1e2ec] flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#191c1e]">{item.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            item.sourceType === 'csv' ? 'bg-[#e8edff] text-[#00236f]' : 'bg-[#e6f4ea] text-[#006c49]'
                          }`}>
                            {item.sourceLabel}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#757682] block mt-0.5">{item.detail}</span>
                      </div>
                      <span className="font-bold text-sm text-[#00236f]">{formatKRW(item.amount)}원</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expandedCard === 'savings' && (
              <div className="bg-white p-5 rounded-2xl border border-[#006c49]/30 shadow-md space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-[#eceef0] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006c49]">savings</span>
                    <div>
                      <h4 className="font-dohyeon text-base text-[#191c1e]">저축·투자 (자산증가) 상세 목록</h4>
                      <p className="text-[11px] text-[#757682]">등록된 적금, 예금, 주식, ETF 등 순자산 형성 항목</p>
                    </div>
                  </div>
                  <span className="font-dohyeon text-base text-[#006c49]">+{formatKRW(totalSavings)}원</span>
                </div>

                {currentRecord.savingsInvestments.length === 0 ? (
                  <p className="text-xs text-[#757682] py-2">등록된 저축/투자 내역이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {currentRecord.savingsInvestments.map((sav) => (
                      <div key={sav.id} className="p-3 bg-[#f8f9fc] rounded-xl border border-[#e1e2ec] flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#191c1e]">{sav.name}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-[#e6f4ea] text-[#006c49] rounded font-bold">{sav.type}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-[#f2f4f6] text-[#444651] rounded">{sav.tradeType}</span>
                          </div>
                          {sav.memo && <span className="text-[11px] text-[#757682] block mt-0.5">{sav.memo}</span>}
                        </div>
                        <span className="font-bold text-sm text-[#006c49]">+{formatKRW(sav.amount)}원</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* AI Monthly Report Section */}
          <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#eceef0] pb-3">
              <div className="w-8 h-8 rounded-full bg-[#00236f] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">smart_toy</span>
              </div>
              <div>
                <h3 className="font-dohyeon text-base text-[#00236f]">
                  AI 월간 CFO 리포트
                </h3>
                <p className="text-[11px] text-[#757682]">
                  {selectedMonth} 확정 데이터 기준
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#191c1e] leading-relaxed">
              <div className="bg-[#f7f9fb] p-3.5 rounded-xl border border-[#c5c5d3]/20">
                <span className="font-bold text-[#00236f] block mb-1">📊 수입 분석</span>
                <p className="text-[#444651]">
                  이번 달 총 수입은{' '}
                  <span className="font-bold text-[#00236f]">
                    {formatKRW(totalIncome)}원
                  </span>
                  으로 미용실 및 임대사업에서 고르게 발생했습니다.
                </p>
              </div>

              <div className="bg-[#f7f9fb] p-3.5 rounded-xl border border-[#c5c5d3]/20">
                <span className="font-bold text-[#00236f] block mb-1">🏠 지출 및 자산 축적</span>
                <p className="text-[#444651]">
                  생활지출({formatKRW(livingExpense)}원)을 효과적으로 통제하여{' '}
                  <span className="font-bold text-[#006c49]">
                    {formatKRW(totalSavings)}원
                  </span>
                  의 자산을 성공적으로 적립했습니다.
                </p>
              </div>

              {currentRecord.specialNotes && currentRecord.specialNotes.trim() !== '' && (
                <div className="bg-[#f0fdf4] p-3.5 rounded-xl border border-[#bbf7d0]">
                  <span className="font-bold text-[#166534] block mb-1">📝 작성하신 특이사항 반영</span>
                  <p className="text-[#166534]">
                    기록하신 이번 달 특이사항(&quot;{currentRecord.specialNotes.trim()}&quot;)을 고려할 때, 이번 달 자금 흐름의 변동 요인이 명확히 설명됩니다.
                  </p>
                </div>
              )}

              <div className="bg-[#f0f4fd] p-3.5 rounded-xl border border-[#00236f]/20">
                <span className="font-bold text-[#00236f] block mb-1">
                  💡 다음 달 자금운용 핵심 제안
                </span>
                <p className="text-[#00236f]">
                  대출 원금 상환 비중을 유지하고, 예비비를 가계/사업 통장에 분리해 잉여 자금을 체계적으로 관리하세요.
                  {currentRecord.specialNotes && currentRecord.specialNotes.trim() !== ''
                    ? ` (작성하신 특이사항 '${currentRecord.specialNotes.trim()}' 관련 자금 후속 관리도 함께 유의하세요.)`
                    : ''}
                </p>
              </div>
            </div>
          </section>

          {/* Unlock / Re-edit Button */}
          <button
            onClick={handleReeditSettlement}
            className="w-full py-3.5 bg-white border border-[#00236f]/30 text-[#00236f] font-dohyeon text-sm rounded-xl hover:bg-[#f0f4fd] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-lg">lock_open</span>
            결산 잠금 해제 및 재수정하기
          </button>
        </div>
      ) : (
        /* ================= IN-PROGRESS / UNCOMPLETED STEP WORKSPACE ================= */
        <div className="space-y-4">
          {/* ================= STEP PROGRESS ACCORDION (Requirement 11) ================= */}
          <section className="bg-white rounded-2xl border border-[#c5c5d3]/30 shadow-xs overflow-hidden">
            {!isStepsExpanded ? (
              /* Collapsed 1-line Step Header */
              <div
                onClick={() => setIsStepsExpanded(true)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#f0f4fd]/50 transition-all"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-[#00236f] text-white px-2 py-0.5 rounded-md font-bold text-[10px]">
                    진행중
                  </span>
                  <span className="font-dohyeon text-[#00236f] text-sm">
                    {currentRecord.currentStep === 1 && '① 수입 입력 (1/5)'}
                    {currentRecord.currentStep === 2 && '② 저축·투자 입력 (2/5)'}
                    {currentRecord.currentStep === 3 && '③ CSV 업로드 (3/5)'}
                    {currentRecord.currentStep === 4 && '④ 거래 검토 (4/5)'}
                    {currentRecord.currentStep === 5 && '⑤ 결산 확정 (5/5)'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#00236f] font-bold">
                  <span>▼ 펼치기</span>
                </div>
              </div>
            ) : (
              /* Expanded Full Step Progress Card */
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#eceef0] pb-2.5">
                  <h3 className="font-dohyeon text-sm text-[#00236f]">
                    전체 결산 진행 단계
                  </h3>
                  <button
                    onClick={() => setIsStepsExpanded(false)}
                    className="text-xs text-[#00236f] font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    ▲ 접기
                  </button>
                </div>

                {/* Step 1 */}
                <div
                  onClick={() => updateCurrentRecord((r) => ({ ...r, currentStep: 1 }))}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    currentRecord.currentStep === 1
                      ? 'bg-[#f0f4fd] border-[#00236f] shadow-2xs'
                      : 'bg-[#f7f9fb] border-[#c5c5d3]/20 hover:bg-[#f0f4fd]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        currentRecord.currentStep === 1
                          ? 'bg-[#00236f] text-white'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      1
                    </span>
                    <span className="font-bold text-[#191c1e]">수입 입력</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#757682]">
                      {formatKRW(totalIncome)}원
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        currentRecord.currentStep > 1
                          ? 'bg-[#e6f4ed] text-[#006c49]'
                          : 'bg-[#00236f]/10 text-[#00236f]'
                      }`}
                    >
                      {currentRecord.currentStep > 1 ? '완료' : '진행중'}
                    </span>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  onClick={() => updateCurrentRecord((r) => ({ ...r, currentStep: 2 }))}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    currentRecord.currentStep === 2
                      ? 'bg-[#f0f4fd] border-[#00236f] shadow-2xs'
                      : 'bg-[#f7f9fb] border-[#c5c5d3]/20 hover:bg-[#f0f4fd]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        currentRecord.currentStep === 2
                          ? 'bg-[#00236f] text-white'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      2
                    </span>
                    <span className="font-bold text-[#191c1e]">저축·투자 입력</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#757682]">
                      {currentRecord.savingsInvestments.length}건 ({formatKRW(totalSavings)}원)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        currentRecord.currentStep > 2
                          ? 'bg-[#e6f4ed] text-[#006c49]'
                          : currentRecord.currentStep === 2
                          ? 'bg-[#00236f]/10 text-[#00236f]'
                          : 'bg-[#eceef0] text-[#757682]'
                      }`}
                    >
                      {currentRecord.currentStep > 2
                        ? '완료'
                        : currentRecord.currentStep === 2
                        ? '진행중'
                        : '대기'}
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  onClick={() => updateCurrentRecord((r) => ({ ...r, currentStep: 3 }))}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    currentRecord.currentStep === 3
                      ? 'bg-[#f0f4fd] border-[#00236f] shadow-2xs'
                      : 'bg-[#f7f9fb] border-[#c5c5d3]/20 hover:bg-[#f0f4fd]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        currentRecord.currentStep === 3
                          ? 'bg-[#00236f] text-white'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      3
                    </span>
                    <span className="font-bold text-[#191c1e]">CSV 업로드</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#757682]">
                      {currentRecord.csvUploaded ? '업로드 완료' : '미업로드'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        currentRecord.currentStep > 3
                          ? 'bg-[#e6f4ed] text-[#006c49]'
                          : currentRecord.currentStep === 3
                          ? 'bg-[#00236f]/10 text-[#00236f]'
                          : 'bg-[#eceef0] text-[#757682]'
                      }`}
                    >
                      {currentRecord.currentStep > 3
                        ? '완료'
                        : currentRecord.currentStep === 3
                        ? '진행중'
                        : '대기'}
                    </span>
                  </div>
                </div>

                {/* Step 4 */}
                <div
                  onClick={() => updateCurrentRecord((r) => ({ ...r, currentStep: 4 }))}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    currentRecord.currentStep === 4
                      ? 'bg-[#f0f4fd] border-[#00236f] shadow-2xs'
                      : 'bg-[#f7f9fb] border-[#c5c5d3]/20 hover:bg-[#f0f4fd]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        currentRecord.currentStep === 4
                          ? 'bg-[#00236f] text-white'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      4
                    </span>
                    <span className="font-bold text-[#191c1e]">거래 검토</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {needsReviewCount > 0 ? (
                      <span className="text-[10px] bg-[#fff7ed] text-[#c2410c] px-2 py-0.5 rounded-md font-bold">
                        확인필요 {needsReviewCount}건
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#006c49] font-bold">검토완료</span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        currentRecord.currentStep > 4
                          ? 'bg-[#e6f4ed] text-[#006c49]'
                          : currentRecord.currentStep === 4
                          ? 'bg-[#00236f]/10 text-[#00236f]'
                          : 'bg-[#eceef0] text-[#757682]'
                      }`}
                    >
                      {currentRecord.currentStep > 4
                        ? '완료'
                        : currentRecord.currentStep === 4
                        ? '진행중'
                        : '대기'}
                    </span>
                  </div>
                </div>

                {/* Step 5 */}
                <div
                  onClick={() => updateCurrentRecord((r) => ({ ...r, currentStep: 5 }))}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    currentRecord.currentStep === 5
                      ? 'bg-[#f0f4fd] border-[#00236f] shadow-2xs'
                      : 'bg-[#f7f9fb] border-[#c5c5d3]/20 hover:bg-[#f0f4fd]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                        currentRecord.currentStep === 5
                          ? 'bg-[#00236f] text-white'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      5
                    </span>
                    <span className="font-bold text-[#191c1e]">결산 확정</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      currentRecord.currentStep === 5
                        ? 'bg-[#00236f]/10 text-[#00236f]'
                        : 'bg-[#eceef0] text-[#757682]'
                    }`}
                  >
                    {currentRecord.currentStep === 5 ? '진행중' : '대기'}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* ================= STEP 1: 수입 입력 BODY ================= */}
          {currentRecord.currentStep === 1 && (
            <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-4 animate-fadeIn">
              <div>
                <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md mb-2 inline-block">
                  Step 1 / 수입 입력
                </span>
                <h3 className="font-dohyeon text-lg text-[#00236f]">
                  {selectedMonth} 실제 수입 입력
                </h3>
                <p className="text-xs text-[#757682] mt-1">
                  기본정보관리에 등록된 수입원의 이번 달 실제 발생 수입 금액을 입력해주세요.
                </p>
              </div>

              {/* Income Sources List from Basic Info */}
              {activeIncomeSources.length === 0 ? (
                <div className="p-6 bg-[#f7f9fb] border border-dashed border-[#c5c5d3] rounded-xl text-center text-xs text-[#757682]">
                  <p className="font-bold">등록된 활성 수입원이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0] mt-1">
                    '기본정보관리 &gt; 수입원' 메뉴에서 수입원을 추가해주세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeIncomeSources.map((src) => {
                    const prevActual = getPrevMonthActualIncome(src.id);
                    const isFixed = src.incomeMode === 'fixed';
                    const rawVal = step1Inputs[src.id] ?? '';
                    const isUnentered = rawVal.trim() === '';
                    const isZero = rawVal.trim() === '0';

                    return (
                      <div
                        key={src.id}
                        className="p-3.5 bg-[#f7f9fb] rounded-xl border border-[#c5c5d3]/20 text-xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#191c1e] text-sm">
                              {src.incomeName || src.name}
                            </span>
                            <span className="text-[10px] bg-[#e6e8ea] text-[#444651] px-1.5 py-0.5 rounded font-medium">
                              {src.incomeType || '사업소득'}
                            </span>

                            {/* Income Mode Badge */}
                            {isFixed ? (
                              <span className="text-[10px] bg-[#e6f4ed] text-[#006c49] border border-[#c3e9d5] px-1.5 py-0.5 rounded font-bold">
                                고정수입
                              </span>
                            ) : (
                              <span className="text-[10px] bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5] px-1.5 py-0.5 rounded font-bold">
                                변동수입
                              </span>
                            )}

                            {src.owner && (
                              <span className="text-[10px] text-[#757682]">
                                ({src.owner})
                              </span>
                            )}
                          </div>

                          {/* Previous month reference & quick apply button */}
                          <div className="flex items-center gap-1.5">
                            {prevActual !== null ? (
                              <>
                                <span className="text-[11px] text-[#757682]">
                                  지난달:{' '}
                                  <span className="font-semibold text-[#555660]">
                                    {formatKRW(prevActual)}원
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleApplyPrevIncomeForSource(src.id)}
                                  className="text-[10px] bg-white border border-[#00236f]/30 text-[#00236f] px-2 py-0.5 rounded hover:bg-[#f0f4fd] transition-colors cursor-pointer font-medium active:scale-95"
                                  title="지난달과 동일 금액 적용"
                                >
                                  동일 적용
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-[#9090a0]">
                                지난달 기록 없음
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Input Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#eceef0]">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-[#444651]">
                              이번 달 수입:
                            </span>
                            {isUnentered ? (
                              <span className="text-[10px] bg-[#f0f0f0] text-[#757682] px-1.5 py-0.5 rounded">
                                미입력
                              </span>
                            ) : isZero ? (
                              <span className="text-[10px] bg-[#e6f4ed] text-[#006c49] px-1.5 py-0.5 rounded font-bold">
                                0원 입력 완료
                              </span>
                            ) : (
                              <span className="text-[10px] bg-[#f0f4fd] text-[#00236f] px-1.5 py-0.5 rounded font-bold">
                                입력 완료
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={rawVal}
                              onChange={(e) => handleStep1InputChange(src.id, e.target.value)}
                              placeholder={isFixed ? (src.fixedMonthlyIncome ? src.fixedMonthlyIncome.toLocaleString() : '0') : '0'}
                              className="w-36 px-3 py-1.5 bg-white rounded-lg border border-[#c5c5d3]/40 text-right font-dohyeon text-sm text-[#00236f] focus:outline-none focus:border-[#00236f]"
                            />
                            <span className="font-bold text-[#191c1e]">원</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Income Summary */}
              <div className="bg-[#f0f4fd] p-4 rounded-xl border border-[#00236f]/20 flex justify-between items-center">
                <div>
                  <span className="font-dohyeon text-sm text-[#00236f] block">
                    {selectedMonth} 총 수입 합계
                  </span>
                  <span className="text-[10px] text-[#757682]">
                    (입력된 활성 수입원 합산)
                  </span>
                </div>
                <span className="font-dohyeon text-xl text-[#006c49]">
                  +{formatKRW(calculatedStep1Total)}원
                </span>
              </div>

              <button
                type="button"
                onClick={handleStep1Complete}
                className="w-full py-3.5 bg-[#00236f] text-white font-dohyeon text-sm rounded-xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                다음 단계 (저축·투자 입력)
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </section>
          )}

          {/* ================= STEP 2: 저축·투자 입력 BODY (Requirement 8) ================= */}
          {currentRecord.currentStep === 2 && (
            <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-4 animate-fadeIn">
              <div>
                <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md mb-2 inline-block">
                  Step 2 / 저축·투자 입력 (선택)
                </span>
                <h3 className="font-dohyeon text-lg text-[#00236f]">
                  {selectedMonth} 저축 및 투자 입력
                </h3>
                <p className="text-xs text-[#757682] mt-1">
                  저축·투자는 소비지출과 구분되어 자산증가 항목으로 계산됩니다.
                </p>
              </div>

              {currentRecord.savingsInvestments.length === 0 ? (
                <div className="p-6 bg-[#f7f9fb] border border-dashed border-[#c5c5d3] rounded-xl text-center text-xs text-[#757682] space-y-2">
                  <p>등록된 저축·투자 내역이 없습니다.</p>
                  <p className="text-[11px] text-[#9090a0]">
                    적금, 주식, 연금 등 이번 달 실행된 저축/투자를 등록하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentRecord.savingsInvestments.map((sav) => (
                    <div
                      key={sav.id}
                      className="p-3 bg-[#f7f9fb] rounded-xl border border-[#c5c5d3]/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="bg-[#00236f]/10 text-[#00236f] text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {sav.type}
                          </span>
                          <span className="bg-[#e6f4ed] text-[#006c49] text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {sav.tradeType || '단순저축'}
                          </span>
                          <span className="font-bold text-[#191c1e]">{sav.name}</span>
                        </div>
                        {sav.memo && (
                          <span className="text-[11px] text-[#757682] block mt-0.5">
                            {sav.memo}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-dohyeon text-sm text-[#006c49]">
                          +{formatKRW(sav.amount)}원
                        </span>
                        <button
                          onClick={() => handleDeleteSavings(sav.id)}
                          className="text-[#ba1a1a] p-1 hover:bg-[#ffdad6] rounded-md transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setIsAddingSavingsModal(true)}
                  className="w-full py-3 bg-white border border-[#00236f]/30 text-[#00236f] font-dohyeon text-xs rounded-xl hover:bg-[#f0f4fd] transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  + 저축·투자 추가하기
                </button>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={handleStep2Complete}
                    className="py-3 bg-[#f7f9fb] border border-[#c5c5d3]/40 text-[#444651] font-dohyeon text-xs rounded-xl hover:bg-[#eceef0] transition-all cursor-pointer"
                  >
                    이번 달 저축 없음
                  </button>

                  <button
                    onClick={handleStep2Complete}
                    className="py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-xs hover:bg-[#1e3a8a] transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    다음 (CSV 업로드)
                    <span className="material-symbols-outlined text-sm">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Add Savings Modal (Requirement 8 - Category & Trade Type) */}
          {isAddingSavingsModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-dohyeon text-base text-[#00236f]">
                    저축·투자 내역 추가
                  </h4>
                  <button onClick={() => setIsAddingSavingsModal(false)}>
                    <span className="material-symbols-outlined text-xl text-[#757682]">
                      close
                    </span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-[#444651] block mb-1">
                      항목명 *
                    </label>
                    <input
                      type="text"
                      value={savingsForm.name}
                      onChange={(e) =>
                        setSavingsForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="예: 청년희망적금, 삼성전자 주식"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#00236f]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-[#444651] block mb-1">
                        자산 종류 *
                      </label>
                      <select
                        value={savingsForm.type}
                        onChange={(e) =>
                          setSavingsForm((p) => ({
                            ...p,
                            type: e.target.value as any,
                          }))
                        }
                        className="w-full px-2.5 py-2 border rounded-lg focus:outline-none focus:border-[#00236f]"
                      >
                        <option value="적금">적금</option>
                        <option value="예금">예금</option>
                        <option value="주식">주식</option>
                        <option value="ETF">ETF</option>
                        <option value="연금">연금</option>
                        <option value="코인">코인</option>
                        <option value="기타">기타</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-[#444651] block mb-1">
                        거래 종류 *
                      </label>
                      <select
                        value={savingsForm.tradeType}
                        onChange={(e) =>
                          setSavingsForm((p) => ({
                            ...p,
                            tradeType: e.target.value as any,
                          }))
                        }
                        className="w-full px-2.5 py-2 border rounded-lg focus:outline-none focus:border-[#00236f]"
                      >
                        <option value="단순저축">단순저축</option>
                        <option value="매수">매수</option>
                        <option value="매도">매도</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-[#444651] block mb-1">
                      금액 (원) *
                    </label>
                    <input
                      type="text"
                      value={savingsForm.amount}
                      onChange={(e) =>
                        setSavingsForm((p) => ({
                          ...p,
                          amount: e.target.value,
                        }))
                      }
                      placeholder="예: 500,000"
                      className="w-full px-3 py-2 border rounded-lg font-bold text-[#006c49] focus:outline-none focus:border-[#00236f]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#444651] block mb-1">
                      메모 (선택)
                    </label>
                    <input
                      type="text"
                      value={savingsForm.memo}
                      onChange={(e) =>
                        setSavingsForm((p) => ({ ...p, memo: e.target.value }))
                      }
                      placeholder="자동이체 여부 등"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#00236f]"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddSavings}
                  className="w-full py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-xs hover:bg-[#1e3a8a] transition-all cursor-pointer"
                >
                  저축·투자 저장하기
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: CSV 업로드 BODY (Requirement 4) ================= */}
          {currentRecord.currentStep === 3 && (
            <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-4 animate-fadeIn">
              <div>
                <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md mb-2 inline-block">
                  Step 3 / 거래내역 불러오기
                </span>
                <h3 className="font-dohyeon text-lg text-[#00236f]">
                  {selectedMonth} 거래내역 불러오기
                </h3>
                <p className="text-xs text-[#757682] mt-1 mb-3">
                  카드사/은행에서 다운로드한 CSV 파일이나 내역을 불러오면 AI가 자동 분류합니다.
                </p>
                {/* Active Session Info Banner & Action Buttons */}
                <ActiveSessionBanner
                  onStartNewAnalysis={handleResetCSVUpload}
                  onConfirmSettlement={handleConfirmSettlement}
                />
              </div>

              {/* Requirement 4: CSV 업로드 3가지 상태 (업로드 전, 업로드 중, 업로드 완료, 오류 처리) */}
              {csvUploadState === 'uploading' ? (
                /* State 2: 업로드 중 */
                <div className="p-7 bg-[#f0f4fd] border border-[#00236f]/20 rounded-2xl text-center space-y-4 animate-fadeIn">
                  <div className="w-14 h-14 rounded-2xl bg-[#00236f] text-[#6cf8bb] flex items-center justify-center mx-auto shadow-md animate-pulse">
                    <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-dohyeon text-base text-[#00236f]">
                      {uploadStatusText}
                    </h4>
                    <p className="text-xs text-[#757682]">
                      AI가 거래 내역을 읽고 카테고리를 자동 분류하고 있습니다...
                    </p>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="max-w-xs mx-auto space-y-1">
                    <div className="w-full h-3 bg-[#c5c5d3]/30 rounded-full overflow-hidden p-0.5 border border-[#00236f]/10">
                      <div
                        className="h-full bg-gradient-to-r from-[#00236f] to-[#006c49] rounded-full transition-all duration-500"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#757682] font-semibold px-0.5">
                      <span>진행률</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>

                  {/* Step Indicators */}
                  <div className="flex justify-center items-center gap-2 pt-2 text-[11px]">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        uploadProgress >= 20
                          ? 'bg-[#00236f] text-white shadow-2xs'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      1. 업로드
                    </span>
                    <span className="text-[#c5c5d3]">→</span>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        uploadProgress >= 55
                          ? 'bg-[#00236f] text-white shadow-2xs'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      2. 내역 읽기
                    </span>
                    <span className="text-[#c5c5d3]">→</span>
                    <span
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                        uploadProgress >= 85
                          ? 'bg-[#00236f] text-white shadow-2xs'
                          : 'bg-[#e6e8ea] text-[#757682]'
                      }`}
                    >
                      3. AI 자동분류
                    </span>
                  </div>
                </div>
              ) : csvUploadState === 'error' ? (
                /* Error State */
                <div className="p-6 bg-[#fff8f7] border-2 border-[#ba1a1a]/30 rounded-2xl text-center space-y-4 animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center mx-auto">
                    <span className="material-symbols-outlined text-2xl">error_outline</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-dohyeon text-base text-[#ba1a1a]">
                      CSV 업로드 실패
                    </h4>
                    <p className="text-xs text-[#444651] max-w-xs mx-auto leading-relaxed">
                      {csvErrorMsg ||
                        '지원하지 않는 CSV 형식입니다. 파일을 읽을 수 없습니다. 다시 선택해주세요.'}
                    </p>
                  </div>

                  <div className="pt-1 max-w-xs mx-auto">
                    <button
                      onClick={() => {
                        setCsvUploadState('idle');
                        setCsvErrorMsg(null);
                      }}
                      className="w-full py-3 bg-[#ba1a1a] text-white font-dohyeon text-xs rounded-xl hover:bg-[#93000a] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">refresh</span>
                      다시 업로드
                    </button>
                  </div>
                </div>
              ) : csvUploadState === 'completed' || currentRecord.csvUploaded ? (
                /* State 3: 업로드 완료 */
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-[#f0f4fd] p-5 rounded-2xl border border-[#00236f]/20 space-y-4 shadow-2xs">
                    {/* Header with filename */}
                    <div className="flex justify-between items-center border-b border-[#00236f]/15 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#00236f] text-white flex items-center justify-center">
                          <span className="material-symbols-outlined text-lg">description</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#757682] block font-medium">
                            업로드 파일명
                          </span>
                          <span className="font-dohyeon text-sm text-[#00236f]">
                            {currentRecord.csvFileName ||
                              `${selectedMonth.replace('2026년 ', '')}_카드내역.csv`}
                          </span>
                        </div>
                      </div>
                      <span className="bg-[#006c49] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        {currentRecord.isSampleData ? '샘플 데이터 불러오기 완료' : 'CSV 파싱 완료'}
                      </span>
                    </div>

                    {/* Stats 5-grid for CSV Import Validation (Requirement 8) */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                      <div className="bg-white p-3 rounded-xl border border-[#c5c5d3]/20 shadow-2xs">
                        <span className="text-[10px] text-[#757682] block font-medium">총 거래</span>
                        <span className="font-dohyeon text-base text-[#191c1e] mt-0.5 block">
                          {currentRecord.csvTotalCount ?? currentRecord.transactions.length}건
                        </span>
                      </div>

                      <div className="bg-[#e0f2fe] p-3 rounded-xl border border-[#bae6fd]">
                        <span className="text-[10px] text-[#0369a1] block font-medium">날짜 인식</span>
                        <span className="font-dohyeon text-base text-[#0369a1] mt-0.5 block">
                          {currentRecord.csvValidDateCount ?? currentRecord.transactions.length}건
                        </span>
                      </div>

                      <div className="bg-[#e6f4ed] p-3 rounded-xl border border-[#c3e9d5]">
                        <span className="text-[10px] text-[#006c49] block font-medium">거래처 인식</span>
                        <span className="font-dohyeon text-base text-[#006c49] mt-0.5 block">
                          {currentRecord.csvValidMerchantCount ?? currentRecord.transactions.length}건
                        </span>
                      </div>

                      <div className="bg-[#f0f4fd] p-3 rounded-xl border border-[#c5c5d3]/40">
                        <span className="text-[10px] text-[#00236f] block font-medium">금액 인식</span>
                        <span className="font-dohyeon text-base text-[#00236f] mt-0.5 block">
                          {currentRecord.csvValidAmountCount ?? currentRecord.transactions.length}건
                        </span>
                      </div>

                      <div className="bg-[#fef2f2] p-3 rounded-xl border border-[#fecaca]">
                        <span className="text-[10px] text-[#991b1b] block font-medium">파싱 오류</span>
                        <span className="font-dohyeon text-base text-[#991b1b] mt-0.5 block">
                          {currentRecord.csvErrorCount ?? 0}건
                        </span>
                      </div>
                    </div>

                    {/* Import Validation Summary Message */}
                    <div className="bg-white p-4 rounded-xl border border-[#00236f]/15 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-[#006c49] font-bold">
                        <span className="material-symbols-outlined text-base">task_alt</span>
                        <span>
                          CSV 파싱 검증이 정상 완료되었습니다! (AI 자동분류 대기 중)
                        </span>
                      </div>
                      <p className="text-[#444651] pl-5 leading-relaxed">
                        업로드된 파일에서 총{' '}
                        <span className="font-bold text-[#191c1e]">
                          {currentRecord.csvTotalCount ?? currentRecord.transactions.length}건
                        </span>
                        의 거래 내역을 정확히 읽었습니다. 아래 미리보기에서 파싱된 거래를 확인하세요.
                      </p>
                    </div>

                    {/* Requirement 4: Real Transaction Preview List */}
                    <div className="bg-white p-4 rounded-xl border border-[#c5c5d3]/30 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-dohyeon text-sm text-[#00236f] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">preview</span>
                          파싱 거래 내역 미리보기 ({currentRecord.transactions.length}건)
                        </h4>
                        <span className="text-[10px] text-[#757682]">내 거래가 제대로 읽혔는지 확인해보세요</span>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {currentRecord.transactions.map((tx, idx) => (
                          <div
                            key={tx.id || idx}
                            className="p-3 bg-[#f7f9fb] rounded-xl border border-[#c5c5d3]/20 flex justify-between items-center text-xs hover:border-[#00236f]/30 transition-all"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#00236f] bg-[#e0f2fe] px-1.5 py-0.5 rounded">
                                  {tx.date || '날짜 미지정'}
                                </span>
                                <span className="font-bold text-[#191c1e] text-sm">{tx.merchant}</span>
                              </div>
                              {tx.balance && (
                                <span className="text-[10px] text-[#757682] block">
                                  잔액: {tx.balance.toLocaleString()}원
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-dohyeon text-base text-[#00236f]">
                                {tx.amount.toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() =>
                        updateCurrentRecord((r) => ({ ...r, currentStep: 4 }))
                      }
                      className="w-full py-3.5 bg-[#00236f] text-white font-dohyeon text-sm rounded-xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      거래 검토 단계로 이동하기 (확인 필요 {currentRecord.csvReviewCount ?? currentRecord.transactions.length}건)
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>

                    <button
                      onClick={handleResetCSVUpload}
                      className="w-full py-2.5 bg-white border border-[#c5c5d3]/50 text-[#757682] hover:text-[#00236f] hover:bg-[#f0f4fd] font-dohyeon text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">refresh</span>
                      다른 CSV 파일로 재업로드
                    </button>
                  </div>
                </div>
              ) : (
                /* State 1: 업로드 전 상태 */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-6 bg-[#f7f9fb] border-2 border-dashed rounded-2xl text-center space-y-4 transition-all cursor-pointer ${
                    isDragging
                      ? 'border-[#00236f] bg-[#f0f4fd] shadow-md scale-[1.01]'
                      : 'border-[#00236f]/30 hover:border-[#00236f] hover:bg-[#f0f4fd]/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleCSVUpload}
                    accept=".csv,.txt,.xls,.xlsx"
                    className="hidden"
                  />

                  <div className="w-14 h-14 rounded-2xl bg-[#00236f] text-[#6cf8bb] flex items-center justify-center mx-auto shadow-sm">
                    <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-dohyeon text-base text-[#00236f]">
                      ☁️ CSV 파일 업로드
                    </h4>
                    <p className="text-xs text-[#444651] max-w-sm mx-auto leading-relaxed">
                      카드사 또는 은행에서 다운로드한 CSV 파일을 선택하거나 드래그하여 업로드하세요.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-col items-center gap-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="w-full py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">file_open</span>
                      CSV 파일 선택
                    </button>
                    <span className="text-[11px] text-[#757682]">
                      또는 파일을 여기에 드래그하세요
                    </span>
                  </div>

                  {/* Supported Financial Institutions */}
                  <div
                    className="pt-3 border-t border-[#c5c5d3]/20 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] font-bold text-[#757682] block">지원</span>
                    <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
                      {[
                        '신한',
                        'KB국민',
                        '현대',
                        '삼성',
                        '우리',
                        '농협',
                        '하나',
                        '카카오뱅크',
                        '토스뱅크',
                      ].map((bank) => (
                        <span
                          key={bank}
                          className="bg-white border border-[#c5c5d3]/40 text-[#00236f] text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs"
                        >
                          {bank}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quick sample loading button */}
                  <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={handleLoadSampleCSV}
                      className="text-xs text-[#00236f] font-bold hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">play_circle</span>
                      {selectedMonth} 샘플 데이터로 체험하기
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ================= STEP 4: 거래 검토 BODY (Requirements 5 & 6) ================= */}
          {currentRecord.currentStep === 4 && (() => {
            const totalTxCount = currentRecord.transactions.length;
            const merchantRuleCount = currentRecord.transactions.filter((t) => {
              const rType = t.classification?.appliedRuleType;
              return rType === 'exact-merchant' || rType === 'alias' || rType === 'exclusion';
            }).length;

            const keywordRuleCount = currentRecord.transactions.filter((t) => {
              const rType = t.classification?.appliedRuleType;
              return rType === 'keyword' || rType === 'category';
            }).length;

            const industryRuleCount = currentRecord.transactions.filter((t) => {
              const rType = t.classification?.appliedRuleType;
              return rType === 'industry';
            }).length;

            const patternRuleCount = currentRecord.transactions.filter((t) => {
              const rType = t.classification?.appliedRuleType;
              return rType === 'pattern';
            }).length;

            const userConfirmedCount = currentRecord.transactions.filter((t) => {
              return t.classification?.appliedRuleType === 'user-confirmed' || t.userConfirmed;
            }).length;

            const aiRecommendCount = currentRecord.transactions.filter((t) => {
              return t.classification?.appliedRuleType === 'ai-recommend' && !t.needsReview;
            }).length;

            const needsConfirmationCount = currentRecord.transactions.filter((t) => {
              return t.needsReview || t.classification?.needsConfirmation || t.classification?.appliedRuleType === 'none';
            }).length;

            const autoApprovedCount = Math.max(0, totalTxCount - needsConfirmationCount);
            const finalAutoRate = totalTxCount > 0 ? ((autoApprovedCount / totalTxCount) * 100).toFixed(1) : '0.0';

            return (
              <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md mb-2 inline-block">
                      Step 4 / 거래 검토
                    </span>
                    <h3 className="font-dohyeon text-lg text-[#00236f]">
                      {selectedMonth} 거래 검토 및 AI 분류 점검
                    </h3>
                    <p className="text-xs text-[#757682] mt-1">
                      업종 기반 자동분류 엔진이 거래 내역을 분석하고 자동 승인했습니다.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleApproveAllTx}
                      className="text-xs text-[#006c49] font-bold bg-[#e6f4ed] px-2.5 py-2 rounded-xl border border-[#c3e9d5] hover:bg-[#d2efe0] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      모두 승인하기
                    </button>
                    <button
                      type="button"
                      disabled={isCompleting || currentRecord.status === '결산잠금'}
                      onClick={handleConfirmSettlement}
                      className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-base">
                        {isCompleting ? 'sync' : 'verified'}
                      </span>
                      {isCompleting ? '확정 중...' : '결산 확정'}
                    </button>
                  </div>
                </div>

                {/* 업종 기반 자동분류 엔진 현황 보고서 카드 */}
                <div className="bg-[#f0f4fd] p-4 rounded-2xl border border-[#00236f]/20 space-y-3">
                  <div className="flex justify-between items-center border-b border-[#00236f]/15 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-[#00236f]">
                        auto_awesome
                      </span>
                      <span className="font-dohyeon text-sm text-[#00236f]">
                        업종 기반 자동분류 엔진 실행 결과
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#00236f] text-white px-2.5 py-1 rounded-full text-xs font-bold">
                      <span>자동 승인율</span>
                      <span className="font-dohyeon text-sm text-[#6cf8bb]">{finalAutoRate}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-[#c5c5d3]/30">
                      <span className="text-[10px] text-[#757682] block font-medium">1. Merchant Rule</span>
                      <span className="font-dohyeon text-sm text-[#00236f] mt-0.5 block">
                        {merchantRuleCount}건 승인
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-[#c5c5d3]/30">
                      <span className="text-[10px] text-[#757682] block font-medium">2. Keyword Rule</span>
                      <span className="font-dohyeon text-sm text-[#00236f] mt-0.5 block">
                        {keywordRuleCount}건 승인
                      </span>
                    </div>

                    <div className="bg-[#e6f4ed] p-2.5 rounded-xl border border-[#c3e9d5]">
                      <span className="text-[10px] text-[#006c49] block font-bold">3. 업종 Rule</span>
                      <span className="font-dohyeon text-sm text-[#006c49] mt-0.5 block">
                        {industryRuleCount}건 승인
                      </span>
                    </div>

                    <div className="bg-[#e0f2fe] p-2.5 rounded-xl border border-[#bae6fd]">
                      <span className="text-[10px] text-[#0369a1] block font-bold">4. 패턴 Rule</span>
                      <span className="font-dohyeon text-sm text-[#0369a1] mt-0.5 block">
                        {patternRuleCount}건 승인
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 text-[#444651] border-t border-[#00236f]/10">
                    <div>
                      <span>전체 거래: <strong>{totalTxCount}건</strong> | </span>
                      <span>자동 승인: <strong className="text-[#006c49]">{autoApprovedCount}건</strong></span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#c2410c] font-bold">확인 필요: {needsConfirmationCount}건</span>
                    </div>
                  </div>
                </div>


              {/* Requirement 6 & 9: 확인 필요 / 소비 / 제외 필터 탭 */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    onClick={() => setReviewFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                      reviewFilter === 'all'
                        ? 'bg-[#00236f] text-white shadow-2xs'
                        : 'bg-[#f7f9fb] text-[#757682] hover:bg-[#eceef0]'
                    }`}
                  >
                    전체 ({currentRecord.transactions.length}건)
                  </button>

                  <button
                    onClick={() => setReviewFilter('needsReview')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                      reviewFilter === 'needsReview'
                        ? 'bg-[#c2410c] text-white shadow-2xs'
                        : 'bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5] hover:bg-[#ffedd5]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">warning</span>
                    확인 필요 ({needsReviewCount}건)
                  </button>

                  <button
                    onClick={() => {
                      setReviewFilter('consumer');
                      setConsumerSubFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                      reviewFilter === 'consumer'
                        ? 'bg-[#00236f] text-white shadow-2xs'
                        : 'bg-[#f0f4fd] text-[#00236f] hover:bg-[#e0ecfe]'
                    }`}
                  >
                    🛍️ 소비 ({consumerCount}건)
                  </button>

                  <button
                    onClick={() => setReviewFilter('excluded')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                      reviewFilter === 'excluded'
                        ? 'bg-[#991b1b] text-white shadow-2xs'
                        : 'bg-[#fef2f2] text-[#991b1b] hover:bg-[#fee2e2]'
                    }`}
                  >
                    🚫 제외 ({excludedCount}건)
                  </button>
                </div>

                {/* Sub-filter for Consumer Major Categories */}
                {reviewFilter === 'consumer' && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] pt-1 border-t border-[#c5c5d3]/20">
                    <button
                      onClick={() => setConsumerSubFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer ${
                        consumerSubFilter === 'all'
                          ? 'bg-[#00236f] text-white'
                          : 'bg-[#f0f4fd] text-[#00236f] hover:bg-[#e0ecfe]'
                      }`}
                    >
                      전체 소비
                    </button>
                    {Object.keys(CONSUMER_CATEGORIES).map((major) => (
                      <button
                        key={major}
                        onClick={() => setConsumerSubFilter(major)}
                        className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer ${
                          consumerSubFilter === major
                            ? 'bg-[#00236f] text-white'
                            : 'bg-[#f7f9fb] text-[#444651] border border-[#c5c5d3]/40 hover:bg-[#eceef0]'
                        }`}
                      >
                        {major}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 거래 검색창 영역 */}
              <div className="pt-2 border-t border-[#c5c5d3]/20 space-y-2">
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="relative flex items-center w-full"
                >
                  <span className="material-symbols-outlined absolute left-3 text-[#757682] text-lg pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="거래처, 메모, 분류, 금액 검색"
                    className="w-full pl-9 pr-9 py-2.5 bg-[#f7f9fb] border border-[#c5c5d3]/50 rounded-xl text-xs text-[#191c1e] placeholder-[#757682] focus:outline-hidden focus:border-[#00236f] focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 p-1 text-[#757682] hover:text-[#191c1e] rounded-full transition-colors cursor-pointer flex items-center justify-center"
                      title="검색어 초기화"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </form>

                <div className="flex items-center justify-between text-[11px] text-[#757682] px-1 font-medium">
                  <div>
                    {searchQuery.trim() ? (
                      <span>
                        검색 결과 <strong className="text-[#00236f] font-bold">{filteredTransactions.length}건</strong> / 전체 {currentRecord.transactions.length}건
                      </span>
                    ) : (
                      <span>
                        표시 중 <strong className="text-[#00236f] font-bold">{filteredTransactions.length}건</strong> / 전체 {currentRecord.transactions.length}건
                      </span>
                    )}
                  </div>
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[#00236f] hover:underline font-semibold cursor-pointer text-[11px]"
                    >
                      검색 초기화
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-2.5">
                {filteredTransactions.length === 0 ? (
                  searchQuery.trim() ? (
                    <div className="p-8 text-center text-xs text-[#757682] bg-[#f7f9fb] rounded-xl border border-dashed border-[#c5c5d3] space-y-2">
                      <span className="material-symbols-outlined text-2xl text-[#757682] block">
                        search_off
                      </span>
                      <p className="font-bold text-[#191c1e]">검색 조건에 맞는 거래가 없습니다</p>
                      <p className="text-[11px] text-[#757682]">
                        검색어나 필터를 변경하거나 검색을 초기화해 보세요.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-2 px-3 py-1.5 bg-white border border-[#c5c5d3] text-[#00236f] font-bold text-xs rounded-lg hover:bg-[#f0f4fd] transition-colors cursor-pointer"
                      >
                        검색어 초기화
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#757682] bg-[#f7f9fb] rounded-xl border border-dashed border-[#c5c5d3]">
                      해당 필터에 해당하는 거래 내역이 없습니다.
                    </div>
                  )
                ) : (
                  filteredTransactions.map((tx) => {
                    const cls = tx.classification;
                    const primaryMerchant = tx.merchant;
                    const txType = tx.transactionType;
                    const memo = tx.transferMemo;

                    const isPending = tx.classificationStatus === 'pending' || (!cls && tx.category === '미분류' && !tx.userConfirmed);
                    const isUserConfirmed = tx.userConfirmed || tx.classificationStatus === 'user_confirmed';
                    const isNeedsReview = !isUserConfirmed && (tx.needsReview || cls?.needsConfirmation || tx.classificationStatus === 'needs_confirmation');

                    const isConsumer = cls ? cls.classificationType === 'consumer' : tx.type === 'living';
                    const isExcluded = cls ? cls.classificationType === 'excluded' : (tx.type === 'business' || tx.type === 'financial' || tx.type === 'debt');

                    const majorCat = cls?.majorCategory;
                    const minorCat = cls?.minorCategory;
                    const exclusionReason = cls?.exclusionReason;
                    const exclusionType = cls?.exclusionType || (exclusionReason ? getExclusionReasonLabel(exclusionReason) : '제외');
                    const userQuestion = cls?.userQuestion;

                    return (
                      <div
                        key={tx.id}
                        className={`p-3.5 rounded-xl border text-xs transition-all space-y-2 ${
                          isNeedsReview
                            ? 'bg-[#fffcf8] border-[#ffedd5] shadow-2xs'
                            : isPending
                            ? 'bg-[#fcfdfd] border-[#c5c5d3]/30'
                            : 'bg-[#f7f9fb] border-[#c5c5d3]/20'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            {/* 대표 거래처명 & 적요 보조정보 & 송금메모 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[#191c1e] text-sm">
                                {primaryMerchant}
                              </span>

                              {txType && txType !== primaryMerchant && (
                                <span className="text-[10px] text-[#00236f] bg-[#e0f2fe] px-1.5 py-0.5 rounded font-medium border border-[#bae6fd]">
                                  보조정보: {txType}
                                </span>
                              )}

                              {memo && memo !== primaryMerchant && (
                                <span className="text-[10px] text-[#475569] bg-[#f1f5f9] px-1.5 py-0.5 rounded font-normal">
                                  메모: {memo}
                                </span>
                              )}

                              <span className="text-[10px] text-[#757682]">{tx.date}</span>
                            </div>

                            {/* 배지 정보 모음 */}
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {/* 1차 분류 배지 & 카테고리/사유 표시 */}
                              {isPending ? (
                                <span className="text-[10px] bg-[#fef3c7] text-[#92400e] px-1.5 py-0.5 rounded font-bold border border-[#fde68a]">
                                  ⏳ 분류 대기
                                </span>
                              ) : isExcluded ? (
                                <>
                                  <span className="text-[10px] bg-[#fef2f2] text-[#991b1b] px-1.5 py-0.5 rounded font-bold">
                                    🚫 제외
                                  </span>
                                  <span className="text-[11px] text-[#991b1b] font-semibold">
                                    제외 &gt; {exclusionType}
                                  </span>
                                  <span className="text-[10px] bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded font-medium">
                                    소비지출 미포함
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] bg-[#f0f4fd] text-[#00236f] px-1.5 py-0.5 rounded font-bold">
                                    🛍️ 소비
                                  </span>
                                  <span className="text-[11px] text-[#191c1e] font-semibold">
                                    {majorCat || '식비'}{minorCat ? ` > ${minorCat}` : ''}
                                  </span>
                                  <span className="text-[10px] bg-[#e6f4ed] text-[#006c49] px-1.5 py-0.5 rounded font-medium">
                                    가계소비 포함
                                  </span>
                                </>
                              )}

                              {/* 신뢰도 배지 (pending일 때는 표시 안함) */}
                              {!isPending && (
                                tx.confidenceLevel === 'high' ? (
                                  <span className="text-[10px] bg-[#e6f4ed] text-[#006c49] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                    🟢 신뢰도 높음 ({tx.confidenceScore || 95}%)
                                  </span>
                                ) : tx.confidenceLevel === 'medium' ? (
                                  <span className="text-[10px] bg-[#e0f2fe] text-[#0369a1] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                    🔵 신뢰도 보통 ({tx.confidenceScore || 75}%)
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-[#fff7ed] text-[#c2410c] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                    🟠 신뢰도 낮음 ({tx.confidenceScore || 50}%)
                                  </span>
                                )
                              )}
                            </div>

                            {/* 확인 필요 질문 안내 */}
                            {isNeedsReview && userQuestion && (
                              <p className="text-[11px] text-[#c2410c] font-medium pt-0.5">
                                💡 {userQuestion}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-dohyeon text-sm text-[#191c1e] block">
                              -{formatKRW(tx.amount)}원
                            </span>

                            <button
                              onClick={() => handleToggleTxReview(tx.id)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded mt-1 transition-colors cursor-pointer ${
                                isPending
                                  ? 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                                  : isNeedsReview
                                  ? 'bg-[#c2410c] text-white hover:bg-[#9a3412]'
                                  : 'bg-[#e6f4ed] text-[#006c49] hover:bg-[#c3e9d5]'
                              }`}
                            >
                              {isPending ? '분류 대기' : isNeedsReview ? '확인 필요' : '검토 완료'}
                            </button>
                          </div>
                        </div>

                        {/* Edit option trigger */}
                        <div className="flex justify-between items-center pt-1.5 border-t border-[#eceef0]/60 text-[10px]">
                          <button
                            onClick={() => openEditModal(tx)}
                            className="text-[#00236f] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-xs">settings</span>
                            분류 수정하기
                          </button>

                          <span className="text-[#757682]">
                            {isPending
                              ? '⏳ AI 분류 대기 중'
                              : isUserConfirmed
                              ? '✓ 사용자 확인 완료'
                              : isNeedsReview
                              ? '⚠️ 확인이 필요한 항목입니다'
                              : '✓ 자동 분류됨'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                disabled={isCompleting || currentRecord.status === '결산잠금'}
                onClick={handleConfirmSettlement}
                className="w-full py-3.5 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">
                  {isCompleting ? 'sync' : 'verified'}
                </span>
                {isCompleting ? '확정 중...' : '결산 확정'}
              </button>
            </section>
          );
        })()}

          {/* Edit Transaction Classification Modal */}
          {editingTx && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-2">
                  <h4 className="font-dohyeon text-base text-[#00236f]">
                    거래 분류 수정
                  </h4>
                  <button onClick={() => setEditingTx(null)} className="cursor-pointer">
                    <span className="material-symbols-outlined text-xl text-[#757682]">
                      close
                    </span>
                  </button>
                </div>

                {/* Target Transaction Info */}
                <div className="bg-[#f7f9fb] p-3 rounded-xl border border-[#c5c5d3]/30 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold text-[#191c1e] block text-sm">
                      {editingTx.merchant}
                    </span>
                    <span className="text-[10px] text-[#757682]">
                      {editingTx.date} {editingTx.transactionType ? `| ${editingTx.transactionType}` : ''}
                    </span>
                  </div>
                  <span className="text-[#ba1a1a] font-dohyeon text-base">
                    -{formatKRW(editingTx.amount)}원
                  </span>
                </div>

                {/* Primary Choice: 소비 vs 제외 */}
                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-[#444651] block">
                    1. 분류 유형 선택
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setModalChoice('consumer');
                        if (!modalMajorCat || !CONSUMER_CATEGORIES[modalMajorCat]) {
                          setModalMajorCat('식비');
                          setModalMinorCat('외식');
                        }
                      }}
                      className={`p-3 rounded-xl font-bold transition-all text-center cursor-pointer ${
                        modalChoice === 'consumer'
                          ? 'bg-[#00236f] text-white shadow-sm ring-2 ring-[#00236f]/30'
                          : 'bg-[#f0f4fd] text-[#00236f] hover:bg-[#e0ecfe]'
                      }`}
                    >
                      🛍️ 소비로 분류
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalChoice('excluded')}
                      className={`p-3 rounded-xl font-bold transition-all text-center cursor-pointer ${
                        modalChoice === 'excluded'
                          ? 'bg-[#991b1b] text-white shadow-sm ring-2 ring-[#991b1b]/30'
                          : 'bg-[#fef2f2] text-[#991b1b] hover:bg-[#fee2e2]'
                      }`}
                    >
                      🚫 제외 처리
                    </button>
                  </div>
                </div>

                {/* Consumer Category Selection */}
                {modalChoice === 'consumer' ? (
                  <div className="space-y-3 pt-1 text-xs">
                    <div>
                      <label className="font-bold text-[#444651] block mb-1.5">
                        2. 소비 대분류 선택
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.keys(CONSUMER_CATEGORIES).map((major) => (
                          <button
                            key={major}
                            type="button"
                            onClick={() => {
                              setModalMajorCat(major);
                              const subList = CONSUMER_CATEGORIES[major] || [];
                              setModalMinorCat(subList[0] || '');
                            }}
                            className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                              modalMajorCat === major
                                ? 'bg-[#00236f] text-white'
                                : 'bg-[#f7f9fb] text-[#444651] border border-[#c5c5d3]/40 hover:bg-[#eceef0]'
                            }`}
                          >
                            {major}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-[#444651] block mb-1.5">
                        3. 소비 소분류 선택
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(CONSUMER_CATEGORIES[modalMajorCat] || []).map((minor) => (
                          <button
                            key={minor}
                            type="button"
                            onClick={() => setModalMinorCat(minor)}
                            className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              modalMinorCat === minor
                                ? 'bg-[#00236f] text-white shadow-xs'
                                : 'bg-[#f0f4fd] text-[#00236f] border border-[#bae6fd] hover:bg-[#e0ecfe]'
                            }`}
                          >
                            {minor}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Excluded Reason Selection */
                  <div className="space-y-2 pt-1 text-xs">
                    <label className="font-bold text-[#444651] block">
                      2. 제외 사유 선택
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {EXCLUSION_REASONS.map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => setModalExclusionReason(item.code)}
                          className={`p-2.5 rounded-xl font-medium text-left transition-all cursor-pointer ${
                            modalExclusionReason === item.code
                              ? 'bg-[#991b1b] text-white shadow-xs font-bold'
                              : 'bg-[#f7f9fb] text-[#374151] border border-[#c5c5d3]/40 hover:bg-[#fef2f2]'
                          }`}
                        >
                          <span className="block font-bold text-xs">{item.label}</span>
                          <span className={`text-[10px] block mt-0.5 ${modalExclusionReason === item.code ? 'text-white/80' : 'text-[#757682]'}`}>
                            {item.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checkbox for applying to same merchant */}
                <div className="pt-2 border-t border-[#c5c5d3]/20 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="applyFutureCheck"
                    checked={applyFuture}
                    onChange={(e) => setApplyFuture(e.target.checked)}
                    className="rounded text-[#00236f] focus:ring-[#00236f] w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="applyFutureCheck" className="text-xs text-[#444651] cursor-pointer">
                    동일 가맹점(<strong className="text-[#00236f]">{editingTx.merchant}</strong>) 전체 거래에 적용
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="flex-1 py-2.5 bg-white border border-[#c5c5d3]/50 text-[#757682] font-dohyeon text-xs rounded-xl hover:bg-[#f7f9fb] cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTxClassification}
                    className="flex-1 py-2.5 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] shadow-sm cursor-pointer"
                  >
                    분류 저장하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: 결산 확정 BODY (Requirement 9) ================= */}
          {currentRecord.currentStep === 5 && (
            <section className="bg-white p-5 rounded-2xl border border-[#c5c5d3]/30 shadow-xs space-y-4 animate-fadeIn">
              <div>
                <span className="text-xs font-bold text-[#00236f] bg-[#00236f]/10 px-2.5 py-1 rounded-md mb-2 inline-block">
                  Step 5 / 최종 확정
                </span>
                <h3 className="font-dohyeon text-lg text-[#00236f]">
                  {selectedMonth} 결산 확정 및 잠금
                </h3>
                <p className="text-xs text-[#757682] mt-1">
                  결산 확정 직전 요약 수치를 최종 확인해주세요.
                </p>
              </div>

              {/* Requirement 9: 결산 확정 직전 요약 카드 */}
              <div className="bg-[#f0f4fd] p-4 rounded-2xl border border-[#00236f]/20 space-y-3">
                <h4 className="font-dohyeon text-sm text-[#00236f] border-b border-[#00236f]/15 pb-2">
                  📊 {selectedMonth} 결산 최종 요약
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#444651]">총수입</span>
                    <span className="font-dohyeon text-sm text-[#006c49]">
                      +{formatKRW(totalIncome)}원
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#444651]">총현금유출 (지출 + 저축)</span>
                    <span className="font-dohyeon text-sm text-[#ba1a1a]">
                      -{formatKRW(totalCashOutflow)}원
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-[#00236f]/15">
                    <span className="font-bold text-[#00236f] text-sm">
                      순현금흐름
                    </span>
                    <span className="font-dohyeon text-base text-[#00236f]">
                      {netCashFlow >= 0 ? '+' : ''}
                      {formatKRW(netCashFlow)}원
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-[#c5c5d3]/30 flex justify-between">
                      <span className="text-[#757682]">확인 필요 거래</span>
                      <span
                        className={`font-bold ${
                          needsReviewCount > 0 ? 'text-[#c2410c]' : 'text-[#006c49]'
                        }`}
                      >
                        {needsReviewCount}건
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-[#c5c5d3]/30 flex justify-between">
                      <span className="text-[#757682]">미분류 거래</span>
                      <span
                        className={`font-bold ${
                          unclassifiedCount > 0 ? 'text-[#c2410c]' : 'text-[#006c49]'
                        }`}
                      >
                        {unclassifiedCount}건
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 이번 달 특이사항 Card in Step 5 */}
              <SpecialNotesSection
                selectedMonth={selectedMonth}
                currentRecord={currentRecord}
                onNotesSaved={handleNotesSaved}
              />

              {/* Requirement 9: 안내문 */}
              <div className="bg-[#fff7ed] p-3.5 rounded-xl border border-[#ffedd5] flex items-start gap-2.5 text-xs text-[#c2410c]">
                <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
                  lock
                </span>
                <div>
                  <span className="font-bold block">결산 잠금 안내</span>
                  <p className="text-[11px] text-[#9a3412] mt-0.5 leading-relaxed">
                    결산 완료 후에는 데이터 수정이 제한되며 &apos;결산잠금&apos; 상태로 저장됩니다.
                  </p>
                </div>
              </div>

              <button
                onClick={handleConfirmSettlement}
                className="w-full py-4 bg-[#00236f] text-white font-dohyeon text-sm rounded-xl shadow-lg hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">verified</span>
                {selectedMonth} 결산 확정하기
              </button>
            </section>
          )}
        </div>
      )}

      {/* ================= COLUMN MAPPING MODAL (Requirement 5) ================= */}
      {isMappingModalOpen && pendingCsvData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative border border-[#00236f]/20">
            <div className="flex justify-between items-center border-b border-[#c5c5d3]/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00236f] text-[#6cf8bb] flex items-center justify-center shadow-2xs">
                  <span className="material-symbols-outlined text-xl">view_column</span>
                </div>
                <div>
                  <h3 className="font-dohyeon text-base text-[#00236f]">
                    CSV 컬럼 매핑 설정
                  </h3>
                  <p className="text-[11px] text-[#757682]">
                    업로드한 파일의 헤더에서 거래일, 거래처, 금액 항목을 지정하세요.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="text-[#757682] hover:text-[#00236f] text-lg font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Date Field Select */}
              <div className="space-y-1">
                <label className="font-bold text-[#191c1e] block">📅 거래일시 / 날짜 열 선택</label>
                <select
                  value={mappingForm.dateCol}
                  onChange={(e) => setMappingForm((p) => ({ ...p, dateCol: e.target.value }))}
                  className="w-full p-2.5 border border-[#c5c5d3] rounded-xl focus:outline-none focus:border-[#00236f] bg-white font-medium"
                >
                  {pendingCsvData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Merchant Field Select */}
              <div className="space-y-1">
                <label className="font-bold text-[#191c1e] block">🏪 거래처 / 가맹점명 열 선택</label>
                <select
                  value={mappingForm.merchantCol}
                  onChange={(e) => setMappingForm((p) => ({ ...p, merchantCol: e.target.value }))}
                  className="w-full p-2.5 border border-[#c5c5d3] rounded-xl focus:outline-none focus:border-[#00236f] bg-white font-medium"
                >
                  {pendingCsvData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Field Select */}
              <div className="space-y-1">
                <label className="font-bold text-[#191c1e] block">💰 결제금액 / 거래금액 열 선택</label>
                <select
                  value={mappingForm.amountCol}
                  onChange={(e) => setMappingForm((p) => ({ ...p, amountCol: e.target.value }))}
                  className="w-full p-2.5 border border-[#c5c5d3] rounded-xl focus:outline-none focus:border-[#00236f] bg-white font-medium"
                >
                  {pendingCsvData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Preview Table */}
              <div className="pt-2">
                <span className="font-bold text-[#757682] block mb-1.5 text-[11px]">
                  🔍 선택한 매핑 데이터 미리보기 (상위 3개 행)
                </span>
                <div className="bg-[#f7f9fb] rounded-xl p-2.5 border border-[#c5c5d3]/30 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#c5c5d3]/30 text-[10px] text-[#757682]">
                        <th className="pb-1 px-1">거래일</th>
                        <th className="pb-1 px-1">거래처</th>
                        <th className="pb-1 px-1 text-right">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCsvData.rawRows.slice(0, 3).map((row, idx) => (
                        <tr key={idx} className="border-b border-[#c5c5d3]/10 last:border-none">
                          <td className="py-1 px-1 text-[11px] text-[#444651]">
                            {parseDateString(row[mappingForm.dateCol]) || row[mappingForm.dateCol] || '-'}
                          </td>
                          <td className="py-1 px-1 text-[11px] font-medium text-[#191c1e]">
                            {row[mappingForm.merchantCol] || '-'}
                          </td>
                          <td className="py-1 px-1 text-[11px] font-bold text-[#00236f] text-right">
                            {parseAmount(row[mappingForm.amountCol]).toLocaleString()}원
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsMappingModalOpen(false)}
                className="flex-1 py-3 border border-[#c5c5d3]/50 text-[#757682] hover:text-[#191c1e] font-dohyeon text-xs rounded-xl hover:bg-[#f0f4fd] transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleConfirmMapping}
                className="flex-1 py-3 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-base">check</span>
                매핑 완료 및 불러오기 ({pendingCsvData.totalRows}건)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 10: CELEBRATION OVERLAY (Requirement 10) ================= */}
      {isCompleting && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center space-y-5 shadow-2xl relative overflow-hidden border-2 border-[#00236f]/20">
            {/* Celebration Confetti Icon */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#00236f] to-[#1e3a8a] text-[#6cf8bb] flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <span className="material-symbols-outlined text-4xl">celebration</span>
            </div>

            <div className="space-y-1">
              <span className="text-2xl block">🎉</span>
              <h3 className="font-dohyeon text-xl text-[#00236f]">
                {selectedMonth} 결산 완료!
              </h3>
              <p className="text-xs text-[#757682] font-medium">
                한 달간의 가계 및 사업 재정이 완벽하게 정산되었습니다.
              </p>
            </div>

            <div className="bg-[#f0f4fd] p-4 rounded-2xl border border-[#00236f]/20">
              <span className="text-[11px] text-[#00236f] block font-medium">
                최종 순현금흐름
              </span>
              <span className="font-dohyeon text-2xl text-[#00236f]">
                {netCashFlow >= 0 ? '+' : ''}
                {formatKRW(netCashFlow)}원
              </span>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-[#00236f] font-bold pt-2">
              <span className="w-4 h-4 border-2 border-[#00236f] border-t-transparent rounded-full animate-spin"></span>
              <span>AI 월간 리포트를 생성하고 있습니다...</span>
            </div>
          </div>
        </div>
      )}

      {/* Unentered Variable Income Validation Modal */}
      {unenteredValidationModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl border border-[#c5c5d3]/30">
            <div className="flex items-center gap-2 text-[#c2410c]">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="font-dohyeon text-base text-[#191c1e]">
                입력되지 않은 변동수입 확인
              </h3>
            </div>

            <p className="text-xs text-[#444651] leading-relaxed">
              변동수입 중 <strong className="text-[#00236f]">{unenteredValidationModal.unenteredSources.length}개 항목</strong>의 금액이 입력되지 않았습니다.
            </p>

            <div className="bg-[#fff7ed] p-3 rounded-xl border border-[#ffedd5] text-xs space-y-1 max-h-32 overflow-y-auto">
              {unenteredValidationModal.unenteredSources.map((src) => (
                <div key={src.id} className="flex justify-between items-center text-[#c2410c] font-medium">
                  <span>• {src.incomeName || src.name}</span>
                  <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#ffedd5]">미입력</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#757682]">
              금액이 발생하지 않은 경우 '0원으로 처리'를 선택하시면 0원으로 저장되고 다음 단계로 이동합니다.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setUnenteredValidationModal({ isOpen: false, unenteredSources: [] });
                  saveStep1Records(true);
                }}
                className="w-full py-2.5 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] transition-all cursor-pointer"
              >
                0원으로 처리하고 다음 단계 이동
              </button>

              <button
                type="button"
                onClick={() => {
                  setUnenteredValidationModal({ isOpen: false, unenteredSources: [] });
                  saveStep1Records(false);
                }}
                className="w-full py-2.5 bg-[#f0f4fd] text-[#00236f] border border-[#00236f]/30 font-dohyeon text-xs rounded-xl hover:bg-[#e0ecfe] transition-all cursor-pointer"
              >
                미입력 상태로 임시 저장하고 다음 이동
              </button>

              <button
                type="button"
                onClick={() => setUnenteredValidationModal({ isOpen: false, unenteredSources: [] })}
                className="w-full py-2 bg-white text-[#757682] border border-[#c5c5d3]/50 font-dohyeon text-xs rounded-xl hover:bg-[#f7f9fb] transition-all cursor-pointer"
              >
                돌아가서 금액 입력하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Month Switch Unsaved Changes Confirmation Modal */}
      {pendingMonthSwitch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-xl border border-[#c5c5d3]/30">
            <div className="flex items-center gap-2 text-[#00236f]">
              <span className="material-symbols-outlined text-2xl">help_outline</span>
              <h3 className="font-dohyeon text-base text-[#191c1e]">
                저장하지 않은 변경사항 안내
              </h3>
            </div>

            <p className="text-xs text-[#444651] leading-relaxed">
              <strong className="text-[#00236f]">{selectedMonth}</strong> 수입 입력란에 작성 중인 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  saveStep1Records(false);
                  setSelectedMonth(pendingMonthSwitch);
                  setPendingMonthSwitch(null);
                }}
                className="w-full py-2.5 bg-[#00236f] text-white font-dohyeon text-xs rounded-xl hover:bg-[#1e3a8a] transition-all cursor-pointer"
              >
                저장하고 {pendingMonthSwitch}으로 이동
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(pendingMonthSwitch);
                  setPendingMonthSwitch(null);
                }}
                className="w-full py-2.5 bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5] font-dohyeon text-xs rounded-xl hover:bg-[#ffedd5] transition-all cursor-pointer"
              >
                저장하지 않고 이동
              </button>

              <button
                type="button"
                onClick={() => setPendingMonthSwitch(null)}
                className="w-full py-2 bg-white text-[#757682] border border-[#c5c5d3]/50 font-dohyeon text-xs rounded-xl hover:bg-[#f7f9fb] transition-all cursor-pointer"
              >
                취소 (현재 결산월 유지)
              </button>
            </div>
          </div>
        </div>
      )}

      <OpeningSnapshotModal
        isOpen={isOpeningSnapshotModalOpen}
        onClose={() => setIsOpeningSnapshotModalOpen(false)}
        selectedMonth={currentRecord.month || selectedMonth}
      />
    </div>
  );
};
