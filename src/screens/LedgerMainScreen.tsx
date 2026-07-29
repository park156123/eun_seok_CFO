import React, { useState, useEffect } from 'react';
import { ScreenId, Transaction } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { ActiveSessionBanner } from '../components/ActiveSessionBanner';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import {
  getConsumerSubcategoryBreakdown,
  getConsumerTopMerchants,
  calculateConsumerInsights,
  generateCfoComment,
} from '../utils/consumerExpenseUtils';
import {
  getTransactionsForMonth,
  getExpenseSummaryForMonth,
  getCategorySummaryForMonth,
  getMonthlyRecordForMonth,
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

  const [, setTick] = useState(0);

  useEffect(() => {
    return GlobalMockDataStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Filter transactions strictly by selected month using central selector
  const selectedMonthTxs = getTransactionsForMonth(selectedMonth);
  const summary = getExpenseSummaryForMonth(selectedMonth);
  const categoryList = getCategorySummaryForMonth(selectedMonth);

  const totalLivingExpense = summary.totalExpense;

  const currentRecord = getMonthlyRecordForMonth(selectedMonth);
  const settlementStatus = currentRecord?.status || '미결산';

  let settlementButtonText = `${formattedSelectedMonth} 결산 시작하기`;
  if (settlementStatus === '완료' || settlementStatus === '결산잠금') {
    settlementButtonText = `${formattedSelectedMonth} 결산 보기`;
  } else if (settlementStatus === '진행중') {
    settlementButtonText = `${formattedSelectedMonth} 결산 계속하기`;
  }

  // Calculate Insights strictly for selected month transactions
  const insights = calculateConsumerInsights(selectedMonthTxs);
  const cfoComment = selectedMonthTxs.length > 0
    ? generateCfoComment(selectedMonthTxs)
    : `${formattedSelectedMonth} 소비 데이터가 업로드되면 AI CFO가 소비 습관 분석 및 1줄 총평을 제공합니다.`;

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

      {/* Active Session Info Banner */}
      <ActiveSessionBanner
        showActions={true}
        onNavigateToSettlement={() => onNavigate('2-3')}
      />

      {/* Total Expenditure Hero Card */}
      <section className="relative overflow-hidden rounded-2xl bg-[#00236f] p-6 text-white shadow-lg flex flex-col justify-between min-h-40">
        <div className="z-10">
          <div className="flex justify-between items-center">
            <p className="font-body-md text-xs text-white/80">{formattedSelectedMonth} 총 소비지출</p>
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded text-white">
              소비 집계 기준
            </span>
          </div>
          <h2 className="font-dohyeon text-3xl mt-2 text-white tracking-tight">
            -{totalLivingExpense.toLocaleString()}원
          </h2>
        </div>
        <div className="z-10 flex items-center gap-1.5 text-[#6ffbbe] bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20 mt-3">
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          <span className="font-label-md text-xs">
            {summary.totalCount > 0
              ? `${formattedSelectedMonth} 소비 포함 총 ${summary.totalCount}건의 거래가 집계되었습니다`
              : `${formattedSelectedMonth} 소비 데이터가 없습니다. CSV를 업로드해 보세요.`}
          </span>
        </div>
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </section>

      {/* Quick Navigation */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Primary Action Button: 월간결산 */}
        <button
          id="ledger-nav-monthly-settlement-primary"
          onClick={() => onNavigate('2-3')}
          className="md:col-span-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white p-5 rounded-2xl shadow-md border border-[#00236f] transition-all flex items-center justify-between group active:scale-98 cursor-pointer text-left"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#6ffbbe] text-[#005236]">
                {settlementStatus === '완료' || settlementStatus === '결산잠금' ? '결산 완료' : settlementStatus === '진행중' ? '결산 진행중' : '미결산'}
              </span>
              <span className="text-xs text-white/80">핵심 가계부 절차</span>
            </div>
            <h3 className="font-dohyeon text-lg text-white group-hover:underline">
              {settlementButtonText}
            </h3>
            <p className="text-xs text-white/70">
              CSV 업로드 · 거래검토 · 손익확정
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-2xl text-[#6ffbbe]">calendar_month</span>
          </div>
        </button>

        {/* Secondary Action Button: 지출내역 */}
        <button
          id="ledger-nav-expense-list-secondary"
          onClick={() => onNavigate('2-1')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-[#c5c5d3]/30 hover:border-[#00236f]/40 hover:bg-[#f8fafd] transition-all flex md:flex-col justify-between items-center md:items-start group active:scale-98 cursor-pointer text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-[#dce1ff] flex items-center justify-center mb-0 md:mb-2 group-hover:scale-105 transition-transform shrink-0">
            <span className="material-symbols-outlined text-[#00236f]">receipt_long</span>
          </div>
          <div>
            <h4 className="font-dohyeon text-sm text-[#191c1e] group-hover:text-[#00236f]">
              지출내역 보기
            </h4>
            <p className="text-[11px] text-[#757682] mt-0.5">
              소비 및 제외 거래 ({summary.totalCount}건)
            </p>
          </div>
        </button>
      </section>

      {/* Category Breakdown Overview */}
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
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#00236f] text-white text-xs font-dohyeon rounded-xl hover:bg-[#1e3a8a] transition-all shadow-2xs"
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
                    <div className="flex justify-between items-center text-xs font-semibold text-[#191c1e]">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base" style={{ color: item.group.color }}>
                          {item.group.icon}
                        </span>
                        <span className="font-bold text-[#191c1e] text-sm">{item.category}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-dohyeon text-sm text-[#00236f]">
                          {item.amount.toLocaleString()}원 ({pct}%)
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
                              <div key={sub.name} className="flex justify-between items-center text-xs">
                                <span className="text-[#191c1e] font-medium flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]" />
                                  {sub.name}
                                </span>
                                <div className="text-right flex items-center gap-2">
                                  <span className="font-semibold text-[#191c1e]">
                                    {sub.amount.toLocaleString()}원
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
                              <div key={m.merchant} className="flex justify-between items-center text-xs">
                                <span className="text-[#191c1e] font-medium flex items-center gap-1.5 truncate max-w-[65%]">
                                  <span className="w-4 h-4 rounded-full bg-[#00236f]/10 text-[#00236f] text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="truncate">{m.merchant}</span>
                                </span>
                                <span className="font-semibold text-[#00236f] text-xs">
                                  {m.amount.toLocaleString()}원
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

      {/* Quick Consumer Insights Section */}
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
                <span className="text-[11px] text-[#757682] block font-medium">지난달 대비 증감</span>
                <div className="font-dohyeon text-sm text-[#191c1e] flex items-center gap-1">
                  <span className={insights.prevComparison.isIncreased ? 'text-[#ba1a1a]' : 'text-[#006c49]'}>
                    {insights.prevComparison.isIncreased ? '▲' : '▼'} {insights.prevComparison.diffPercent}%
                  </span>
                </div>
                <span className="text-[10px] text-[#757682] block">
                  {insights.prevComparison.diffAmount >= 0 ? '+' : ''}
                  {insights.prevComparison.diffAmount.toLocaleString()}원
                </span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] block font-medium">최대 지출 카테고리</span>
                <div className="font-dohyeon text-sm text-[#00236f] truncate">
                  {insights.topCategory ? insights.topCategory.category : '-'}
                </div>
                <span className="text-[10px] text-[#757682] block">
                  {insights.topCategory ? `${insights.topCategory.amount.toLocaleString()}원` : '내역 없음'}
                </span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] block font-medium">최대 증가 카테고리</span>
                <div className="font-dohyeon text-sm text-[#ba1a1a] truncate">
                  {insights.mostIncreasedCategory ? insights.mostIncreasedCategory.category : '-'}
                </div>
                <span className="text-[10px] text-[#757682] block">
                  {insights.mostIncreasedCategory
                    ? `+${insights.mostIncreasedCategory.increaseAmount.toLocaleString()}원`
                    : '증가 내역 없음'}
                </span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] block font-medium">하루 평균 소비</span>
                <div className="font-dohyeon text-sm text-[#00236f]">
                  {insights.dailyAverage.toLocaleString()}원
                </div>
                <span className="text-[10px] text-[#757682] block">월 30일 기준</span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] block font-medium">외식 횟수 & 금액</span>
                <div className="font-dohyeon text-sm text-[#191c1e]">
                  {insights.diningOut.count}회 · {insights.diningOut.amount.toLocaleString()}원
                </div>
                <span className="text-[10px] text-[#757682] block">식비 소분류</span>
              </div>

              <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1">
                <span className="text-[11px] text-[#757682] block font-medium">장보기 횟수 & 금액</span>
                <div className="font-dohyeon text-sm text-[#191c1e]">
                  {insights.grocery.count}회 · {insights.grocery.amount.toLocaleString()}원
                </div>
                <span className="text-[10px] text-[#757682] block">식비 소분류</span>
              </div>

              {showAllInsights && (
                <>
                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] block font-medium">편의점 이용</span>
                    <div className="font-dohyeon text-sm text-[#191c1e]">
                      {insights.convenience.count}회 · {insights.convenience.amount.toLocaleString()}원
                    </div>
                    <span className="text-[10px] text-[#757682] block">소비 건수</span>
                  </div>

                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] block font-medium">교육비 합계</span>
                    <div className="font-dohyeon text-sm text-[#00236f]">
                      {insights.education.amount.toLocaleString()}원
                    </div>
                    <span className="text-[10px] text-[#757682] block">가족 소분류</span>
                  </div>

                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] block font-medium">보험료 합계</span>
                    <div className="font-dohyeon text-sm text-[#006c49]">
                      {insights.insurance.amount.toLocaleString()}원
                    </div>
                    <span className="text-[10px] text-[#757682] block">보험 카테고리</span>
                  </div>

                  <div className="bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] block font-medium">최다 방문 거래처</span>
                    <div className="font-dohyeon text-sm text-[#191c1e] truncate">
                      {insights.topMerchant ? insights.topMerchant.merchant : '-'}
                    </div>
                    <span className="text-[10px] text-[#757682] block">
                      {insights.topMerchant
                        ? `${insights.topMerchant.count}회 · ${insights.topMerchant.amount.toLocaleString()}원`
                        : '내역 없음'}
                    </span>
                  </div>

                  <div className="col-span-2 bg-[#f8fafd] p-3 rounded-xl border border-[#c5c5d3]/20 space-y-1 animate-fadeIn">
                    <span className="text-[11px] text-[#757682] block font-medium">가장 큰 단일 소비</span>
                    <div className="font-dohyeon text-sm text-[#ba1a1a] flex justify-between items-center">
                      <span className="truncate">{insights.largestSingleTransaction ? insights.largestSingleTransaction.merchant : '-'}</span>
                      <span>{insights.largestSingleTransaction ? `${insights.largestSingleTransaction.amount.toLocaleString()}원` : '-'}</span>
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

      {/* AI CFO One-Line Comment Card */}
      <section className="bg-gradient-to-r from-[#00236f]/5 to-[#6ffbbe]/10 p-4.5 rounded-2xl border border-[#00236f]/20 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00236f] text-[#6ffbbe] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-base">smart_toy</span>
          </div>
          <span className="font-dohyeon text-sm text-[#00236f]">AI CFO 한줄 코멘트</span>
        </div>
        <p className="text-xs text-[#191c1e] font-medium leading-relaxed pl-9">
          {cfoComment}
        </p>
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
