import React, { useState, useEffect, useCallback } from 'react';
import { ScreenId, Transaction } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { useSelectedMonth, getPrevMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { formatSummaryAmountKRW } from '../utils/amountUtils';
import { getSubCategoryIcon } from '../utils/categoryTheme';
import {
  getConsumerSubcategoryBreakdown,
  getConsumerTopMerchants,
  calculateConsumerInsights,
} from '../utils/consumerExpenseUtils';
import {
  buildCfoAnalysisInput,
  getCachedAnalysisResult,
  requestCfoMonthlyAnalysis,
  CfoAnalysisResult,
} from '../services/cfoAnalysisService';
import {
  getTransactionsForMonth,
  getExpenseSummaryForMonth,
  getCategorySummaryForMonth,
  getMonthlyRecordForMonth,
  getMonthlySettlementSummary,
  normalizeMonthKey,
} from '../utils/monthDataSelectors';

interface LedgerMainScreenProps {
  onNavigate: (screen: ScreenId, categoryFilter?: string) => void;
  onOpenAddModal: () => void;
  transactions: Transaction[];
}

export const LedgerMainScreen: React.FC<LedgerMainScreenProps> = ({
  onNavigate,
  onOpenAddModal,
}) => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth } = useSelectedMonth();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllInsights, setShowAllInsights] = useState<boolean>(false);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState<boolean>(false);
  const [showOutflowBreakdown, setShowOutflowBreakdown] = useState<boolean>(false);

  // AI Analysis state (button-triggered & cached)
  const [aiAnalysis, setAiAnalysis] = useState<CfoAnalysisResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [, setTick] = useState(0);

  useEffect(() => {
    return GlobalMockDataStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Check cached analysis when selectedMonth changes (without making any network call)
  useEffect(() => {
    const input = buildCfoAnalysisInput(selectedMonth);
    const cached = getCachedAnalysisResult(selectedMonth, input);
    setAiAnalysis(cached);
    setAiError(null);
  }, [selectedMonth]);

  const handleRunAiAnalysis = useCallback(async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const input = buildCfoAnalysisInput(selectedMonth);
      const res = await requestCfoMonthlyAnalysis(input);
      setAiAnalysis(res);
    } catch (err: any) {
      console.error('Ledger AI Analysis failed:', err);
      setAiError('AI 분석을 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsAiLoading(false);
    }
  }, [selectedMonth]);

  // Filter transactions strictly by selected month using central selector
  const selectedMonthTxs = getTransactionsForMonth(selectedMonth);
  const prevMonthKey = getPrevMonth(normalizeMonthKey(selectedMonth).yyyyMm);
  const prevMonthTxs = getTransactionsForMonth(prevMonthKey);
  const summary = getExpenseSummaryForMonth(selectedMonth);
  const categoryList = getCategorySummaryForMonth(selectedMonth);
  const settlementSummary = getMonthlySettlementSummary(selectedMonth);

  const totalLivingExpense = summary.totalExpense;

  const currentRecord = getMonthlyRecordForMonth(selectedMonth);
  const settlementStatus = currentRecord?.status || '미결산';

  let settlementButtonText = `${formattedSelectedMonth} 결산 시작하기`;
  if (settlementStatus === '완료' || settlementStatus === '결산잠금') {
    settlementButtonText = `${formattedSelectedMonth} 결산 보기`;
  } else if (settlementStatus === '진행중') {
    settlementButtonText = `${formattedSelectedMonth} 결산 계속하기`;
  }

  // Retrieve saved income items for selected month without altering any calculation
  const getIncomeItemsForMonth = () => {
    if (currentRecord && Array.isArray(currentRecord.incomes) && currentRecord.incomes.length > 0) {
      return currentRecord.incomes
        .filter((inc: any) => (Number(inc.amount) || 0) > 0)
        .map((inc: any) => ({
          id: inc.id || `inc_${inc.incomeName || inc.name}`,
          name: inc.incomeName || inc.name || '수입원',
          type: inc.incomeType || '사업소득',
          amount: Number(inc.amount) || 0,
        }));
    }

    const norm = normalizeMonthKey(selectedMonth);
    const storeIncomes = GlobalMockDataStore.getIncomeRecords(norm.year, norm.month);
    const sources = GlobalMockDataStore.getIncomeSources();
    if (storeIncomes && storeIncomes.length > 0) {
      return storeIncomes
        .filter((r) => (Number(r.actualIncome) || 0) > 0)
        .map((r) => {
          const src = sources.find((s) => s.id === r.incomeSourceId);
          return {
            id: r.id,
            name: src?.incomeName || src?.name || '수입원',
            type: src?.incomeType || '사업소득',
            amount: Number(r.actualIncome) || 0,
          };
        });
    }

    return sources
      .filter((s: any) => (Number(s.amount || s.fixedMonthlyIncome || s.monthlyIncome || 0)) > 0)
      .map((s: any) => ({
        id: s.id,
        name: s.incomeName || s.name || '수입원',
        type: s.incomeType || '사업소득',
        amount: Number(s.amount || s.fixedMonthlyIncome || s.monthlyIncome || 0),
      }));
  };

  const incomeItems = getIncomeItemsForMonth();

  // Calculate Insights strictly for selected month & previous month transactions
  const insights = calculateConsumerInsights(selectedMonthTxs, prevMonthTxs);

  return (
    <div className="space-y-5 pb-28">
      {/* 0. Top Header with Global Month Selector */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="font-dohyeon text-lg text-[#00236f]">
            {formattedSelectedMonth} 가계부
          </h1>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            소비 지출 및 카테고리 현황
          </p>
        </div>
        <MonthSelector
          selectedMonth={selectedMonth}
          onChangeMonth={setSelectedMonth}
        />
      </section>

      {/* 1. 요약 카드 영역 (총 소비지출 Hero + 총수입 / 총현금유출 Grid) */}
      <section className="space-y-3">
        {/* Total Expenditure Hero Card (메인 진입점: 클릭 시 2-1 이동) */}
        <div
          id="ledger-total-spending-hero"
          onClick={() => onNavigate('2-1')}
          className="group relative overflow-hidden rounded-2xl bg-[#00236f] p-5 sm:p-6 text-white shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between min-h-40 border border-[#00236f] active:scale-[0.99]"
        >
          <div className="z-10">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white/80 text-lg">receipt_long</span>
                <p className="font-body-md text-xs sm:text-sm text-white/90 font-medium">
                  {formattedSelectedMonth} 총 소비지출
                </p>
              </div>
              <span className="text-[11px] font-bold bg-white/20 group-hover:bg-[#6ffbbe] group-hover:text-[#005236] px-2.5 py-1 rounded-md text-white transition-colors flex items-center gap-1">
                지출내역 보기
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </span>
            </div>
            <h2 className="font-dohyeon text-3xl sm:text-4xl mt-3 text-white tracking-tight">
              {totalLivingExpense.toLocaleString()}원
            </h2>
          </div>
          <div className="z-10 flex items-center justify-between text-[#6ffbbe] bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 mt-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 truncate">
              <span className="material-symbols-outlined text-sm shrink-0">auto_awesome</span>
              <span className="truncate">
                {summary.totalCount > 0
                  ? `${formattedSelectedMonth} 소비 포함 총 ${summary.totalCount}건의 거래가 집계되었습니다`
                  : `${formattedSelectedMonth} 소비 데이터가 없습니다. CSV를 업로드해 보세요.`}
              </span>
            </span>
            <span className="text-[11px] underline shrink-0 ml-2 group-hover:text-white">
              전체 내역 확인 &gt;
            </span>
          </div>
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* 총수입 & 총현금유출 Breakdown Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 총수입 카드 (클릭 시 수입 구성 Breakdown 토글) */}
          <div
            id="ledger-total-income-card"
            className="bg-white rounded-2xl border border-[#c5c5d3]/30 shadow-xs hover:border-[#00236f]/30 hover:shadow-md transition-all overflow-hidden"
          >
            <div
              onClick={() => setShowIncomeBreakdown(!showIncomeBreakdown)}
              className="p-4.5 cursor-pointer flex items-center justify-between select-none active:scale-[0.99] transition-transform"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#757682] font-semibold">
                  <span className="material-symbols-outlined text-base text-[#006c49]">trending_up</span>
                  <span>총수입</span>
                </div>
                <p className="font-dohyeon text-xl sm:text-2xl text-[#191c1e]">
                  {settlementSummary.totalIncome.toLocaleString()}원
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#00236f] font-bold bg-[#f0f4fd] px-2.5 py-1.5 rounded-xl">
                <span>{showIncomeBreakdown ? '접기' : '수입 구성'}</span>
                <span className="material-symbols-outlined text-sm">
                  {showIncomeBreakdown ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </div>

            {showIncomeBreakdown && (
              <div className="px-4.5 pb-4 pt-2 border-t border-[#eceef0] bg-[#f8fafd] space-y-2 animate-fadeIn">
                <p className="text-[11px] font-bold text-[#757682] mb-1 flex justify-between">
                  <span>확정 수입원 항목</span>
                  <span>금액</span>
                </p>
                {incomeItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {incomeItems.map((inc) => (
                      <div key={inc.id} className="flex justify-between items-center text-xs">
                        <span className="text-[#191c1e] font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" />
                          {inc.name}
                          <span className="text-[10px] text-[#757682] bg-white px-1.5 py-0.2 rounded border border-[#c5c5d3]/30">
                            {inc.type}
                          </span>
                        </span>
                        <span className="font-dohyeon text-[#006c49]">
                          {inc.amount.toLocaleString()}원
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#757682] py-1 text-center font-medium">
                    저장된 수입 항목이 없습니다
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 총현금유출 카드 (클릭 시 현금유출 구성 Breakdown 토글) */}
          <div
            id="ledger-total-outflow-card"
            className="bg-white rounded-2xl border border-[#c5c5d3]/30 shadow-xs hover:border-[#00236f]/30 hover:shadow-md transition-all overflow-hidden"
          >
            <div
              onClick={() => setShowOutflowBreakdown(!showOutflowBreakdown)}
              className="p-4.5 cursor-pointer flex items-center justify-between select-none active:scale-[0.99] transition-transform"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#757682] font-semibold">
                  <span className="material-symbols-outlined text-base text-[#ba1a1a]">trending_down</span>
                  <span>총현금유출</span>
                </div>
                <p className="font-dohyeon text-xl sm:text-2xl text-[#191c1e]">
                  {settlementSummary.totalOutflow.toLocaleString()}원
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#00236f] font-bold bg-[#f0f4fd] px-2.5 py-1.5 rounded-xl">
                <span>{showOutflowBreakdown ? '접기' : '유출 구성'}</span>
                <span className="material-symbols-outlined text-sm">
                  {showOutflowBreakdown ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </div>

            {showOutflowBreakdown && (
              <div className="px-4.5 pb-4 pt-2 border-t border-[#eceef0] bg-[#f8fafd] space-y-2 animate-fadeIn">
                <p className="text-[11px] font-bold text-[#757682] mb-1">
                  월간결산 확정 현금유출 구성
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-[#eceef0]">
                    <span className="text-[#191c1e] font-semibold">총현금유출</span>
                    <span className="font-dohyeon text-[#ba1a1a]">
                      {settlementSummary.totalOutflow.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[#444651] font-medium flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#757682]" />
                      생활지출
                    </span>
                    <span className="font-semibold text-[#191c1e]">
                      {settlementSummary.livingExpense.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[#444651] font-medium flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#757682]" />
                      금융비용(이자)
                    </span>
                    <span className="font-semibold text-[#191c1e]">
                      {settlementSummary.financialCost.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[#444651] font-medium flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#757682]" />
                      부채상환 원금
                    </span>
                    <span className="font-semibold text-[#191c1e]">
                      {settlementSummary.debtPrincipal.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[#444651] font-medium flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#757682]" />
                      저축·투자
                    </span>
                    <span className="font-semibold text-[#191c1e]">
                      {settlementSummary.totalSavings.toLocaleString()}원
                    </span>
                  </div>
                  {settlementSummary.taxAndPublicCharges > 0 && (
                    <div className="flex justify-between items-center pl-2">
                      <span className="text-[#444651] font-medium flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#854d0e]" />
                        세금·공과
                      </span>
                      <span className="font-semibold text-[#854d0e]">
                        {settlementSummary.taxAndPublicCharges.toLocaleString()}원
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. 결산 보기 (가장 강조되는 메인 CTA 버튼) */}
      <section>
        <button
          id="ledger-nav-monthly-settlement-primary"
          onClick={() => onNavigate('2-3')}
          className="w-full py-5 sm:py-6 px-6 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-dohyeon rounded-2xl shadow-md hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-between group cursor-pointer border border-[#00236f] text-left"
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#6ffbbe] text-[#005236] shrink-0">
                {settlementStatus === '완료' || settlementStatus === '결산잠금' ? '결산 완료' : settlementStatus === '진행중' ? '결산 진행중' : '미결산'}
              </span>
              <span className="text-xs text-white/80 font-body-sm truncate">핵심 가계부 결산 절차</span>
            </div>
            <h3 className="font-dohyeon text-xl sm:text-2xl text-white group-hover:underline flex items-center gap-2">
              {settlementButtonText}
              <span className="material-symbols-outlined text-xl text-[#6ffbbe] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </h3>
            <p className="text-xs text-white/75 font-body-sm">
              CSV 업로드 · 거래검토 · 손익확정 한눈에 시작하기
            </p>
          </div>
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-xs">
            <span className="material-symbols-outlined text-3xl text-[#6ffbbe]" style={{ fontVariationSettings: "'FILL' 1" }}>
              calendar_month
            </span>
          </div>
        </button>
      </section>

      {/* 4. 카테고리별 지출 요약 (Category Breakdown Overview) */}
      <section className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-4">
        <div className="flex justify-between items-center border-b border-[#c5c5d3]/20 pb-3">
          <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">pie_chart</span>
            {formattedSelectedMonth} 카테고리별 지출 요약
          </h3>
          <span className="text-xs text-[#757682] font-medium">
            행 클릭 시 소분류 펼침
          </span>
        </div>

        {categoryList.length === 0 ? (
          <div className="py-8 text-center text-[#757682] text-xs space-y-2">
            <p className="font-dohyeon text-sm text-[#191c1e]">
              {formattedSelectedMonth} 지출 내역이 없습니다
            </p>
            <p className="text-[11px] text-[#757682]">
              CSV 파일을 업로드하면 자동 분류된 소비 지출이 표시됩니다.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('2-3')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00236f] text-white text-xs font-dohyeon rounded-xl hover:bg-[#1e3a8a] transition-all shadow-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">cloud_upload</span>
              {formattedSelectedMonth} CSV 업로드
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {categoryList.map((item) => {
              const pct = totalLivingExpense > 0 ? Math.round((item.amount / totalLivingExpense) * 100) : 0;
              const isExpanded = expandedCategory === item.category;

              let subCategoriesList: Array<{ name: string; amount: number; count: number; percentage: number }> = [];
              let top3Merchants: Array<{ merchant: string; amount: number; count: number }> = [];

              if (isExpanded) {
                subCategoriesList = getConsumerSubcategoryBreakdown(selectedMonthTxs, item.category);
                top3Merchants = getConsumerTopMerchants(selectedMonthTxs, item.category, 3);
              }

              return (
                <div
                  key={item.category}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isExpanded
                      ? 'bg-[#f8fafd] border-[#00236f]/30 p-3.5 shadow-xs'
                      : 'bg-white border-[#c5c5d3]/15 p-3 hover:border-[#00236f]/20'
                  }`}
                >
                  <div
                    onClick={() => setExpandedCategory(isExpanded ? null : item.category)}
                    className="cursor-pointer space-y-1.5 select-none"
                  >
                    <div className="flex justify-between items-center text-xs font-semibold text-[#191c1e] gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-base shrink-0" style={{ color: item.group.color }}>
                          {item.group.icon}
                        </span>
                        <span className="font-bold text-[#191c1e] text-sm truncate">{item.category}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-dohyeon text-sm text-[#00236f]">
                          {formatSummaryAmountKRW(item.amount)} ({pct}%)
                        </span>
                        <span className="material-symbols-outlined text-lg text-[#757682]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-[#e6e8ea] h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: item.group.color }}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#00236f]/10 space-y-3 animate-fadeIn">
                      <div>
                        <div className="text-[11px] font-bold text-[#757682] mb-1.5 flex items-center justify-between">
                          <span>소분류별 금액</span>
                          <span>비중</span>
                        </div>
                        {subCategoriesList.length === 0 ? (
                          <p className="text-[11px] text-[#757682] py-1">소분류 지출 내역이 없습니다.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {subCategoriesList.map((sub) => (
                              <div key={sub.name} className="flex justify-between items-center text-xs gap-2">
                                <span className="text-[#191c1e] font-medium flex items-center gap-1.5 min-w-0">
                                  <span className="material-symbols-outlined text-sm shrink-0" style={{ color: item.group.color }}>
                                    {getSubCategoryIcon(sub.name, item.category)}
                                  </span>
                                  <span className="truncate">{sub.name}</span>
                                </span>
                                <div className="text-right flex items-center gap-2 shrink-0">
                                  <span className="font-semibold text-[#191c1e]">
                                    {formatSummaryAmountKRW(sub.amount)}
                                  </span>
                                  <span className="text-[10px] font-bold text-[#00236f] bg-[#dce1ff] px-1.5 py-0.2 rounded">
                                    {sub.percentage}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-[#00236f]/10 pt-2.5">
                        <div className="text-[11px] font-bold text-[#757682] mb-1.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-[#006c49]">storefront</span>
                          주요 거래처 TOP 3
                        </div>
                        {top3Merchants.length === 0 ? (
                          <p className="text-[11px] text-[#757682]">거래처 내역이 없습니다.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {top3Merchants.map((m, idx) => (
                              <div key={m.merchant} className="flex justify-between items-center text-xs gap-2">
                                <span className="text-[#191c1e] font-medium flex items-center gap-1.5 truncate max-w-[65%] min-w-0">
                                  <span className="w-4 h-4 rounded-full bg-[#00236f]/10 text-[#00236f] text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="truncate">{m.merchant}</span>
                                </span>
                                <span className="font-semibold text-[#00236f] text-xs shrink-0">
                                  {formatSummaryAmountKRW(m.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-[#00236f]/10 pt-2.5 flex justify-between items-center">
                        <span className="text-xs font-semibold text-[#444651]">
                          총 <strong className="text-[#00236f] font-dohyeon">{item.count}건</strong> 거래
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('2-1', item.category);
                          }}
                          className="px-3 py-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                        >
                          전체 거래 보기
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. 소비 인사이트 (Quick Consumer Insights Section) */}
      <section className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/20 space-y-4">
        <div className="flex justify-between items-center border-b border-[#c5c5d3]/20 pb-3">
          <h3 className="font-dohyeon text-base text-[#00236f] flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[#d97706]">insights</span>
            {formattedSelectedMonth} 소비 인사이트
          </h3>
          <span className="text-[11px] text-[#757682]">숫자 중심 소비 핵심 요약</span>
        </div>

        {selectedMonthTxs.length === 0 ? (
          <div className="py-6 text-center text-[#757682] text-xs">
            <p className="font-dohyeon text-sm text-[#191c1e] mb-1">
              {formattedSelectedMonth} 소비 데이터가 없습니다
            </p>
            <p className="text-[11px]">CSV를 업로드하면 소비 패턴 및 핵심 인사이트가 자동 생성됩니다.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#00236f] shrink-0">
                    {insights.prevComparison.isIncreased ? 'trending_up' : 'trending_down'}
                  </span>
                  지난달 대비 증감
                </span>
                <div className="font-dohyeon text-sm text-[#191c1e] flex items-center gap-1">
                  <span className={insights.prevComparison.isIncreased ? 'text-[#ba1a1a]' : 'text-[#006c49]'}>
                    {insights.prevComparison.isIncreased ? '▲' : '▼'} {insights.prevComparison.diffPercent}%
                  </span>
                </div>
                <span className="text-[10px] text-[#757682] block">
                  {insights.prevComparison.diffAmount >= 0 ? '+' : ''}
                  {formatSummaryAmountKRW(insights.prevComparison.diffAmount)}
                </span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#d97706] shrink-0">workspace_premium</span>
                  최대 지출 카테고리
                </span>
                <div className="font-dohyeon text-sm text-[#00236f] truncate">
                  {insights.topCategory ? insights.topCategory.category : '-'}
                </div>
                <span className="text-[10px] text-[#757682] block">
                  {insights.topCategory ? formatSummaryAmountKRW(insights.topCategory.amount) : '내역 없음'}
                </span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#ba1a1a] shrink-0">local_fire_department</span>
                  최대 증가 카테고리
                </span>
                <div className="font-dohyeon text-sm text-[#ba1a1a] truncate">
                  {insights.mostIncreasedCategory ? insights.mostIncreasedCategory.category : '-'}
                </div>
                <span className="text-[10px] text-[#757682] block">
                  {insights.mostIncreasedCategory
                    ? `+${formatSummaryAmountKRW(insights.mostIncreasedCategory.increaseAmount)}`
                    : '증가 내역 없음'}
                </span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#00236f] shrink-0">calendar_today</span>
                  하루 평균 소비
                </span>
                <div className="font-dohyeon text-sm text-[#00236f]">
                  {formatSummaryAmountKRW(insights.dailyAverage)}
                </div>
                <span className="text-[10px] text-[#757682] block">월 30일 기준</span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#ea580c] shrink-0">restaurant_menu</span>
                  외식 횟수 & 금액
                </span>
                <div className="font-dohyeon text-sm text-[#191c1e]">
                  {insights.diningOut.count}회 · {formatSummaryAmountKRW(insights.diningOut.amount)}
                </div>
                <span className="text-[10px] text-[#757682] block">식비 소분류</span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-xs text-[#d97706] shrink-0">shopping_cart</span>
                  장보기 횟수 & 금액
                </span>
                <div className="font-dohyeon text-sm text-[#191c1e]">
                  {insights.grocery.count}회 · {formatSummaryAmountKRW(insights.grocery.amount)}
                </div>
                <span className="text-[10px] text-[#757682] block">식비 소분류</span>
              </div>

              {showAllInsights && (
                <>
                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-xs text-[#00236f] shrink-0">local_convenience_store</span>
                      편의점 이용
                    </span>
                    <div className="font-dohyeon text-sm text-[#191c1e]">
                      {insights.convenience.count}회 · {formatSummaryAmountKRW(insights.convenience.amount)}
                    </div>
                    <span className="text-[10px] text-[#757682] block">소비 건수</span>
                  </div>

                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-xs text-[#7c3aed] shrink-0">school</span>
                      교육비 합계
                    </span>
                    <div className="font-dohyeon text-sm text-[#00236f]">
                      {formatSummaryAmountKRW(insights.education.amount)}
                    </div>
                    <span className="text-[10px] text-[#757682] block">가족 소분류</span>
                  </div>

                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-xs text-[#059669] shrink-0">shield</span>
                      보험료 합계
                    </span>
                    <div className="font-dohyeon text-sm text-[#006c49]">
                      {formatSummaryAmountKRW(insights.insurance.amount)}
                    </div>
                    <span className="text-[10px] text-[#757682] block">보험 카테고리</span>
                  </div>

                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-xs text-[#00236f] shrink-0">storefront</span>
                      최다 방문 거래처
                    </span>
                    <div className="font-dohyeon text-sm text-[#191c1e] truncate">
                      {insights.topMerchant ? insights.topMerchant.merchant : '-'}
                    </div>
                    <span className="text-[10px] text-[#757682] block">
                      {insights.topMerchant
                        ? `${insights.topMerchant.count}회 · ${formatSummaryAmountKRW(insights.topMerchant.amount)}`
                        : '내역 없음'}
                    </span>
                  </div>

                  <div className="col-span-2 bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-xs text-[#ba1a1a] shrink-0">credit_card</span>
                      가장 큰 단일 소비
                    </span>
                    <div className="font-dohyeon text-sm text-[#ba1a1a] flex justify-between items-center gap-2">
                      <span className="truncate">{insights.largestSingleTransaction ? insights.largestSingleTransaction.merchant : '-'}</span>
                      <span className="shrink-0">{insights.largestSingleTransaction ? formatSummaryAmountKRW(insights.largestSingleTransaction.amount) : '-'}</span>
                    </div>
                    <span className="text-[10px] text-[#757682] block">
                      {insights.largestSingleTransaction ? insights.largestSingleTransaction.category : ''}
                    </span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAllInsights(!showAllInsights)}
              className="w-full py-2 bg-[#f2f4f6] hover:bg-[#e6e8ea] text-[#00236f] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
            >
              {showAllInsights ? '간략히 보기' : '인사이트 전체 보기'}
              <span className="material-symbols-outlined text-sm">
                {showAllInsights ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </>
        )}
      </section>

      {/* 6. AI CFO 한줄 코멘트 (AI CFO One-Line Spending Insight Card) */}
      <section className="bg-gradient-to-r from-[#00236f]/5 to-[#6ffbbe]/10 p-4 rounded-2xl border border-[#00236f]/20 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00236f] text-[#6ffbbe] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-base">smart_toy</span>
            </div>
            <div>
              <span className="font-dohyeon text-sm text-[#00236f] block">AI CFO 한줄 코멘트</span>
              <span className="text-[10px] text-[#757682]">
                {aiAnalysis ? '실시간 맞춤 분석 완료' : `${formattedSelectedMonth} 소비 패턴 AI 해석`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunAiAnalysis}
            disabled={isAiLoading}
            className="px-3 py-1.5 bg-[#00236f] hover:bg-[#1e3a8a] text-[#6ffbbe] hover:text-white text-xs font-dohyeon rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isAiLoading ? 'animate-spin' : ''}`}>
              {isAiLoading ? 'sync' : 'auto_awesome'}
            </span>
            {isAiLoading ? '분석 중...' : (aiAnalysis ? '다시 분석하기' : 'AI 분석하기')}
          </button>
        </div>

        {aiError && (
          <div className="bg-[#fff1f2] p-2.5 rounded-xl border border-[#fecdd3] text-xs text-[#be123c] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{aiError}</span>
          </div>
        )}

        <div className="bg-white/80 p-3.5 rounded-xl border border-white/60 text-xs text-[#191c1e] font-medium leading-relaxed shadow-2xs">
          {isAiLoading ? (
            <div className="flex items-center gap-2 text-[#757682] py-1">
              <span className="material-symbols-outlined text-sm animate-spin text-[#00236f]">progress_activity</span>
              <span>가족의 재무 및 소비 패턴을 종합 분석하는 중입니다...</span>
            </div>
          ) : aiAnalysis ? (
            <p className="text-[#00236f] font-semibold">
              {aiAnalysis.spendingInsight}
            </p>
          ) : (
            <p className="text-[#555770]">
              우측 상단의 <strong className="text-[#00236f]">[AI 분석하기]</strong> 버튼을 누르면 인공지능 CFO가 {formattedSelectedMonth} 소비 지출 패턴과 재무 관계를 해석해 드립니다.
            </p>
          )}
        </div>
      </section>

      {/* FAB: Add Entry */}
      <button
        id="ledger-fab-add"
        onClick={onOpenAddModal}
        className="fixed bottom-22 right-5 w-14 h-14 bg-[#00236f] text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40 hover:bg-[#1e3a8a] cursor-pointer"
        aria-label="Add transaction"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>
    </div>
  );
};
