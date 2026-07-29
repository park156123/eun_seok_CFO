import React, { useState, useEffect } from 'react';
import { ScreenId, Transaction, ScheduleEvent, SettlementData } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';
import { useSelectedMonth } from '../context/SelectedMonthContext';
import { MonthSelector } from '../components/MonthSelector';
import { getMonthlyRecordForMonth, getExpenseSummaryForMonth } from '../utils/monthDataSelectors';

interface HomeScreenProps {
  onNavigate: (screen: ScreenId) => void;
  transactions?: Transaction[];
  schedules?: ScheduleEvent[];
  netCashflow?: number;
  totalSpending?: number;
  settlementData?: SettlementData;
  onToggleDataState?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  schedules: propSchedules,
}) => {
  const { selectedMonth, setSelectedMonth, formattedSelectedMonth, year, month } = useSelectedMonth();
  const [storeData, setStoreData] = useState(() => GlobalMockDataStore.getData());

  useEffect(() => {
    return GlobalMockDataStore.subscribe((newData) => {
      setStoreData(newData);
    });
  }, []);

  const schedules = storeData.otherSettings?.schedules || propSchedules || [];

  const currentRecord = getMonthlyRecordForMonth(selectedMonth);
  const expenseSummary = getExpenseSummaryForMonth(selectedMonth);

  const currentStatus: '완료' | '진행중' | '미결산' = currentRecord
    ? currentRecord.status === '결산잠금' || currentRecord.status === '완료'
      ? '완료'
      : currentRecord.status === '진행중'
      ? '진행중'
      : '미결산'
    : '미결산';

  const hasSettlementData = currentStatus === '완료' || currentStatus === '진행중';

  // Calculate stats for current selected month if record exists
  let totalIncome = 0;
  let consumerExpense = expenseSummary.totalExpense;
  let totalSavings = 0;
  let financialCost = 0;
  let totalOutflow = 0;
  let netCashflow = 0;

  if (currentRecord) {
    totalIncome = (currentRecord.incomes || []).reduce(
      (sum: number, inc: any) => sum + (Number(inc.amount) || 0),
      0
    );

    totalSavings = (currentRecord.savingsInvestments || []).reduce(
      (sum: number, sav: any) => sum + (Number(sav.amount) || 0),
      0
    );

    const loanPayments = GlobalMockDataStore.getMonthlyLoanPayments(year, month);
    financialCost = loanPayments.reduce(
      (s, p) => s + (p.actualInterest ?? p.estimatedInterest ?? 0),
      0
    );

    totalOutflow = consumerExpense + totalSavings + financialCost;
    netCashflow = totalIncome - totalOutflow;
  }

  // Get action button label based on status
  const getSettlementButtonText = () => {
    switch (currentStatus) {
      case '진행중':
        return `${formattedSelectedMonth} 결산 계속하기`;
      case '완료':
        return `${formattedSelectedMonth} 결산 보기`;
      case '미결산':
      default:
        return `${formattedSelectedMonth} 결산 시작하기`;
    }
  };

  // Status Badge UI
  const renderStatusBadge = () => {
    switch (currentStatus) {
      case '완료':
        return (
          <span className="bg-[#e6f4ed] text-[#006c49] border border-[#c3e9d5] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#006c49]"></span>
            결산완료
          </span>
        );
      case '진행중':
        return (
          <span className="bg-[#f0f4fd] text-[#00236f] border border-[#d0e0fc] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#00236f]"></span>
            진행중
          </span>
        );
      case '미결산':
      default:
        return (
          <span className="bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#c2410c]"></span>
            미결산
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-28">
      {/* 0. Top Header Bar with Target Month Selector */}
      <section className="bg-white p-4 rounded-2xl border border-[#c5c5d3]/30 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="font-dohyeon text-lg text-[#00236f]">
            {formattedSelectedMonth} 우리집 현황
          </h1>
          <p className="text-xs text-[#757682] mt-0.5 font-medium">
            전역 기준월 선택에 따른 재정 요약
          </p>
        </div>
        <MonthSelector
          selectedMonth={selectedMonth}
          onChangeMonth={setSelectedMonth}
        />
      </section>

      {/* 1. 월간 결산 현황 카드 */}
      <section>
        <div
          id="home-monthly-settlement-card"
          className="bg-white p-5 sm:p-6 rounded-2xl border border-[#c5c5d3]/30 shadow-[0_4px_16px_rgba(0,35,111,0.06)] relative overflow-hidden transition-all"
        >
          {/* Decorative background icon */}
          <div className="absolute -right-6 -bottom-6 text-[#00236f]/5 pointer-events-none">
            <span className="material-symbols-outlined text-[130px]">assessment</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#00236f]/10 text-[#00236f] flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">insert_chart</span>
              </div>
              <h2 className="font-dohyeon text-lg text-[#00236f] flex items-center gap-2">
                {formattedSelectedMonth} 결산 요약
              </h2>
            </div>
            {renderStatusBadge()}
          </div>

          <div className="space-y-4">
            {hasSettlementData ? (
              <div className="bg-[#f7f9fb] p-4 rounded-xl border border-[#c5c5d3]/20 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-[#757682] block mb-0.5 font-medium">
                      확정 총 수입
                    </span>
                    <span className="font-dohyeon text-sm text-[#00236f]">
                      +{totalIncome.toLocaleString()}원
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#757682] block mb-0.5 font-medium">
                      확정 총 지출
                    </span>
                    <span className="font-dohyeon text-sm text-[#ba1a1a]">
                      -{totalOutflow.toLocaleString()}원
                    </span>
                  </div>
                </div>
                {currentRecord?.completedAtDate && (
                  <div className="pt-2 border-t border-[#eceef0] text-[11px] text-[#757682]">
                    결산 확정일: {currentRecord.completedAtDate} {currentRecord.completedAtTime || ''}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#fff7ed] p-4 rounded-xl border border-[#ffedd5] space-y-1.5 text-xs text-center">
                <p className="font-dohyeon text-sm text-[#c2410c]">
                  {formattedSelectedMonth} 결산이 아직 완료되지 않았어요
                </p>
                <p className="text-[11px] text-[#757682]">
                  월간결산을 완료하면 {formattedSelectedMonth}의 확정 수입, 지출 및 손익 현황이 여기에 표시됩니다.
                </p>
              </div>
            )}

            {/* Dynamic Settlement Action Button */}
            <button
              onClick={() => onNavigate('2-3')}
              className="w-full py-3.5 bg-[#00236f] text-white font-dohyeon text-sm rounded-xl shadow-md hover:bg-[#1e3a8a] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">play_circle</span>
              {getSettlementButtonText()}
            </button>
          </div>
        </div>
      </section>

      {/* 2. AI 월간 리포트 요약 카드 */}
      <section>
        <div
          id="home-ai-briefing-card"
          onClick={() => onNavigate('1-1')}
          className="group bg-[#00236f] text-white p-5 sm:p-6 rounded-2xl shadow-lg border border-transparent hover:border-[#6cf8bb]/40 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute -right-8 -top-8 opacity-10 pointer-events-none group-hover:scale-110 group-hover:opacity-15 transition-all">
            <span className="material-symbols-outlined text-[160px]">smart_toy</span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[#6ffbbe] text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                magic_button
              </span>
              <span className="font-label-md text-xs font-bold text-[#6ffbbe] uppercase tracking-wider">
                {formattedSelectedMonth} AI 리포트
              </span>
            </div>

            <span className="bg-[#6cf8bb] text-[#00236f] font-dohyeon text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1 group-hover:bg-white transition-colors">
              리포트 보기
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </span>
          </div>

          {hasSettlementData ? (
            <>
              <h2 className="font-dohyeon text-2xl mb-2.5 leading-snug group-hover:text-[#6cf8bb] transition-colors">
                {netCashflow > 0
                  ? `${formattedSelectedMonth}은 흑자를 유지하고 있습니다`
                  : netCashflow === 0
                  ? `${formattedSelectedMonth} 수입과 지출 균형 상태입니다`
                  : `${formattedSelectedMonth} 지출 관리가 필요한 상태입니다`}
              </h2>

              <p className="font-body-sm text-sm text-white/90 leading-relaxed">
                {netCashflow > 0
                  ? `${formattedSelectedMonth} 순현금흐름 +${netCashflow.toLocaleString()}원으로 자산 축적이 진행 중입니다.`
                  : netCashflow === 0
                  ? `${formattedSelectedMonth} 확정 데이터를 바탕으로 종합 자산을 관리합니다.`
                  : `${formattedSelectedMonth} 순현금흐름 -${Math.abs(netCashflow).toLocaleString()}원으로 지출 점검이 필요합니다.`}
              </p>
            </>
          ) : (
            <div className="py-2 space-y-1">
              <h2 className="font-dohyeon text-lg text-[#6ffbbe]">
                {formattedSelectedMonth} AI 월간리포트가 아직 생성되지 않았어요
              </h2>
              <p className="text-xs text-white/80">
                월간결산을 진행하면 {formattedSelectedMonth} 확정 데이터를 기반으로 AI 리포트가 자동 생성됩니다.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3. 순현금흐름 카드 & 고정지출 카드 & 다가오는 일정 */}
      <section className="grid grid-cols-2 gap-4">
        {/* 순현금흐름 카드 */}
        <div
          id="home-net-cashflow-card"
          onClick={() => onNavigate('3-2')}
          className="col-span-2 bg-white p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-[#c5c5d3]/20 flex flex-col justify-between h-38 cursor-pointer hover:border-[#00236f]/30 transition-all"
        >
          <div className="flex justify-between items-center">
            <span className="text-[#444651] font-label-md text-xs uppercase tracking-wider">
              {formattedSelectedMonth} 순현금흐름
            </span>
            <span className="text-[10px] font-bold text-[#757682] bg-[#f0f4fd] px-2 py-0.5 rounded">
              {hasSettlementData ? '확정 데이터' : '결산 미완료'}
            </span>
          </div>

          <div className="mt-2">
            {hasSettlementData ? (
              <>
                <span
                  className={`font-body-lg font-bold text-3xl tracking-tight ${
                    netCashflow >= 0 ? 'text-[#006c49]' : 'text-[#ba1a1a]'
                  }`}
                >
                  {netCashflow >= 0 ? '+' : ''}
                  {netCashflow.toLocaleString()}원
                </span>
                <div className="w-full bg-[#eceef0] mt-3 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      netCashflow >= 0 ? 'bg-[#006c49] w-[75%]' : 'bg-[#ba1a1a] w-[40%]'
                    }`}
                  />
                </div>
              </>
            ) : (
              <div className="py-1">
                <span className="font-dohyeon text-lg text-[#757682] block">
                  결산 정보 없음
                </span>
                <span className="text-[11px] text-[#757682]">
                  {formattedSelectedMonth} 결산을 먼저 완료해 주세요.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 선택월 소비 지출 카드 */}
        <div
          id="home-spending-card"
          onClick={() => onNavigate('2-1')}
          className="bg-white p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-[#c5c5d3]/20 flex flex-col justify-between h-42 cursor-pointer hover:border-[#00236f]/30 transition-all"
        >
          <div className="flex justify-between items-center">
            <span className="text-[#444651] font-label-md text-xs">{formattedSelectedMonth} 소비 지출</span>
          </div>
          <div className="mt-2">
            {hasSettlementData ? (
              <>
                <span className="font-dohyeon text-xl text-[#191c1e] block">
                  {consumerExpense.toLocaleString()}원
                </span>
                <span className="text-[#00236f] font-label-md text-[11px] flex items-center gap-0.5 mt-2 bg-[#1e3a8a]/10 px-2 py-0.5 rounded-md w-fit font-semibold">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  소비지출 반영
                </span>
              </>
            ) : (
              <div>
                <span className="font-dohyeon text-sm text-[#757682] block">
                  내역 미확정
                </span>
                <span className="text-[10px] text-[#757682] mt-1 block">
                  결산 진행 필요
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 다가오는 일정 (독립 유지) */}
        <div
          id="home-schedule-card"
          onClick={() => onNavigate('4-1')}
          className="bg-[#5c3800] text-white p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,35,111,0.05)] flex flex-col justify-between h-42 cursor-pointer hover:opacity-95 transition-all"
        >
          <span className="font-label-md text-xs text-[#ffddb8]/80">다가오는 일정</span>
          <div className="mt-2">
            {schedules.length > 0 ? (
              <>
                <div className="bg-white/20 text-[#ffddb8] w-fit px-2 py-0.5 rounded text-[10px] font-bold mb-1.5">
                  {schedules[0].dDay || '일정'}
                </div>
                <span className="font-dohyeon text-lg block text-white leading-snug truncate">
                  {schedules[0].title}
                </span>
              </>
            ) : (
              <>
                <div className="bg-white/20 text-[#ffddb8] w-fit px-2 py-0.5 rounded text-[10px] font-bold mb-1.5">
                  안내
                </div>
                <span className="font-dohyeon text-lg block text-white leading-snug truncate">
                  등록된 일정이 없습니다
                </span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 4. AI 빠른 메뉴 */}
      <section>
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="font-dohyeon text-lg text-[#00236f]">AI 빠른 메뉴</h3>
          <span className="text-xs text-[#757682] font-semibold">스마트 CFO 기능</span>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <button
            id="quick-menu-briefing"
            onClick={() => onNavigate('1-1')}
            className="group relative bg-white p-4 rounded-2xl border border-[#c5c5d3]/25 shadow-[0_4px_12px_rgba(0,35,111,0.04)] hover:border-[#00236f]/40 active:scale-[0.97] transition-all flex flex-col justify-between text-left h-36 overflow-hidden cursor-pointer"
          >
            <div className="absolute -right-3 -bottom-3 text-[#00236f]/5 group-hover:text-[#00236f]/10 transition-colors pointer-events-none">
              <span className="material-symbols-outlined text-[88px]">psychology</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-[#00236f] text-[#6cf8bb] rounded-xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[26px]">psychology</span>
              </div>
              <span className="material-symbols-outlined text-[#757682] group-hover:text-[#00236f] transition-colors">
                arrow_forward
              </span>
            </div>
            <div>
              <span className="font-dohyeon text-base text-[#00236f] block mb-0.5">
                AI 브리핑
              </span>
              <p className="font-body-sm text-xs text-[#757682] line-clamp-1">
                {formattedSelectedMonth} 리포트 분석
              </p>
            </div>
          </button>

          <button
            id="quick-menu-question"
            onClick={() => onNavigate('1-2')}
            className="group relative bg-[#00236f] text-white p-4 rounded-2xl shadow-[0_4px_12px_rgba(0,35,111,0.12)] active:scale-[0.97] transition-all flex flex-col justify-between text-left h-36 overflow-hidden cursor-pointer"
          >
            <div className="absolute -right-3 -bottom-3 text-white/5 group-hover:text-white/10 transition-colors pointer-events-none">
              <span className="material-symbols-outlined text-[88px]">chat</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-white/15 text-[#6cf8bb] rounded-xl flex items-center justify-center shadow-xs backdrop-blur-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[26px]">chat</span>
              </div>
              <span className="material-symbols-outlined text-white/70 group-hover:text-white transition-colors">
                arrow_forward
              </span>
            </div>
            <div>
              <span className="font-dohyeon text-base text-white block mb-0.5">
                AI 질문
              </span>
              <p className="font-body-sm text-xs text-white/80 line-clamp-1">
                맞춤 금융 자문 & 답변
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* 5. Dynamic Insight Card */}
      <section>
        <div
          id="home-simulation-insight"
          onClick={() => onNavigate('4-2')}
          className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-[#c5c5d3]/30 shadow-xs cursor-pointer hover:border-[#00236f]/30 transition-all"
        >
          <div className="w-11 h-11 bg-[#6cf8bb] text-[#00714d] rounded-full flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body-sm text-sm text-[#191c1e] font-bold truncate">
              지금 50만원을 저축하면?
            </p>
            <p className="font-label-md text-xs text-[#444651]">
              은퇴 시점이 3개월 앞당겨집니다.
            </p>
          </div>
          <span className="material-symbols-outlined text-[#757682]">chevron_right</span>
        </div>
      </section>

      {/* FAB */}
      <button
        id="home-fab-ai-question"
        onClick={() => onNavigate('1-2')}
        className="fixed bottom-22 right-5 w-14 h-14 bg-[#00236f] text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform hover:bg-[#1e3a8a]"
        aria-label="Ask AI CFO"
      >
        <span
          className="material-symbols-outlined text-[30px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          add
        </span>
      </button>
    </div>
  );
};
