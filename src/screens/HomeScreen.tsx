import React, { useState, useEffect } from 'react';
import { ScreenId, Transaction, ScheduleEvent, SettlementData } from '../types';
import { GlobalMockDataStore } from '../services/dataStore';

interface HomeScreenProps {
  onNavigate: (screen: ScreenId) => void;
  transactions: Transaction[];
  schedules: ScheduleEvent[];
  netCashflow: number;
  totalSpending: number;
  settlementData: SettlementData;
  onToggleDataState?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  schedules: propSchedules,
  settlementData,
}) => {
  const [storeData, setStoreData] = useState(() => GlobalMockDataStore.getData());

  useEffect(() => {
    return GlobalMockDataStore.subscribe((newData) => {
      setStoreData(newData);
    });
  }, []);

  // ① Calculate current calendar year and month
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentCalendarMonth = now.getMonth() + 1;

  const currentSettlementYear = 2026;
  const currentSettlementMonth = 6;
  const currentSettlementStr = `${currentSettlementYear}년 ${currentSettlementMonth}월`;

  // SSOT Cashflow Summary
  const cashflowSummary = GlobalMockDataStore.getMonthlyCashflowSummary(currentSettlementYear, currentSettlementMonth);
  const netCashflow = cashflowSummary.netCashflow;
  const totalSpending = cashflowSummary.totalOutflow;

  const schedules = storeData.otherSettings?.schedules || propSchedules || [];

  // Helper to load monthly records from localStorage / fallback
  const getMonthlyRecordsMap = () => {
    try {
      const saved = localStorage.getItem('cfo_monthly_records_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      '2026년 5월': {
        status: '결산잠금',
        completedAtDate: '2026.06.02',
        completedAtTime: '19:40',
      },
      '2026년 6월': {
        status: '진행중',
      },
    };
  };

  const recordsMap = getMonthlyRecordsMap();

  // ③ Query latest completed settlement from actual saved records
  const findLatestCompletedSettlement = (records: Record<string, any>) => {
    const completedEntries = Object.entries(records).filter(([_, rec]) => {
      return rec && (rec.status === '완료' || rec.status === '결산잠금');
    });

    if (completedEntries.length === 0) {
      const prevMonthNum = currentCalendarMonth === 1 ? 12 : currentCalendarMonth - 1;
      const prevYearNum = currentCalendarMonth === 1 ? currentCalendarYear - 1 : currentCalendarYear;
      return {
        monthStr: `${prevYearNum}년 ${prevMonthNum}월`,
        lastUpdated: '-',
      };
    }

    const parsedList = completedEntries.map(([key, rec]) => {
      const match = key.match(/(\d{4})년\s*(\d{1,2})월/);
      const y = match ? parseInt(match[1], 10) : 0;
      const m = match ? parseInt(match[2], 10) : 0;
      const dateStr = rec.completedAtDate
        ? `${rec.completedAtDate}${rec.completedAtTime ? ' ' + rec.completedAtTime : ''}`
        : '-';
      return { key, year: y, month: m, dateStr };
    });

    parsedList.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    const top = parsedList[0];
    return {
      monthStr: top.key,
      lastUpdated: top.dateStr,
    };
  };

  const latestCompleted = findLatestCompletedSettlement(recordsMap);
  const cleanBaseMonth = latestCompleted.monthStr;
  const lastUpdated =
    latestCompleted.lastUpdated !== '-'
      ? latestCompleted.lastUpdated
      : settlementData.lastUpdated || '-';

  // Determine current settlement status for the active settlement month
  const currentRecord = recordsMap[currentSettlementStr];
  const currentStatus = currentRecord
    ? currentRecord.status === '결산잠금'
      ? '완료'
      : currentRecord.status === '미시작'
      ? '미결산'
      : currentRecord.status
    : settlementData.status || '미결산';

  // Get action button label based on status
  const getSettlementButtonText = () => {
    switch (currentStatus) {
      case '진행중':
        return '결산 계속하기';
      case '완료':
        return '결산 보기';
      case '미결산':
      default:
        return `${currentSettlementStr} 결산 시작`;
    }
  };

  // Get single status badge styling
  const renderSingleStatusBadge = () => {
    switch (currentStatus) {
      case '완료':
        return (
          <span className="bg-[#e6f4ed] text-[#006c49] border border-[#c3e9d5] font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#006c49]"></span>
            완료
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
    <div className="space-y-6 pb-28">
      {/* 1. 최상단: 월간 결산 현황 카드 */}
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
              <div>
                <h2 className="font-dohyeon text-lg text-[#00236f] flex items-center gap-2">
                  월간 결산 현황
                  <span className="text-xs font-sans font-bold text-[#00236f] bg-[#00236f]/10 px-2 py-0.5 rounded-md">
                    {currentSettlementStr}
                  </span>
                </h2>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Settlement Status Details Box */}
            <div className="bg-[#f7f9fb] p-4 rounded-xl border border-[#c5c5d3]/20 space-y-3">
              {/* Row 1: Target Month & Single Status Badge */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#eceef0]">
                <span className="text-xs font-bold text-[#444651]">결산 상태</span>
                <div>{renderSingleStatusBadge()}</div>
              </div>

              {/* Row 2: Currently Displayed Base Data & Last Updated */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-0.5">
                <div>
                  <span className="text-[11px] text-[#757682] block mb-0.5 font-medium">
                    현재 표시 데이터
                  </span>
                  <span className="font-dohyeon text-sm text-[#00236f] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#006c49]">
                      verified
                    </span>
                    {cleanBaseMonth} (최근 완료 결산)
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#757682] block mb-0.5 font-medium">
                    마지막 수정
                  </span>
                  <span className="font-sans font-semibold text-xs text-[#191c1e]">
                    {lastUpdated}
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic Settlement Start / Continue / View Button */}
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

      {/* 2. AI 브리핑 카드 */}
      <section>
        <div
          id="home-ai-briefing-card"
          onClick={() => onNavigate('1-1')}
          className="group bg-[#00236f] text-white p-5 sm:p-6 rounded-2xl shadow-lg border border-transparent hover:border-[#6cf8bb]/40 hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden"
        >
          {/* Subtle background glow pattern */}
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
                AI 월간 리포트
              </span>
            </div>

            {/* Click CTA Badge */}
            <span className="bg-[#6cf8bb] text-[#00236f] font-dohyeon text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1 group-hover:bg-white transition-colors">
              리포트 보기
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </span>
          </div>

          <h2 className="font-dohyeon text-2xl mb-2.5 leading-snug group-hover:text-[#6cf8bb] transition-colors">
            {netCashflow > 0
              ? '이번 달은 흑자를 유지하고 있습니다'
              : netCashflow === 0
              ? '이번 달 수입과 지출 균형 상태입니다'
              : '이번 달 지출 관리가 필요한 상태입니다'}
          </h2>

          <div className="flex justify-between items-end pt-1">
            <p className="font-body-sm text-sm text-white/90 max-w-[80%] leading-relaxed">
              {netCashflow > 0
                ? `월 순현금흐름 +${netCashflow.toLocaleString()}원으로 안정적인 자산 축적이 진행 중입니다.`
                : netCashflow === 0
                ? '등록된 자산, 부채, 수입, 고정지출 정보를 바탕으로 자산을 종합 관리합니다.'
                : `월 순현금흐름이 -${Math.abs(netCashflow).toLocaleString()}원으로 지출 점검이 필요합니다.`}
            </p>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#6cf8bb] group-hover:text-[#00236f] transition-all">
              <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-0.5">
                chevron_right
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 순현금흐름 카드 & 이번 달 지출 카드 & 다가오는 일정 */}
      <section className="grid grid-cols-2 gap-4">
        {/* 순현금흐름 카드 */}
        <div
          id="home-net-cashflow-card"
          onClick={() => onNavigate('3-2')}
          className="col-span-2 bg-white p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-[#c5c5d3]/20 flex flex-col justify-between h-38 cursor-pointer hover:border-[#00236f]/30 transition-all"
        >
          <div className="flex justify-between items-center">
            <span className="text-[#444651] font-label-md text-xs uppercase tracking-wider">
              순현금흐름 (NET FLOW)
            </span>
          </div>

          <div className="mt-2">
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
          </div>
        </div>

        {/* 이번 달 지출 카드 */}
        <div
          id="home-spending-card"
          onClick={() => onNavigate('2-1')}
          className="bg-white p-5 rounded-2xl shadow-[0_4px_12px_rgba(0,35,111,0.05)] border border-[#c5c5d3]/20 flex flex-col justify-between h-42 cursor-pointer hover:border-[#00236f]/30 transition-all"
        >
          <div className="flex justify-between items-center">
            <span className="text-[#444651] font-label-md text-xs">고정지출 현황</span>
          </div>
          <div className="mt-2">
            <span className="font-dohyeon text-xl text-[#191c1e] block">
              {totalSpending.toLocaleString()}원
            </span>
            <span className="text-[#00236f] font-label-md text-[11px] flex items-center gap-0.5 mt-2 bg-[#1e3a8a]/10 px-2 py-0.5 rounded-md w-fit font-semibold">
              <span className="material-symbols-outlined text-sm">payments</span>
              {totalSpending > 0 ? '고정지출 반영' : '지출 내역 없음'}
            </span>
          </div>
        </div>

        {/* 다가오는 일정 */}
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
          {/* AI Briefing Card */}
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
                일간/월간 리포트 분석
              </p>
            </div>
          </button>

          {/* AI Question Card */}
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
