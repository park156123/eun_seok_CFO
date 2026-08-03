import React, { useState, useEffect } from 'react';
import { GlobalMockDataStore } from '../services/dataStore';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { getMonthlyRecordForMonth, getExpenseSummaryForMonth } from '../utils/monthDataSelectors';
import { ScreenId } from '../types';

interface CashflowScreenProps {
  onNavigate?: (screen: ScreenId) => void;
}

export const CashflowScreen: React.FC<CashflowScreenProps> = ({ onNavigate }) => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth, year, month } = useSelectedMonth();
  const [, setTick] = useState(0);

  useEffect(() => {
    return GlobalMockDataStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const cashflow = GlobalMockDataStore.getMonthlyCashflowSummary(year, month);
  const currentRecord = getMonthlyRecordForMonth(selectedMonth);
  const expenseSummary = getExpenseSummaryForMonth(selectedMonth);

  // Determine Settlement Status Badge
  let settlementStatusLabel = '미작성';
  let badgeStyle = 'bg-[#757682]/10 text-[#757682] border border-[#757682]/30';

  if (currentRecord?.status === '완료' || currentRecord?.status === '결산잠금') {
    settlementStatusLabel = '결산 확정';
    badgeStyle = 'bg-[#006c49]/10 text-[#006c49] border border-[#006c49]/30';
  } else if (currentRecord?.status === '진행중' || currentRecord?.status === '작성중') {
    settlementStatusLabel = '작성 중';
    badgeStyle = 'bg-[#00236f]/10 text-[#00236f] border border-[#00236f]/30';
  } else if (expenseSummary.hasData || (currentRecord && ((currentRecord.incomes && currentRecord.incomes.length > 0) || (currentRecord.transactions && currentRecord.transactions.length > 0)))) {
    settlementStatusLabel = '작성 중';
    badgeStyle = 'bg-[#00236f]/10 text-[#00236f] border border-[#00236f]/30';
  }

  // Check if target month has settlement or cashflow data
  const hasSettlementData =
    currentRecord?.status === '완료' ||
    currentRecord?.status === '결산잠금' ||
    currentRecord?.status === '진행중' ||
    expenseSummary.hasData ||
    (currentRecord && ((currentRecord.incomes && currentRecord.incomes.length > 0) || (currentRecord.transactions && currentRecord.transactions.length > 0))) ||
    cashflow.totalInflow > 0 ||
    cashflow.livingExpenses > 0;

  const totalInflow = cashflow.totalInflow;
  const totalOutflow = cashflow.totalOutflow;
  const netFlow = cashflow.netCashflow;
  const outflowRatio =
    totalInflow > 0 ? Math.min(100, Math.round((totalOutflow / totalInflow) * 100)) : 0;

  const financialTotal = GlobalMockDataStore.getTotalAssetsSummary().financialTotal;

  const formatKRW = (num: number) => {
    if (Math.abs(num) >= 100000000) {
      const eok = Math.floor(Math.abs(num) / 100000000);
      const man = Math.round((Math.abs(num) % 100000000) / 10000);
      const prefix = num < 0 ? '-' : '';
      return man > 0 ? `${prefix}${eok}억 ${man.toLocaleString()}만원` : `${prefix}${eok}억원`;
    }
    if (Math.abs(num) >= 10000) {
      return `${(num / 10000).toLocaleString()}만원`;
    }
    return `${num.toLocaleString()}원`;
  };

  return (
    <div className="space-y-6 pb-28">
      {/* 0. Top Header Bar with Global Month Selector & Settlement Badge */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-dohyeon text-lg text-[#00236f]">
              {formattedSelectedMonth} 현금흐름 분석
            </h1>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${badgeStyle}`}>
              {settlementStatusLabel}
            </span>
          </div>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            기준월 수입 및 지출 현황
          </p>
        </div>
        <MonthSelector
          selectedMonth={selectedMonth}
          onChangeMonth={setSelectedMonth}
        />
      </section>

      {hasSettlementData ? (
        <>
          {/* 1. Summary Overview Header */}
          <section className="bg-white rounded-3xl p-6 shadow-xs border border-[#c5c5d3]/20 space-y-4">
            <span className="font-label-md text-xs text-[#757682]">
              {formattedSelectedMonth} 순현금흐름 (NET FLOW)
            </span>
            <h2
              className={`font-dohyeon text-3xl font-bold ${
                netFlow >= 0 ? 'text-[#006c49]' : 'text-[#ba1a1a]'
              }`}
            >
              {netFlow >= 0 ? `+${netFlow.toLocaleString()}원` : `${netFlow.toLocaleString()}원`}
            </h2>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#c5c5d3]/30 text-center">
              <div className="p-2 bg-[#6cf8bb]/20 rounded-xl">
                <span className="text-[10px] text-[#757682] block">총 유입</span>
                <span className="font-bold text-xs text-[#006c49]">
                  +{formatKRW(totalInflow)}
                </span>
              </div>
              <div className="p-2 bg-[#ffdad6]/30 rounded-xl">
                <span className="text-[10px] text-[#757682] block">총 유출</span>
                <span className="font-bold text-xs text-[#ba1a1a]">
                  -{formatKRW(totalOutflow)}
                </span>
              </div>
              <div className="p-2 bg-[#dce1ff]/40 rounded-xl">
                <span className="text-[10px] text-[#757682] block">금융자산</span>
                <span className="font-bold text-xs text-[#00236f]">{formatKRW(financialTotal)}</span>
              </div>
            </div>
          </section>

          {/* 2. Visual Bar Comparison Chart */}
          <section className="bg-white rounded-2xl p-5 shadow-xs border border-[#c5c5d3]/20 space-y-4">
            <h3 className="font-dohyeon text-base text-[#00236f]">유입 vs 유출 비교</h3>

            <div className="space-y-3 pt-2">
              {/* Inflow Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#006c49]">
                    총 유입 (+{formatKRW(totalInflow)})
                  </span>
                  <span className="text-[#006c49]">{totalInflow > 0 ? '100%' : '0%'}</span>
                </div>
                <div className="w-full bg-[#e6e8ea] h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-[#006c49] h-full rounded-full transition-all"
                    style={{ width: totalInflow > 0 ? '100%' : '0%' }}
                  />
                </div>
              </div>

              {/* Outflow Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#ba1a1a]">
                    총 유출 (-{formatKRW(totalOutflow)})
                  </span>
                  <span className="text-[#ba1a1a]">{outflowRatio}%</span>
                </div>
                <div className="w-full bg-[#e6e8ea] h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-[#ba1a1a] h-full rounded-full transition-all"
                    style={{ width: `${outflowRatio}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Inflow Breakdown */}
          <section className="space-y-3">
            <h3 className="font-dohyeon text-base text-[#006c49] flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-lg">arrow_downward</span>
              유입 상세 ({cashflow.inflowDetails.length}건)
            </h3>

            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3">
              {cashflow.inflowDetails.length === 0 ? (
                <p className="text-center text-[#757682] text-xs py-2">
                  등록된 수입원이 없습니다. (0원)
                </p>
              ) : (
                cashflow.inflowDetails.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center text-sm py-1 border-b border-[#c5c5d3]/10 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#006c49] text-base">
                        payments
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#191c1e] block">{item.name}</span>
                          {item.isActual && (
                            <span className="text-[9px] bg-[#6cf8bb]/40 text-[#00714d] px-1.5 py-0.2 rounded font-bold">
                              확정
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#757682]">{item.type}</span>
                      </div>
                    </div>
                    <span className="font-bold text-[#006c49]">
                      +{(Number(item.amount) || 0).toLocaleString()}원
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 4. Outflow Breakdown */}
          <section className="space-y-3">
            <h3 className="font-dohyeon text-base text-[#ba1a1a] flex items-center gap-2 px-1">
              <span className="material-symbols-outlined text-lg">arrow_upward</span>
              유출 상세 ({cashflow.outflowDetails.length}건)
            </h3>

            <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#c5c5d3]/20 space-y-3">
              {cashflow.outflowDetails.length === 0 ? (
                <p className="text-center text-[#757682] text-xs py-2">
                  등록된 지출 내역이 없습니다. (0원)
                </p>
              ) : (
                cashflow.outflowDetails.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex justify-between items-center text-sm py-1 border-b border-[#c5c5d3]/10 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#ba1a1a] text-base">
                        {exp.id === 'interest' ? 'percent' : exp.id === 'principal' ? 'account_balance' : 'shopping_cart'}
                      </span>
                      <div>
                        <span className="font-bold text-[#191c1e] block">{exp.name}</span>
                        <span className="text-[10px] text-[#757682]">{exp.category}</span>
                      </div>
                    </div>
                    <span className="font-bold text-[#ba1a1a]">
                      -{(Number(exp.amount) || 0).toLocaleString()}원
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 5. CFO Rule Note */}
          <div className="bg-[#6cf8bb]/20 border border-[#6cf8bb]/40 p-4 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-[#00714d] text-xl shrink-0">info</span>
            <p className="text-xs text-[#00714d] leading-relaxed">
              <span className="font-bold">SSOT 원칙:</span> 월간결산 및 기본정보관리의 동일한 실시간 데이터 소스를 참조하여 순현금흐름이 자동 산출됩니다.
            </p>
          </div>
        </>
      ) : (
        /* Empty State Card */
        <section className="bg-white rounded-2xl p-8 text-center border border-[#c5c5d3]/30 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#00236f]/10 text-[#00236f] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">analytics</span>
          </div>
          <div>
            <h2 className="font-dohyeon text-lg text-[#191c1e]">
              선택한 월의 결산 데이터가 없습니다
            </h2>
            <p className="text-xs text-[#757682] mt-1 max-w-sm mx-auto leading-relaxed">
              {formattedSelectedMonth}의 월간결산을 완료하거나 가계부 내역을 입력하시면 현금흐름 분석 결과를 확인할 수 있습니다.
            </p>
          </div>
          {onNavigate && (
            <div className="pt-2">
              <button
                onClick={() => onNavigate('2-3')}
                className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-dohyeon rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                {month}월 결산 작성하러 가기
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
